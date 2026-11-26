import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

abstract class DeviceAuthenticator {
  Future<bool> supported();
  Future<bool> authenticate();
}

class NativeDeviceAuthenticator implements DeviceAuthenticator {
  final LocalAuthentication _auth = LocalAuthentication();
  @override
  Future<bool> supported() => _auth.isDeviceSupported();
  @override
  Future<bool> authenticate() => _auth.authenticate(
    localizedReason: 'Unlock SHK Connect to continue',
    biometricOnly: false,
    persistAcrossBackgrounding: true,
  );
}

class AppLockController extends ChangeNotifier {
  final FlutterSecureStorage storage;
  final DeviceAuthenticator authenticator;
  final bool supportedPlatform;
  final DateTime Function() clock;
  bool locked = false, enabled = true, authenticating = false, covered = false;
  int timeoutSeconds = 30;
  String? error, _user;
  DateTime? _leftAt;
  int _epoch = 0;
  Completer<bool>? _restore;
  AppLockController(
    this.storage, {
    DeviceAuthenticator? authenticator,
    bool? supportedPlatform,
    DateTime Function()? clock,
  }) : authenticator = authenticator ?? NativeDeviceAuthenticator(),
       supportedPlatform =
           supportedPlatform ??
           (!kIsWeb &&
               {
                 TargetPlatform.android,
                 TargetPlatform.iOS,
               }.contains(defaultTargetPlatform)),
       clock = clock ?? DateTime.now;

  Future<void> _readSettings(String user) async {
    enabled = (await storage.read(key: 'shk_lock_$user')) != 'false';
    timeoutSeconds =
        int.tryParse(await storage.read(key: 'shk_lock_timeout_$user') ?? '') ??
        30;
    if (![0, 30, 60, 300].contains(timeoutSeconds)) timeoutSeconds = 30;
  }

  Future<bool> restoreGate() async {
    if (!supportedPlatform) return true;
    _user = await storage.read(key: 'shk_lock_account');
    if (_user == null && await storage.read(key: 'shk_refresh') == null) {
      return true;
    }
    _user ??= 'restoring';
    await _readSettings(_user!);
    if (!enabled) return true;
    _restore = Completer<bool>();
    locked = true;
    notifyListeners();
    return _restore!.future;
  }

  Future<void> signedIn(int userId) async {
    if (!supportedPlatform) return;
    _epoch++;
    _user = '$userId';
    await _readSettings(_user!);
    await storage.write(key: 'shk_lock_account', value: _user);
    locked = false;
    error = null;
    notifyListeners();
  }

  Future<void> unlock() async {
    if (!locked || authenticating) return;
    final epoch = _epoch;
    authenticating = true;
    error = null;
    notifyListeners();
    try {
      if (!await authenticator.supported()) {
        error =
            'Device unlock is unavailable. Use your account password, or set up a screen lock in device settings.';
      } else if (await authenticator.authenticate() && epoch == _epoch) {
        locked = false;
        _leftAt = null;
        if (_restore != null && !_restore!.isCompleted) {
          _restore!.complete(true);
        }
      } else {
        error = 'Not verified. Try again or use your account password.';
      }
    } catch (_) {
      error =
          'Could not verify your identity. Try your device PIN or use your account password.';
    } finally {
      authenticating = false;
      notifyListeners();
    }
  }

  void lifecycle(AppLifecycleState state) {
    if (!supportedPlatform || _user == null) return;
    if (state != AppLifecycleState.resumed) {
      covered = true;
      if (!authenticating &&
          (state == AppLifecycleState.paused ||
              state == AppLifecycleState.hidden)) {
        _leftAt ??= clock();
      }
    } else {
      covered = false;
      if (!authenticating &&
          enabled &&
          _leftAt != null &&
          clock().difference(_leftAt!).inSeconds >= timeoutSeconds) {
        locked = true;
      }
      _leftAt = null;
    }
    notifyListeners();
  }

  Future<void> setEnabled(bool value) async {
    if (!supportedPlatform || _user == null || authenticating || locked) return;
    final epoch = _epoch;
    authenticating = true;
    notifyListeners();
    try {
      if (await authenticator.supported()) {
        if (!await authenticator.authenticate()) return;
      } else if (value) {
        throw Exception(
          'Set up fingerprint, face authentication or a device PIN in device settings first.',
        );
      }
      if (epoch != _epoch) return;
      enabled = value;
      await storage.write(key: 'shk_lock_$_user', value: '$value');
    } finally {
      authenticating = false;
      notifyListeners();
    }
  }

  Future<void> setTimeout(int seconds) async {
    if (_user == null || ![0, 30, 60, 300].contains(seconds)) return;
    timeoutSeconds = seconds;
    await storage.write(key: 'shk_lock_timeout_$_user', value: '$seconds');
    notifyListeners();
  }

  Future<void> endSession() async {
    _epoch++;
    _user = null;
    locked = covered = false;
    _leftAt = null;
    if (_restore != null && !_restore!.isCompleted) _restore!.complete(false);
    _restore = null;
    notifyListeners();
    if (supportedPlatform) await storage.delete(key: 'shk_lock_account');
  }
}
