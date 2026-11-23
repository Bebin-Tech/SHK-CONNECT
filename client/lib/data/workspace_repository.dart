import '../core/api.dart';
import '../domain/models.dart';

class WorkspaceRepository {
  final Api api;
  WorkspaceRepository(this.api);
  Future<Account> me() async =>
      Account.fromJson(await api.request('GET', '/auth/me'));
  Future<List<Conversation>> conversations() async {
    final data = await api.request('GET', '/workspace');
    return [
      ...data['channels'],
      ...data['people'],
    ].map<Conversation>((j) => Conversation.fromJson(j)).toList();
  }

  Future<(List<ChatMessage>, bool, bool, int)> messages(
    Conversation conversation, {
    int? before,
    int? after,
    String search = '',
    int? parent,
  }) async {
    final params = <String, String>{
      if (before != null) 'before': '$before',
      if (after != null) 'after': '$after',
      if (search.isNotEmpty) 'q': search,
      if (parent != null) 'parent_id': '$parent',
    };
    final query = params.isEmpty
        ? ''
        : '?${Uri(queryParameters: params).query}';
    final data = await api.request(
      'GET',
      '${conversation.path}/messages$query',
    );
    return (
      (data['messages'] as List).map((j) => ChatMessage.fromJson(j)).toList(),
      data['has_more'] as bool,
      (data['typing_user_ids'] as List).isNotEmpty,
      data['latest_id'] as int,
    );
  }
}
