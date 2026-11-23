class Account {
  final int id;
  final String username, email, firstName, lastName, role;
  const Account(
    this.id,
    this.username,
    this.email,
    this.firstName,
    this.lastName,
    this.role,
  );
  factory Account.fromJson(Map<String, dynamic> j) => Account(
    j['id'],
    j['username'],
    j['email'],
    j['first_name'] ?? '',
    j['last_name'] ?? '',
    j['role'],
  );
  String get name =>
      firstName.isEmpty ? username : '$firstName $lastName'.trim();
  bool get management => {'Admin', 'Owner', 'ED'}.contains(role);
}

class Conversation {
  final int id, unread;
  final String kind, name, description;
  final bool archived, online;
  final List<int> memberIds;
  const Conversation({
    required this.id,
    required this.kind,
    required this.name,
    this.description = '',
    this.unread = 0,
    this.archived = false,
    this.online = false,
    this.memberIds = const [],
  });
  factory Conversation.fromJson(Map<String, dynamic> j) => Conversation(
    id: j['id'],
    kind: j['kind'],
    name: j['name'],
    description: j['description'] ?? '',
    unread: j['unread'] ?? 0,
    archived: j['is_archived'] ?? false,
    online: j['online'] ?? false,
    memberIds: List<int>.from(j['member_ids'] ?? []),
  );
  String get key => '$kind:$id';
  String get path => '/conversations/$kind/$id';
}

class ChatMessage {
  final int id, userId;
  final int? parentId;
  final String content, author;
  final DateTime createdAt;
  final bool pinned;
  final Map<String, dynamic>? attachment;
  ChatMessage.fromJson(Map<String, dynamic> j)
    : id = j['id'],
      userId = j['user_id'],
      parentId = j['parent_id'],
      content = j['content'],
      author = j['author'],
      createdAt = DateTime.parse(j['created_at']).toLocal(),
      pinned = j['is_pinned'],
      attachment = j['attachment'];
}
