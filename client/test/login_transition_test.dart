import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shk_connect/core/api.dart';
import 'package:shk_connect/main.dart';
import 'package:shk_connect/state/app_controller.dart';
import 'package:shk_connect/ui/shell.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  for (final restore in [false, true]) {
    testWidgets(
      '${restore ? 'Restored session' : 'Password login'} opens workspace after the initial route is visible',
      (tester) async {
        if (restore) {
          FlutterSecureStorage.setMockInitialValues({'shk_refresh': 'saved'});
        }
        final app = AppController(
          Api(
            baseUrl: 'https://test/api/v1',
            client: MockClient((request) async {
              final Object data;
              if (request.url.path.endsWith('/auth/me')) {
                data = {
                  'id': 1,
                  'username': 'admin',
                  'email': 'a@example.com',
                  'role': 'Admin',
                };
              } else if (request.url.path.endsWith('/workspace')) {
                data = {'channels': [], 'people': []};
              } else {
                data = {'access_token': 'access', 'refresh_token': 'refresh'};
              }
              return http.Response(jsonEncode(data), 200);
            }),
          ),
        )..restoring = restore;
        await tester.pumpWidget(ConnectApp(controller: app));
        await tester.pump();
        if (restore) {
          expect(find.byType(CircularProgressIndicator), findsOneWidget);
          await app.initialize();
        } else {
          expect(find.text('Welcome back'), findsOneWidget);
          await app.login('admin', 'password');
        }
        await tester.pumpAndSettle();
        expect(app.account, isNotNull);
        expect(find.byType(WorkspaceShell), findsOneWidget);
        expect(find.text('Welcome back'), findsNothing);
        expect(find.byType(CircularProgressIndicator), findsNothing);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        app.dispose();
      },
    );
  }
}
