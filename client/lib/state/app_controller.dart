import 'dart:async';
import 'package:flutter/widgets.dart';
import '../core/api.dart';
import '../data/workspace_repository.dart';
import '../domain/models.dart';
import '../security/app_lock.dart';
import '../notifications/notification_controller.dart';

class AppController extends ChangeNotifier {
  final Api api;
  GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  final AppLockController? lock;
  final NotificationController? notifications;
  late final WorkspaceRepository repository = WorkspaceRepository(api);
  Account? account;
  bool restoring = true;
  List<Conversation> conversations = [];
  String? error;
  AppController(this.api, {this.lock, this.notifications}) {
    api.onUnauthorized = _expired;
  }
  void _expired() {
    navigatorKey = GlobalKey<NavigatorState>();
    lock?.endSession();
    notifications?.stop();
    account = null;
    conversations = [];
    error = 'Your session has expired. Please sign in.';
    notifyListeners();
  }

  Future<void> initialize() async {
    try {
      if (lock != null && !await lock!.restoreGate()) return;
      await api.restore();
      account = await repository.me();
      // A new MaterialApp must not reparent the signed-out navigator and
      // retain its initial login/loading route after authentication.
      navigatorKey = GlobalKey<NavigatorState>();
      await lock?.signedIn(account!.id);
      unawaited(notifications?.start(account!.id));
    } catch (e) {
      if (e is! ApiException || e.status != 401) error = e.toString();
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> login(String identifier, String password) async {
    await api.login(identifier, password);
    account = await repository.me();
    navigatorKey = GlobalKey<NavigatorState>();
    await lock?.signedIn(account!.id);
    unawaited(notifications?.start(account!.id));
    error = null;
    notifyListeners();
  }

  Future<void> loadWorkspace() async {
    conversations = await repository.conversations();
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await notifications?.stop(unregister: true);
      await api.logout();
    } finally {
      _expired();
      error = null;
    }
  }

  Future<void> updateProfile(Map<String, dynamic> data) async {
    final j = await api.request('PATCH', '/auth/me', body: data);
    if (data['new_password'] != null) {
      await api.clear();
      _expired();
      return;
    }
    account = Account.fromJson(j);
    notifyListeners();
  }

  @override
  void dispose() {
    notifications?.dispose();
    lock?.dispose();
    api.dispose();
    super.dispose();
  }
}
