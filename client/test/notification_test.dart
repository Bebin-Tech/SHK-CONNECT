import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shk_connect/core/api.dart';
import 'package:shk_connect/notifications/notification_controller.dart';

Map<String, dynamic> item(int id) => {
  'id': id,
  'category': 'assignments',
  'title': 'Assignment $id',
  'body': 'Review work',
  'read_at': null,
};

class _Api extends Api {
  final events = StreamController<Map<String, dynamic>>.broadcast();
  _Api(http.Client client)
    : super(client: client, baseUrl: 'https://test/api/v1');
  @override
  Stream<Map<String, dynamic>> notificationEvents(int afterId) => events.stream;
}

void main() {
  test(
    'Live events deduplicate, respect mute/lock and logout clears private content',
    () async {
      final api = _Api(
        MockClient((request) async {
          if (request.url.path.endsWith('/preferences')) {
            return http.Response(
              jsonEncode({
                'enabled': true,
                'sound': false,
                'show_preview': false,
                'categories': {'assignments': true},
              }),
              200,
            );
          }
          return http.Response(
            jsonEncode({
              'items': request.url.queryParameters.containsKey('after_id')
                  ? [item(11)]
                  : [item(10)],
              'latest_id': 10,
              'has_more': false,
              'unread_count': 1,
            }),
            200,
          );
        }),
      );
      final notifications = NotificationController(api, nativeEnabled: false);
      await notifications.start(1);
      expect(notifications.banner, isNull);
      api.events.add(item(11));
      api.events.add(item(11));
      await Future<void>.delayed(Duration.zero);
      expect(notifications.items.length, 2);
      expect(notifications.banner?['id'], 11);
      notifications.visibility(foreground: true, covered: true);
      expect(notifications.banner, isNull);
      api.events.add(item(12));
      await Future<void>.delayed(Duration.zero);
      expect(notifications.items.length, 2);
      await notifications.stop();
      expect(notifications.items, isEmpty);
      expect(notifications.userId, isNull);
      await api.events.close();
      notifications.dispose();
      api.dispose();
    },
  );
}
