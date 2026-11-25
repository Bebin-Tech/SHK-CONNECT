import 'package:flutter/material.dart';
import '../domain/models.dart';
import '../state/app_controller.dart';
import 'forms.dart';
import 'theme.dart';

const roles = [
  'Admin',
  'Owner',
  'ED',
  'Manager',
  'Staff',
  'Accounts',
  'Member',
];

class PeoplePage extends StatefulWidget {
  final AppController app;
  final ValueChanged<Conversation> onMessage;
  final bool audit;
  const PeoplePage({
    super.key,
    required this.app,
    required this.onMessage,
    this.audit = false,
  });
  @override
  State<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends State<PeoplePage> {
  List<Map<String, dynamic>> rows = [];
  bool loading = true, more = false;
  String? error;
  String filter = '';
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool append = false}) async {
    try {
      final path = widget.audit
          ? '/audit?offset=${append ? rows.length : 0}&limit=50'
          : '/users';
      final data = await widget.app.api.request('GET', path) as List;
      if (!mounted) return;
      setState(() {
        rows = [
          ...(append ? rows : <Map<String, dynamic>>[]),
          ...data.cast<Map<String, dynamic>>(),
        ];
        more = widget.audit && data.length == 50;
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

  Future<void> addPerson() async {
    final saved = await editForm(
      context,
      title: 'Invite a teammate',
      fields: const [
        FieldSpec('username', 'Username'),
        FieldSpec('email', 'Email', keyboard: TextInputType.emailAddress),
        FieldSpec(
          'password',
          'Initial password (12+ characters)',
          secret: true,
        ),
        FieldSpec('first_name', 'First name', required: false),
        FieldSpec('last_name', 'Last name', required: false),
        FieldSpec('role', 'Role', value: 'Member', options: roles),
      ],
      onSave: (values) async {
        await widget.app.api.request('POST', '/users', body: values);
      },
    );
    if (saved == true) {
      await load();
      await widget.app.loadWorkspace();
    }
  }

  Future<void> manage(Map<String, dynamic> row) async {
    final saved = await editForm(
      context,
      title: 'Manage ${row['username']}',
      fields: [
        FieldSpec('role', 'Role', value: row['role'], options: roles),
        FieldSpec(
          'access',
          'Account access',
          value: row['is_active'] ? 'Active' : 'Disabled',
          options: const ['Active', 'Disabled'],
        ),
      ],
      onSave: (values) async {
        await widget.app.api.request(
          'PATCH',
          '/users/${row['id']}',
          body: {
            'role': values['role'],
            'is_active': values['access'] == 'Active',
          },
        );
      },
    );
    if (saved == true) {
      await load();
      await widget.app.loadWorkspace();
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = rows
        .where(
          (r) => '${r['username'] ?? r['action']} ${r['first_name'] ?? ''}'
              .toLowerCase()
              .contains(filter.toLowerCase()),
        )
        .toList();
    return ColoredBox(
      color: glassSurface,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.audit ? 'Workspace audit log' : 'People',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                    ),
                  ),
                ),
                if (!widget.audit && widget.app.account!.role == 'Admin')
                  FilledButton.icon(
                    onPressed: addPerson,
                    icon: const Icon(Icons.person_add_alt, size: 18),
                    label: const Text('Add people'),
                  ),
                IconButton(
                  tooltip: 'Refresh people',
                  onPressed: load,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              decoration: InputDecoration(
                hintText: widget.audit ? 'Filter activity' : 'Find a person',
                prefixIcon: const Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => filter = v),
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          if (error != null)
            MaterialBanner(
              content: Text(error!),
              actions: [
                TextButton(onPressed: load, child: const Text('Retry')),
              ],
            ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                ? const EmptyState(
                    icon: Icons.people_outline,
                    title: 'No results',
                    subtitle: 'Try another name.',
                  )
                : ListView.separated(
                    itemCount: filtered.length + (more ? 1 : 0),
                    separatorBuilder: (_, _) =>
                        const Divider(height: 1, indent: 20),
                    itemBuilder: (_, i) {
                      if (i == filtered.length) {
                        return TextButton(
                          onPressed: () => load(append: true),
                          child: const Text('Load more'),
                        );
                      }
                      final row = filtered[i];
                      if (widget.audit) {
                        return ListTile(
                          title: Text(row['action']),
                          subtitle: Text(
                            '${row['details']}\n${row['created_at']}',
                          ),
                          isThreeLine: true,
                        );
                      }
                      final self = row['id'] == widget.app.account!.id;
                      final name = (row['first_name'] ?? '').toString().isEmpty
                          ? row['username'] as String
                          : row['first_name'] as String;
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 8,
                        ),
                        leading: Avatar(name),
                        title: Text(
                          '$name${self ? ' (you)' : ''}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Text(
                          '${row['role']} · ${row['is_active'] ? 'Active' : 'Disabled'}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (!self && row['is_active'])
                              IconButton(
                                tooltip: 'Message $name',
                                icon: const Icon(Icons.chat_bubble_outline),
                                onPressed: () => widget.onMessage(
                                  Conversation(
                                    id: row['id'],
                                    kind: 'dm',
                                    name: name,
                                  ),
                                ),
                              ),
                            if (widget.app.account!.role == 'Admin')
                              IconButton(
                                tooltip: 'Manage account',
                                onPressed: () => manage(row),
                                icon: const Icon(Icons.more_horiz),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
