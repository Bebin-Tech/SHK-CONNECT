import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shk_connect/core/api.dart';
import 'package:shk_connect/domain/attachment.dart';
import 'package:shk_connect/domain/models.dart';
import 'package:shk_connect/state/app_controller.dart';
import 'package:shk_connect/ui/chat_panel.dart';
import 'package:shk_connect/ui/attachment_card.dart';
import 'package:shk_connect/ui/theme.dart';

class _Picker extends FilePicker {
  PlatformFile file;
  _Picker(this.file);
  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = false,
    int compressionQuality = 0,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) async {
    expect(withReadStream, isTrue);
    expect(withData, isFalse);
    return FilePickerResult([file]);
  }
}

void main() {
  testWidgets(
    'Upload limits are checked before reading; streamed files can be sent',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var read = false;
      Stream<List<int>> data() async* {
        read = true;
        yield utf8.encode('Item,Qty\nWood,2');
      }

      final picker = _Picker(
        PlatformFile(
          name: 'huge.csv',
          size: 21 * 1024 * 1024,
          readStream: data(),
        ),
      );
      FilePicker.platform = picker;
      Map<String, dynamic>? sent;
      var uploads = 0;
      final api = Api(
        baseUrl: 'https://test/api/v1',
        client: MockClient((request) async {
          if (request.url.path.endsWith('/attachments')) {
            uploads++;
            return http.Response(
              '{"id":"upload","filename":"costs.csv","size":15,"kind":"spreadsheet","preview":"table"}',
              201,
            );
          }
          if (request.method == 'POST' &&
              request.url.path.endsWith('/messages'))
            sent = jsonDecode(request.body);
          return http.Response(
            '{"messages":[],"has_more":false,"typing_user_ids":[],"latest_id":0}',
            200,
          );
        }),
      );
      final app = AppController(api)..restoring = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: connectTheme(),
          home: Scaffold(
            body: ChatPanel(
              app: app,
              conversation: const Conversation(
                id: 1,
                kind: 'channel',
                name: 'general',
              ),
              drafts: {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Attach file'));
      await tester.pumpAndSettle();
      expect(read, isFalse);
      expect(uploads, 0);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      picker.file = PlatformFile(
        name: 'costs.csv',
        size: 15,
        readStream: data(),
      );
      await tester.tap(find.byTooltip('Attach file'));
      await tester.pumpAndSettle();
      expect(read, isTrue);
      expect(find.text('costs.csv'), findsOneWidget);
      expect(find.textContaining('Ready to send'), findsOneWidget);
      await tester.tap(find.byTooltip('Send message'));
      await tester.pumpAndSettle();
      expect(sent?['attachment_id'], 'upload');
      expect(find.text('costs.csv'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      app.dispose();
    },
  );
  test('Attachment details support legacy records and verified MIME', () {
    const legacy = AttachmentInfo({
      'id': 'old',
      'filename': 'BUDGET.XLS',
      'size': 2048,
    });
    expect(legacy.kind, 'spreadsheet');
    expect(legacy.formattedSize, '2.0 KB');
    const detected = AttachmentInfo({
      'id': 'pdf',
      'filename': 'wrong.jpg',
      'size': 1048576,
      'content_type': 'application/pdf',
      'kind': 'pdf',
      'preview': 'pdf',
    });
    expect(detected.details, 'PDF · 1.0 MB');
    const spoof = AttachmentInfo({
      'id': 'fake',
      'filename': 'fake.png',
      'kind': 'file',
      'preview': null,
    });
    expect(spoof.preview, isNull);
  });

  testWidgets(
    'Cards identify files and preview a spreadsheet on a narrow screen',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final requests = <String>[];
      final api = Api(
        baseUrl: 'https://test/api/v1',
        client: MockClient((request) async {
          requests.add(request.url.path);
          return http.Response(
            jsonEncode({
              'type': 'table',
              'note': 'Values preview',
              'sheets': [
                {
                  'name': 'Costs',
                  'rows': [
                    ['Material', 'Qty'],
                    ['Wood', '2'],
                  ],
                },
              ],
            }),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: connectTheme(),
          home: Scaffold(
            body: AttachmentCard(
              api: api,
              attachment: {
                'id': 'sheet',
                'filename': 'Materials and purchases.xlsx',
                'size': 4200,
                'kind': 'spreadsheet',
                'preview': 'table',
              },
            ),
          ),
        ),
      );
      expect(find.byIcon(Icons.table_chart_outlined), findsOneWidget);
      expect(find.textContaining('4.1 KB'), findsOneWidget);
      await tester.tap(find.text('Preview'));
      await tester.pumpAndSettle();
      expect(find.text('Wood'), findsOneWidget);
      expect(requests, ['/api/v1/attachments/sheet/preview']);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Image preview reuses its authenticated download and opens zoom view',
    (tester) async {
      var downloads = 0;
      final png = base64Decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1sAAAAASUVORK5CYII=',
      );
      final api = Api(
        baseUrl: 'https://test/api/v1',
        client: MockClient((request) async {
          downloads++;
          return http.Response.bytes(png, 200);
        }),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: connectTheme(),
          home: Scaffold(
            body: AttachmentCard(
              api: api,
              attachment: {
                'id': 'photo',
                'filename': 'photo.png',
                'size': png.length,
                'kind': 'image',
                'preview': 'image',
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(Image), findsOneWidget);
      await tester.tap(find.text('Preview'));
      await tester.pumpAndSettle();
      expect(find.byType(InteractiveViewer), findsOneWidget);
      expect(downloads, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Preview failure can retry; unsupported files show details without downloading',
    (tester) async {
      var attempts = 0;
      final api = Api(
        baseUrl: 'https://test/api/v1',
        client: MockClient((_) async {
          attempts++;
          return attempts == 1
              ? http.Response('{"detail":"Unavailable"}', 503)
              : http.Response(
                  '{"type":"text","text":"Recovered preview"}',
                  200,
                );
        }),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AttachmentCard(
              api: api,
              attachment: {
                'id': 'text',
                'filename': 'notes.docx',
                'size': 600,
                'kind': 'document',
                'preview': 'text',
              },
            ),
          ),
        ),
      );
      await tester.tap(find.text('Preview'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Could not preview'), findsOneWidget);
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(find.text('Recovered preview'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AttachmentCard(
              api: api,
              attachment: {
                'id': 'zip',
                'filename': 'archive.zip',
                'size': 5000,
                'kind': 'archive',
                'preview': null,
              },
            ),
          ),
        ),
      );
      await tester.tap(find.text('File details'));
      await tester.pumpAndSettle();
      expect(find.textContaining('compatible app'), findsOneWidget);
      expect(attempts, 2);
      expect(tester.takeException(), isNull);
    },
  );
}
