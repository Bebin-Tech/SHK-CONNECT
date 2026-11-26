import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../core/api.dart';
import 'firebase_config.dart';

const notificationCategories = {
  'messages': 'Messages',
  'attendance': 'Attendance',
  'assignments': 'Assignments',
  'seminars': 'Seminar submissions',
  'approvals': 'Approvals',
  'announcements': 'Academic announcements',
};

@pragma('vm:entry-point')
Future<void> firebaseBackgroundMessage(RemoteMessage message) async {
  if (PushConfiguration.options != null) {
    await Firebase.initializeApp(options: PushConfiguration.options);
  }
  // Notification payloads are displayed by the OS. Never duplicate them locally.
}

class NotificationController extends ChangeNotifier {
  final Api api;
  final bool nativeEnabled;
  final local = FlutterLocalNotificationsPlugin();
  Map<String, dynamic> preferences = {
    'enabled': true,
    'sound': true,
    'show_preview': false,
    'categories': <String, dynamic>{},
  };
  List<Map<String, dynamic>> items = [];
  Map<String, dynamic>? banner;
  int unreadCount = 0, _cursor = 0, _generation = 0;
  int? userId;
  bool permissionGranted = false,
      pushReady = false,
      active = true,
      privateCovered = false,
      hasMore = false;
  String? error, _deviceId;
  VoidCallback? onOpenInbox;
  final _seen = <int>{};
  StreamSubscription<Map<String, dynamic>>? _events;
  final _subscriptions = <StreamSubscription>[];
  Timer? _poll, _reconnect, _bannerTimer;
  bool _initialized = false, _fetching = false, _primed = false;
  NotificationController(this.api, {bool? nativeEnabled})
    : nativeEnabled = nativeEnabled ?? PushConfiguration.mobile;

  Future<void> initialize() async {
    if (_initialized || !nativeEnabled) return;
    _initialized = true;
    await local.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('ic_stat_shk'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (_) => onOpenInbox?.call(),
    );
    final android = local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await android?.createNotificationChannel(
      const AndroidNotificationChannel(
        'shk_alerts',
        'SHK updates',
        description: 'Important workspace updates',
        importance: Importance.high,
      ),
    );
    await android?.createNotificationChannel(
      const AndroidNotificationChannel(
        'shk_silent',
        'SHK updates (silent)',
        importance: Importance.high,
        playSound: false,
      ),
    );
    permissionGranted = await android?.areNotificationsEnabled() ?? false;
    if (PushConfiguration.options != null) {
      await Firebase.initializeApp(options: PushConfiguration.options);
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundMessage);
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
            alert: false,
            badge: false,
            sound: false,
          );
      _subscriptions.add(
        FirebaseMessaging.onMessage.listen((message) {
          _fromPush(message, open: false);
        }),
      );
      _subscriptions.add(
        FirebaseMessaging.onMessageOpenedApp.listen((message) {
          _fromPush(message, open: true);
        }),
      );
      _subscriptions.add(
        FirebaseMessaging.instance.onRegistered.listen((token) {
          if (userId != null && permissionGranted) _register(token);
        }),
      );
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) onOpenInbox?.call();
      final settings = await FirebaseMessaging.instance
          .getNotificationSettings();
      permissionGranted =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
    }
    final launch = await local.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true) onOpenInbox?.call();
    notifyListeners();
  }

  Future<void> start(int id) async {
    if (userId == id) return;
    await stop();
    userId = id;
    final generation = ++_generation;
    try {
      try {
        await initialize();
      } catch (_) {
        pushReady = false;
      }
      final p =
          await api.request('GET', '/notifications/preferences')
              as Map<String, dynamic>;
      if (generation != _generation) return;
      preferences = p;
      final page =
          await api.request('GET', '/notifications') as Map<String, dynamic>;
      if (generation != _generation) return;
      items = List<Map<String, dynamic>>.from(page['items']);
      unreadCount = page['unread_count'] as int;
      hasMore = page['has_more'] as bool;
      _cursor = page['latest_id'] as int;
      _seen.addAll(items.map((item) => item['id'] as int));
      error = null;
      _primed = true;
      _connect();
      _poll = Timer.periodic(const Duration(seconds: 5), (_) {
        if (active && !privateCovered) sync();
      });
      if (nativeEnabled &&
          await api.storage.read(
                key: 'shk_notification_permission_requested',
              ) !=
              'true') {
        await api.storage.write(
          key: 'shk_notification_permission_requested',
          value: 'true',
        );
        try {
          await requestPermission();
        } catch (_) {
          /* In-app notifications do not require OS permission. */
        }
      }
      await _registerCurrent();
    } catch (_) {
      error = 'Could not load notifications. Open the inbox to retry.';
    }
    notifyListeners();
  }

  void _connect() {
    if (!_primed ||
        userId == null ||
        !active ||
        privateCovered ||
        _events != null) {
      return;
    }
    _events = api
        .notificationEvents(_cursor)
        .listen(
          _receive,
          onError: (_) {
            _events?.cancel();
            _events = null;
            _reconnect?.cancel();
            _reconnect = Timer(const Duration(seconds: 5), _connect);
          },
          onDone: () {
            _events = null;
            if (userId != null) {
              _reconnect = Timer(const Duration(seconds: 3), _connect);
            }
          },
        );
  }

  void visibility({required bool foreground, required bool covered}) {
    active = foreground;
    privateCovered = covered;
    if (!foreground || covered) {
      _events?.cancel();
      _events = null;
      _reconnect?.cancel();
      banner = null;
      _bannerTimer?.cancel();
    } else {
      _connect();
    }
  }

  Future<void> sync() async {
    if (_fetching || userId == null) return;
    _fetching = true;
    final generation = _generation;
    try {
      final page =
          await api.request('GET', '/notifications?after_id=$_cursor&limit=100')
              as Map<String, dynamic>;
      if (generation != _generation) return;
      for (final item in List<Map<String, dynamic>>.from(page['items'])) {
        _receive(item);
      }
      unreadCount = page['unread_count'] as int;
      error = null;
      notifyListeners();
    } catch (_) {
      error = 'Notifications will reconnect when you are online.';
      notifyListeners();
    } finally {
      _fetching = false;
    }
  }

  void _receive(Map<String, dynamic> item, {bool advanceCursor = true}) {
    if (userId == null) return;
    final id = item['id'] as int;
    if (_seen.contains(id)) return;
    _seen.add(id);
    if (_seen.length > 500) _seen.remove(_seen.first);
    final old = id <= _cursor;
    if (advanceCursor && id > _cursor) _cursor = id;
    items = [item, ...items.where((i) => i['id'] != id)]
      ..sort((a, b) => (b['id'] as int).compareTo(a['id'] as int));
    if (item['read_at'] == null) unreadCount++;
    final categories = preferences['categories'] as Map? ?? {};
    if (!old &&
        active &&
        !privateCovered &&
        preferences['enabled'] == true &&
        categories[item['category']] != false) {
      banner = item;
      _bannerTimer?.cancel();
      _bannerTimer = Timer(const Duration(seconds: 6), dismissBanner);
      _present(item);
    }
    notifyListeners();
  }

  Future<void> _present(Map<String, dynamic> item) async {
    if (!active || privateCovered || userId == null) return;
    final sound = preferences['sound'] == true;
    if (!nativeEnabled || !permissionGranted) {
      if (sound) await SystemSound.play(SystemSoundType.alert);
      return;
    }
    try {
      final preview = preferences['show_preview'] == true;
      await local.show(
        item['id'] as int,
        preview ? item['title'] as String : 'SHK Connect',
        preview
            ? item['body'] as String
            : 'You have a new update. Open the app to view it.',
        NotificationDetails(
          android: AndroidNotificationDetails(
            sound ? 'shk_alerts' : 'shk_silent',
            sound ? 'SHK updates' : 'SHK updates (silent)',
            importance: Importance.high,
            priority: Priority.high,
            playSound: sound,
            visibility: NotificationVisibility.private,
            icon: 'ic_stat_shk',
          ),
          iOS: DarwinNotificationDetails(
            presentAlert: false,
            presentSound: sound,
          ),
        ),
        payload: '${item['id']}',
      );
    } catch (_) {
      /* Inbox and top banner remain available if OS delivery fails. */
    }
  }

  Future<void> _fromPush(RemoteMessage message, {required bool open}) async {
    if (open) {
      onOpenInbox?.call();
      return;
    }
    final id = int.tryParse(message.data['notification_id'] ?? '');
    if (id == null || userId == null || privateCovered) return;
    final generation = _generation;
    try {
      final item =
          await api.request('GET', '/notifications/item/$id')
              as Map<String, dynamic>;
      if (generation == _generation && userId != null) {
        _receive(item, advanceCursor: false);
      }
    } catch (_) {
      /* SSE/REST reconciliation retries. */
    }
  }

  Future<void> requestPermission() async {
    await initialize();
    if (!nativeEnabled) return;
    if (PushConfiguration.options != null) {
      final p = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      permissionGranted =
          p.authorizationStatus == AuthorizationStatus.authorized ||
          p.authorizationStatus == AuthorizationStatus.provisional;
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      permissionGranted =
          await local
              .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin
              >()
              ?.requestNotificationsPermission() ??
          false;
    } else {
      permissionGranted =
          await local
              .resolvePlatformSpecificImplementation<
                IOSFlutterLocalNotificationsPlugin
              >()
              ?.requestPermissions(alert: true, sound: true, badge: true) ??
          false;
    }
    await _registerCurrent();
    notifyListeners();
  }

  Future<void> _registerCurrent() async {
    if (userId == null ||
        !permissionGranted ||
        PushConfiguration.options == null) {
      return;
    }
    try {
      if (defaultTargetPlatform == TargetPlatform.iOS &&
          await FirebaseMessaging.instance.getAPNSToken() == null) {
        return;
      }
      await FirebaseMessaging.instance.register();
    } catch (_) {
      pushReady = false;
    }
  }

  Future<void> _register(String token) async {
    try {
      final row = await api.request(
        'POST',
        '/notifications/devices',
        body: {
          'token': token,
          'platform': defaultTargetPlatform == TargetPlatform.iOS
              ? 'ios'
              : 'android',
        },
      );
      _deviceId = row['id'] as String;
      pushReady = preferences['push_configured'] == true;
      notifyListeners();
    } catch (_) {
      pushReady = false;
    }
  }

  Future<void> savePreferences(Map<String, dynamic> value) async {
    final body = Map<String, dynamic>.from(value)..remove('push_configured');
    final row =
        await api.request('PUT', '/notifications/preferences', body: body)
            as Map<String, dynamic>;
    preferences = {...row, 'push_configured': preferences['push_configured']};
    if (preferences['enabled'] != true) dismissBanner();
    notifyListeners();
  }

  Future<void> read(Map<String, dynamic> item) async {
    await api.request('POST', '/notifications/${item['id']}/read');
    if (item['read_at'] == null) {
      item['read_at'] = DateTime.now().toUtc().toIso8601String();
      if (unreadCount > 0) unreadCount--;
    }
    notifyListeners();
  }

  Future<void> loadOlder() async {
    if (items.isEmpty || !hasMore) return;
    final page =
        await api.request('GET', '/notifications?before_id=${items.last['id']}')
            as Map<String, dynamic>;
    items.addAll(
      List<Map<String, dynamic>>.from(
        page['items'],
      ).where((n) => !items.any((i) => i['id'] == n['id'])),
    );
    hasMore = page['has_more'] as bool;
    notifyListeners();
  }

  void dismissBanner() {
    banner = null;
    notifyListeners();
  }

  Future<void> stop({bool unregister = false}) async {
    _generation++;
    _poll?.cancel();
    _reconnect?.cancel();
    _bannerTimer?.cancel();
    await _events?.cancel();
    _events = null;
    if (unregister && _deviceId != null) {
      try {
        await api.request('DELETE', '/notifications/devices/$_deviceId');
      } catch (_) {
        /* Logout also revokes this server session. */
      }
      try {
        if (PushConfiguration.options != null) {
          await FirebaseMessaging.instance.unregister();
        }
      } catch (_) {}
    }
    if (unregister) {
      try {
        await local.cancelAll();
      } catch (_) {}
    }
    _primed = false;
    userId = null;
    _deviceId = null;
    items = [];
    unreadCount = 0;
    _cursor = 0;
    _seen.clear();
    banner = null;
  }

  @override
  void dispose() {
    _poll?.cancel();
    _reconnect?.cancel();
    _bannerTimer?.cancel();
    _events?.cancel();
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    super.dispose();
  }
}
