import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'http_client.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, [this.status = 0]);
  @override
  String toString() => message;
}

class Api {
  final http.Client client;
  final FlutterSecureStorage storage;
  final String baseUrl;
  String? _access;
  String? _refresh;
  Future<void>? _refreshing;
  VoidCallback? onUnauthorized;

  Api({http.Client? client, FlutterSecureStorage? storage, String? baseUrl})
    : client = client ?? createHttpClient(),
      storage = storage ?? const FlutterSecureStorage(),
      baseUrl = baseUrl ?? _defaultUrl();

  static String _defaultUrl() {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured.replaceAll(RegExp(r'/$'), '');
    if (kIsWeb) return '${Uri.base.origin}/api/v1';
    // Android emulator maps the host loopback to 10.0.2.2.
    return 'http://${defaultTargetPlatform == TargetPlatform.android ? '10.0.2.2' : '127.0.0.1'}:5000/api/v1';
  }

  Future<void> _accept(Map<String, dynamic> tokens) async {
    _access = tokens['access_token'] as String;
    if (!kIsWeb && tokens['refresh_token'] != null) {
      _refresh = tokens['refresh_token'] as String;
      await storage.write(key: 'shk_refresh', value: _refresh);
    }
  }

  Future<void> login(String identifier, String password) async {
    final result = await request(
      'POST',
      '/auth/login',
      body: {'identifier': identifier, 'password': password, 'native': !kIsWeb},
      authenticated: false,
    );
    await _accept(result as Map<String, dynamic>);
  }

  Future<void> restore() async {
    if (!kIsWeb) _refresh = await storage.read(key: 'shk_refresh');
    await _rotate();
  }

  Future<void> _rotate() async {
    if (_refreshing != null) return _refreshing!;
    final future = _doRotate();
    _refreshing = future;
    try {
      await future;
    } finally {
      _refreshing = null;
    }
  }

  Future<void> _doRotate() async {
    if (!kIsWeb && _refresh == null) throw ApiException('Please sign in', 401);
    final result = await request(
      'POST',
      '/auth/refresh',
      body: kIsWeb ? {} : {'refresh_token': _refresh},
      authenticated: false,
    );
    await _accept(result as Map<String, dynamic>);
  }

  Future<void> clear() async {
    _access = null;
    _refresh = null;
    if (!kIsWeb) await storage.delete(key: 'shk_refresh');
  }

  Future<void> logout() async {
    try {
      await request('POST', '/auth/logout');
    } finally {
      await clear();
    }
  }

  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    bool authenticated = true,
    bool retry = true,
  }) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    if (authenticated && _access != null) {
      request.headers['Authorization'] = 'Bearer $_access';
    }
    if (body != null) request.body = jsonEncode(body);
    http.Response response;
    try {
      response = await http.Response.fromStream(
        await client.send(request).timeout(const Duration(seconds: 25)),
      );
    } on Exception {
      throw ApiException(
        'Cannot reach the server. Check your connection and try again.',
      );
    }
    if (response.statusCode == 401 && authenticated && retry) {
      try {
        await _rotate();
      } catch (_) {
        await clear();
        onUnauthorized?.call();
        rethrow;
      }
      return this.request(
        method,
        path,
        body: body,
        authenticated: true,
        retry: false,
      );
    }
    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    dynamic result;
    try {
      result = response.body.isEmpty ? null : jsonDecode(response.body);
    } catch (_) {
      throw ApiException(
        'Unexpected response from the server.',
        response.statusCode,
      );
    }
    if (response.statusCode >= 400) {
      final detail = result is Map ? result['detail'] : null;
      throw ApiException(
        detail is String ? detail : 'Check the entered values and try again.',
        response.statusCode,
      );
    }
    return result;
  }

  Future<Map<String, dynamic>> upload(
    String filename,
    Uint8List bytes, {
    bool retry = true,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/attachments'),
    );
    request.headers['Authorization'] = 'Bearer $_access';
    request.files.add(
      http.MultipartFile.fromBytes('file', bytes, filename: filename),
    );
    final response = await http.Response.fromStream(
      await client.send(request).timeout(const Duration(seconds: 60)),
    );
    if (response.statusCode == 401 && retry) {
      await _rotate();
      return upload(filename, bytes, retry: false);
    }
    return _decode(response) as Map<String, dynamic>;
  }

  Future<Uint8List> download(String id, {bool retry = true}) async {
    final response = await client
        .get(
          Uri.parse('$baseUrl/attachments/$id'),
          headers: {'Authorization': 'Bearer $_access'},
        )
        .timeout(const Duration(seconds: 60));
    if (response.statusCode == 401 && retry) {
      await _rotate();
      return download(id, retry: false);
    }
    if (response.statusCode >= 400) _decode(response);
    return response.bodyBytes;
  }

  void dispose() => client.close();

  Stream<Map<String, dynamic>> notificationEvents(int afterId) async* {
    var cursor = afterId;
    while (true) {
      final request = http.Request(
        'GET',
        Uri.parse('$baseUrl/notifications/events?after_id=$cursor'),
      );
      request.headers['Authorization'] = 'Bearer $_access';
      request.headers['Accept'] = 'text/event-stream';
      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 20));
      if (response.statusCode == 401) {
        await response.stream.drain<void>();
        await _rotate();
        continue;
      }
      if (response.statusCode != 200) {
        await response.stream.drain<void>();
        throw ApiException('Could not connect to live notifications.');
      }
      await for (final line
          in response.stream
              .transform(utf8.decoder)
              .transform(const LineSplitter())) {
        if (line.startsWith('data: ')) {
          final item = jsonDecode(line.substring(6)) as Map<String, dynamic>;
          cursor = item['id'] as int;
          yield item;
        }
      }
      await Future<void>.delayed(const Duration(seconds: 2));
    }
  }
}
