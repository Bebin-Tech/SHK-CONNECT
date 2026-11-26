import 'package:flutter/material.dart';
import 'core/api.dart';
import 'state/app_controller.dart';
import 'ui/login_screen.dart';
import 'ui/shell.dart';
import 'ui/theme.dart';
import 'ui/app_lock_boundary.dart';
import 'security/app_lock.dart';
import 'notifications/notification_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = Api();
  runApp(
    ConnectApp(
      controller: AppController(
        api,
        lock: AppLockController(api.storage),
        notifications: NotificationController(api),
      )..initialize(),
    ),
  );
}

class ConnectApp extends StatelessWidget {
  final AppController controller;
  const ConnectApp({super.key, required this.controller});
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (_, _) => MaterialApp(
      key: ValueKey(controller.account?.id),
      title: 'SHK Connect',
      navigatorKey: controller.navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: connectTheme(),
      builder: (context, child) =>
          AppLockBoundary(app: controller, child: child!),
      home: Builder(
        builder: (_) {
          if (controller.restoring) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (controller.account == null) {
            return LoginScreen(app: controller);
          }
          return WorkspaceShell(
            key: ValueKey(controller.account!.id),
            app: controller,
          );
        },
      ),
    ),
  );
}
