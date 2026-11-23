import 'package:flutter/material.dart';
import 'core/api.dart';
import 'state/app_controller.dart';
import 'ui/login_screen.dart';
import 'ui/shell.dart';
import 'ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(ConnectApp(controller: AppController(Api())..initialize()));
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
      debugShowCheckedModeBanner: false,
      theme: connectTheme(),
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
