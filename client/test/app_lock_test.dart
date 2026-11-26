import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shk_connect/core/api.dart';
import 'package:shk_connect/domain/models.dart';
import 'package:shk_connect/main.dart';
import 'package:shk_connect/security/app_lock.dart';
import 'package:shk_connect/state/app_controller.dart';

class _Authenticator implements DeviceAuthenticator {
  bool available = true, success = true;
  int prompts = 0;
  @override
  Future<bool> supported() async => available;
  @override
  Future<bool> authenticate() async {
    prompts++;
    return success;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test(
    'Cold launch gates credential restoration; cancellation never unlocks',
    () async {
      FlutterSecureStorage.setMockInitialValues({
        'shk_lock_account': '1',
        'shk_refresh': 'encrypted-session-token',
      });
      final auth = _Authenticator()..success = false;
      final lock = AppLockController(
        const FlutterSecureStorage(),
        authenticator: auth,
        supportedPlatform: true,
      );
      final gate = lock.restoreGate();
      await Future<void>.delayed(Duration.zero);
      expect(lock.locked, isTrue);
      await lock.unlock();
      expect(lock.locked, isTrue);
      auth.success = true;
      await lock.unlock();
      expect(await gate, isTrue);
      expect(lock.locked, isFalse);
      expect(
        await lock.storage.read(key: 'shk_refresh'),
        'encrypted-session-token',
      );
      lock.dispose();
    },
  );

  test(
    'Return timeout, per-account settings and no-credential fallback are enforced',
    () async {
      var time = DateTime(2026, 11, 26);
      final auth = _Authenticator();
      final lock = AppLockController(
        const FlutterSecureStorage(),
        authenticator: auth,
        supportedPlatform: true,
        clock: () => time,
      );
      await lock.signedIn(1);
      lock.lifecycle(AppLifecycleState.paused);
      expect(lock.covered, isTrue);
      time = time.add(const Duration(seconds: 10));
      lock.lifecycle(AppLifecycleState.resumed);
      expect(lock.locked, isFalse);
      lock.lifecycle(AppLifecycleState.paused);
      time = time.add(const Duration(seconds: 31));
      lock.lifecycle(AppLifecycleState.resumed);
      expect(lock.locked, isTrue);
      auth.available = false;
      await lock.unlock();
      expect(lock.locked, isTrue);
      expect(lock.error, contains('account password'));
      auth.available = true;
      await lock.unlock();
      await lock.setEnabled(false);
      await lock.signedIn(2);
      expect(lock.enabled, isTrue);
      await lock.signedIn(1);
      expect(lock.enabled, isFalse);
      await lock.setTimeout(999);
      expect(lock.timeoutSeconds, 30);
      await lock.endSession();
      lock.dispose();
    },
  );

  testWidgets(
    'Private routes are hidden behind lock and account password clears the session',
    (tester) async {
      final auth = _Authenticator()..success = false;
      var time = DateTime(2026, 11, 26);
      final lock = AppLockController(
        const FlutterSecureStorage(),
        authenticator: auth,
        supportedPlatform: true,
        clock: () => time,
      );
      await lock.signedIn(1);
      final api = Api(
        client: MockClient(
          (request) async => http.Response(
            request.url.path.endsWith('/workspace')
                ? '{"channels":[],"people":[]}'
                : '{}',
            200,
          ),
        ),
      );
      final app = AppController(api, lock: lock)
        ..restoring = false
        ..account = const Account(1, 'admin', 'a@example.com', '', '', 'Admin');
      await tester.pumpWidget(ConnectApp(controller: app));
      await tester.pumpAndSettle();
      app.navigatorKey.currentState!.push(
        MaterialPageRoute<void>(
          builder: (_) =>
              const Scaffold(body: Text('Private academic content')),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Private academic content'), findsOneWidget);
      lock.lifecycle(AppLifecycleState.paused);
      time = time.add(const Duration(seconds: 31));
      lock.lifecycle(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(find.text('Private academic content'), findsNothing);
      expect(find.text('SHK Connect is locked'), findsOneWidget);
      await tester.tap(find.text('Use account password'));
      await tester.pumpAndSettle();
      expect(app.account, isNull);
      expect(find.text('Private academic content'), findsNothing);
      expect(find.text('Welcome back'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      app.dispose();
    },
  );
}
