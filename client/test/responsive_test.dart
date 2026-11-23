import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shk_connect/core/api.dart';
import 'package:shk_connect/domain/models.dart';
import 'package:shk_connect/main.dart';
import 'package:shk_connect/state/app_controller.dart';
import 'package:shk_connect/ui/chat_panel.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final size in [
    const Size(390, 844),
    const Size(768, 1024),
    const Size(1440, 900),
  ]) {
    testWidgets('Workspace adapts and sends messages at $size', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final sent = <String>[];
      final api = Api(
        baseUrl: 'https://test/api/v1',
        client: MockClient((request) async {
          dynamic data = {};
          if (request.url.path.endsWith('/workspace')) {
            data = {
              'channels': [
                {
                  'id': 1,
                  'kind': 'channel',
                  'name': 'general',
                  'member_ids': [1],
                  'unread': 0,
                },
              ],
              'people': [],
            };
          } else if (request.url.path.endsWith('/messages')) {
            if (request.method == 'POST') {
              sent.add(jsonDecode(request.body)['content']);
            }
            data = {
              'messages': [],
              'has_more': false,
              'typing_user_ids': [],
              'latest_id': 0,
            };
          }
          return http.Response(
            jsonEncode(data),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      final controller = AppController(api)
        ..restoring = false
        ..account = const Account(
          1,
          'admin',
          'admin@example.com',
          'Alex',
          '',
          'Admin',
        );
      await tester.pumpWidget(ConnectApp(controller: controller));
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull);
      expect(find.text('Ledger'), findsNothing);
      expect(find.text('Support'), findsNothing);
      await tester.tap(find.text('general').first);
      await tester.pumpAndSettle();
      expect(find.text('Start a conversation'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextField, 'Message general…'),
        'Hello from every platform',
      );
      await tester.tap(find.byTooltip('Send message'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(sent, ['Hello from every platform']);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    });
  }
  testWidgets('Login fits a narrow screen at large text scale', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = AppController(
      Api(client: MockClient((_) async => http.Response('{}', 401))),
    )..restoring = false;
    await tester.pumpWidget(ConnectApp(controller: controller));
    expect(find.text('Welcome back'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
  testWidgets('A failed send retains the draft', (tester) async {
    final api = Api(
      baseUrl: 'https://test/api/v1',
      client: MockClient((request) async {
        if (request.url.path.endsWith('/workspace')) {
          return http.Response(
            jsonEncode({
              'channels': [
                {'id': 1, 'kind': 'channel', 'name': 'general'},
              ],
              'people': [],
            }),
            200,
          );
        }
        if (request.url.path.endsWith('/messages') &&
            request.method == 'POST') {
          return http.Response('{"detail":"Try again"}', 503);
        }
        return http.Response(
          '{"messages":[],"has_more":false,"typing_user_ids":[],"latest_id":0}',
          200,
        );
      }),
    );
    final controller = AppController(api)
      ..restoring = false
      ..account = const Account(1, 'a', 'a@example.com', '', '', 'Member');
    await tester.pumpWidget(ConnectApp(controller: controller));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.tap(find.text('general').first);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.enterText(
      find.widgetWithText(TextField, 'Message general…'),
      'Keep this draft',
    );
    await tester.tap(find.byTooltip('Send message'));
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Keep this draft'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });

  testWidgets('Signing out clears private routes', (tester) async {
    final api = Api(
      baseUrl: 'https://test/api/v1',
      client: MockClient((request) async {
        if (request.url.path.endsWith('/workspace')) {
          return http.Response('{"channels":[],"people":[]}', 200);
        }
        return http.Response('', 204);
      }),
    );
    final controller = AppController(api)
      ..restoring = false
      ..account = const Account(1, 'a', 'a@example.com', '', '', 'Member');
    await tester.pumpWidget(ConnectApp(controller: controller));
    await tester.pumpAndSettle();
    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => const Scaffold(body: Text('Private thread')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Private thread'), findsOneWidget);
    await tester.runAsync(controller.logout);
    await tester.pumpAndSettle();
    expect(find.text('Private thread'), findsNothing);
    expect(find.text('Welcome back'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });

  testWidgets('Desktop threads open alongside their channel', (tester) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final conversation = {
      'id': 1,
      'kind': 'channel',
      'name': 'general',
      'member_ids': [1],
    };
    final root = {
      'id': 1,
      'user_id': 1,
      'author': 'Alex',
      'content': 'Discuss the launch',
      'parent_id': null,
      'is_pinned': false,
      'created_at': '2026-11-23T10:00:00Z',
      'attachment': null,
    };
    final reply = {...root, 'id': 2, 'parent_id': 1, 'content': 'Thread reply'};
    final api = Api(
      baseUrl: 'https://test/api/v1',
      client: MockClient((request) async {
        if (request.url.path.endsWith('/workspace')) {
          return http.Response(
            jsonEncode({
              'channels': [conversation],
              'people': [],
            }),
            200,
          );
        }
        if (request.url.path.endsWith('/threads')) {
          return http.Response(
            jsonEncode({
              'threads': [
                {
                  'message': root,
                  'conversation': conversation,
                  'reply_count': 1,
                  'latest_id': 2,
                },
              ],
              'has_more': false,
            }),
            200,
          );
        }
        if (request.url.path.endsWith('/messages')) {
          return http.Response(
            jsonEncode({
              'messages': [
                request.url.queryParameters.containsKey('parent_id')
                    ? reply
                    : root,
              ],
              'has_more': false,
              'typing_user_ids': [],
              'latest_id': 2,
            }),
            200,
          );
        }
        return http.Response('', 204);
      }),
    );
    final controller = AppController(api)
      ..restoring = false
      ..account = const Account(
        1,
        'alex',
        'alex@example.com',
        'Alex',
        '',
        'Admin',
      );
    await tester.pumpWidget(ConnectApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reply in thread'));
    await tester.pumpAndSettle();
    expect(find.byType(ChatPanel), findsNWidgets(2));
    expect(find.text('Thread reply'), findsOneWidget);
    await tester.tap(find.byTooltip('Close thread'));
    await tester.pumpAndSettle();
    expect(find.byType(ChatPanel), findsOneWidget);
    await tester.tap(find.text('Threads'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('1 reply · Open thread'));
    await tester.pumpAndSettle();
    expect(find.byType(ChatPanel), findsNWidgets(2));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
}
