import 'package:flutter/material.dart';
import '../domain/models.dart';
import '../state/app_controller.dart';
import 'theme.dart';

class ThreadsPage extends StatefulWidget {
  final AppController app;
  final void Function(Conversation, ChatMessage) onOpen;
  const ThreadsPage({super.key, required this.app, required this.onOpen});
  @override
  State<ThreadsPage> createState() => _ThreadsPageState();
}

class _ThreadsPageState extends State<ThreadsPage> {
  List<Map<String, dynamic>> rows = [];
  bool loading = true, more = false;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool append = false}) async {
    try {
      final before = append && rows.isNotEmpty
          ? '?before=${rows.last['latest_id']}'
          : '';
      final data = await widget.app.api.request('GET', '/threads$before');
      if (!mounted) return;
      setState(() {
        rows = [
          ...(append ? rows : <Map<String, dynamic>>[]),
          ...List<Map<String, dynamic>>.from(data['threads']),
        ];
        more = data['has_more'];
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          loading = false;
          error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: paper,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Threads',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'Refresh threads',
                onPressed: load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        if (error != null)
          MaterialBanner(
            content: Text(error!),
            actions: [TextButton(onPressed: load, child: const Text('Retry'))],
          ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : rows.isEmpty
              ? const EmptyState(
                  icon: Icons.forum_outlined,
                  title: 'Keep the conversation going',
                  subtitle:
                      'Reply to a message in a channel or DM. Its thread will appear here.',
                )
              : RefreshIndicator(
                  onRefresh: load,
                  child: ListView.separated(
                    itemCount: rows.length + (more ? 1 : 0),
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      if (i == rows.length) {
                        return TextButton(
                          onPressed: () => load(append: true),
                          child: const Text('Load more threads'),
                        );
                      }
                      final row = rows[i],
                          conversation = Conversation.fromJson(
                            rows[i]['conversation'],
                          ),
                          message = ChatMessage.fromJson(rows[i]['message']);
                      return InkWell(
                        onTap: () => widget.onOpen(conversation, message),
                        child: Padding(
                          padding: const EdgeInsets.all(22),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${conversation.kind == 'channel' ? '#' : ''}${conversation.name}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Avatar(message.author, radius: 18),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          message.author,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          message.content.isEmpty
                                              ? 'Attachment'
                                              : message.content,
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          '${row['reply_count']} ${row['reply_count'] == 1 ? 'reply' : 'replies'} · Open thread',
                                          style: const TextStyle(
                                            color: blue,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    ),
  );
}
