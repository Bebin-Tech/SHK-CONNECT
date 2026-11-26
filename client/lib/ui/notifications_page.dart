import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../notifications/notification_controller.dart';
import '../state/app_controller.dart';
import 'theme.dart';

class NotificationsPage extends StatelessWidget {
  final AppController app;
  const NotificationsPage({super.key, required this.app});
  Future<void> publish(BuildContext context) async {
    try {
      final people = await app.api.request('GET', '/users') as List;
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => _PublishDialog(app: app, people: people),
      );
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notifications = app.notifications;
    return GlassBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: const Text('Notifications')),
        floatingActionButton:
            {'Admin', 'Owner', 'ED', 'Manager'}.contains(app.account?.role)
            ? FloatingActionButton.extended(
                onPressed: () => publish(context),
                icon: const Icon(Icons.campaign_outlined),
                label: const Text('Publish update'),
              )
            : null,
        body: notifications == null
            ? const EmptyState(
                icon: Icons.notifications_none,
                title: 'No notifications',
                subtitle: 'Updates will appear here.',
              )
            : ListenableBuilder(
                listenable: notifications,
                builder: (context, _) => RefreshIndicator(
                  onRefresh: notifications.sync,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                    children: [
                      if (notifications.error != null)
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(notifications.error!),
                        ),
                      if (notifications.items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(32),
                          child: Column(
                            children: [
                              Icon(
                                Icons.notifications_none,
                                size: 44,
                                color: blue,
                              ),
                              SizedBox(height: 16),
                              Text('You’re all caught up'),
                            ],
                          ),
                        ),
                      for (final item in notifications.items)
                        Card(
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(16),
                            leading: Icon(
                              _categoryIcon(item['category']),
                              color: item['read_at'] == null ? blue : mutedInk,
                            ),
                            title: Text(
                              item['title'] as String,
                              style: TextStyle(
                                fontWeight: item['read_at'] == null
                                    ? FontWeight.w700
                                    : FontWeight.w400,
                              ),
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                '${notificationCategories[item['category']] ?? 'Update'} · ${_date(item['created_at'])}\n${item['body']}',
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            trailing: item['read_at'] == null
                                ? const Icon(Icons.circle, size: 8, color: blue)
                                : null,
                            onTap: () async {
                              try {
                                await notifications.read(item);
                                if (!context.mounted) return;
                                showModalBottomSheet<void>(
                                  context: context,
                                  showDragHandle: true,
                                  isScrollControlled: true,
                                  builder: (_) => SafeArea(
                                    child: SingleChildScrollView(
                                      padding: const EdgeInsets.all(24),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item['title'] as String,
                                            style: const TextStyle(
                                              fontSize: 22,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          const SizedBox(height: 12),
                                          SelectableText(
                                            item['body'] as String,
                                            style: const TextStyle(height: 1.5),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              } catch (error) {
                                if (context.mounted) showError(context, error);
                              }
                            },
                          ),
                        ),
                      if (notifications.hasMore)
                        TextButton(
                          onPressed: () async {
                            try {
                              await notifications.loadOlder();
                            } catch (error) {
                              if (context.mounted) showError(context, error);
                            }
                          },
                          child: const Text('Load earlier notifications'),
                        ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }
}

String _date(dynamic value) {
  final date = DateTime.tryParse(value.toString())?.toLocal();
  if (date == null) return '';
  return '${date.day}/${date.month} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

IconData _categoryIcon(dynamic category) => switch (category) {
  'attendance' => Icons.fact_check_outlined,
  'assignments' => Icons.assignment_outlined,
  'seminars' => Icons.school_outlined,
  'approvals' => Icons.task_alt,
  'announcements' => Icons.campaign_outlined,
  _ => Icons.chat_bubble_outline,
};

class _PublishDialog extends StatefulWidget {
  final AppController app;
  final List people;
  const _PublishDialog({required this.app, required this.people});
  @override
  State<_PublishDialog> createState() => _PublishDialogState();
}

class _PublishDialogState extends State<_PublishDialog> {
  final title = TextEditingController(), body = TextEditingController();
  final recipients = <int>{};
  final form = GlobalKey<FormState>();
  final eventKey = const Uuid().v4();
  String category = 'announcements';
  bool busy = false;
  @override
  void dispose() {
    title.dispose();
    body.dispose();
    super.dispose();
  }

  Future<void> send() async {
    if (!form.currentState!.validate() || busy) return;
    if (recipients.isEmpty) {
      showError(context, 'Select at least one recipient.');
      return;
    }
    setState(() => busy = true);
    try {
      await widget.app.api.request(
        'POST',
        '/notifications/publish',
        body: {
          'category': category,
          'title': title.text.trim(),
          'body': body.text.trim(),
          'recipient_ids': recipients.toList(),
          'event_key': eventKey,
        },
      );
      if (mounted) Navigator.pop(context);
    } catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Publish an update'),
    content: SizedBox(
      width: 480,
      child: SingleChildScrollView(
        child: Form(
          key: form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: category,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Activity'),
                items: [
                  for (final entry in notificationCategories.entries)
                    if (entry.key != 'messages')
                      DropdownMenuItem(
                        value: entry.key,
                        child: Text(entry.value),
                      ),
                ],
                onChanged: busy ? null : (v) => setState(() => category = v!),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: title,
                enabled: !busy,
                maxLength: 160,
                decoration: const InputDecoration(labelText: 'Title'),
                validator: (v) => v!.trim().isEmpty ? 'Enter a title' : null,
              ),
              TextFormField(
                controller: body,
                enabled: !busy,
                maxLength: 2000,
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(labelText: 'Update'),
                validator: (v) => v!.trim().isEmpty ? 'Enter the update' : null,
              ),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Recipients',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              for (final person in widget.people)
                if (person['is_active'] == true)
                  CheckboxListTile(
                    dense: true,
                    title: Text(person['username'] as String),
                    value: recipients.contains(person['id']),
                    onChanged: busy
                        ? null
                        : (checked) => setState(() {
                            if (checked!) {
                              recipients.add(person['id'] as int);
                            } else {
                              recipients.remove(person['id']);
                            }
                          }),
                  ),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: busy ? null : () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: busy ? null : send,
        child: Text(busy ? 'Publishing…' : 'Publish'),
      ),
    ],
  );
}
