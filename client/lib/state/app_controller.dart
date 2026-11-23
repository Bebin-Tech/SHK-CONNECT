import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/api.dart';
import '../data/workspace_repository.dart';
import '../domain/models.dart';

class AppController extends ChangeNotifier {
  final Api api;
  late final WorkspaceRepository repository = WorkspaceRepository(api);
  Account? account;
  bool restoring = true;
  List<Conversation> conversations = [];
  String? error;
  AppController(this.api) {
    api.onUnauthorized = _expired;
  }
  void _expired() {
    account = null;
    conversations = [];
    error = 'Your session has expired. Please sign in.';
    notifyListeners();
  }

  Future<void> initialize() async {
    try {
      await api.restore();
      account = await repository.me();
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
    error = null;
    notifyListeners();
  }

  Future<void> loadWorkspace() async {
    conversations = await repository.conversations();
    notifyListeners();
  }

  Future<void> logout() async {
    try {
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
    api.dispose();
    super.dispose();
  }
}
