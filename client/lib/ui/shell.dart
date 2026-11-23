import 'dart:async';
import 'package:flutter/material.dart';
import '../domain/models.dart';
import '../state/app_controller.dart';
import 'people_page.dart';
import 'threads_page.dart';
import 'chat_panel.dart';
import 'forms.dart';
import 'theme.dart';

class WorkspaceShell extends StatefulWidget {
  final AppController app;
  const WorkspaceShell({super.key, required this.app});
  @override
  State<WorkspaceShell> createState() => _WorkspaceShellState();
}

class _WorkspaceShellState extends State<WorkspaceShell>
    with WidgetsBindingObserver {
  int section = 0;
  Conversation? selected;
  ChatMessage? threadRoot;
  final workspaceSearch = TextEditingController();
  final drafts = <String, String>{};
  Timer? timer;
  bool loading = true, refreshing = false, active = true;
  String? error;
  bool archived = false;
  bool openedInitialConversation = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    refresh();
    timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (active) refresh();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    active = state == AppLifecycleState.resumed;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    workspaceSearch.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    if (refreshing) return;
    refreshing = true;
    try {
      await widget.app.loadWorkspace();
      if (mounted) {
        setState(() {
          loading = false;
          error = null;
          if (selected != null) {
            final matches = widget.app.conversations.where(
              (c) => c.key == selected!.key,
            );
            selected = matches.isEmpty ? null : matches.first;
          }
          if (!openedInitialConversation &&
              MediaQuery.sizeOf(context).width >= 720) {
            final channels = widget.app.conversations.where(
              (c) => c.kind == 'channel' && !c.archived,
            );
            if (channels.isNotEmpty) {
              selected = channels.first;
            }
            openedInitialConversation = true;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    } finally {
      refreshing = false;
    }
  }

  Future<void> createChannel() async {
    final result = await editForm(
      context,
      title: 'Create a channel',
      fields: const [
        FieldSpec('name', 'Channel name'),
        FieldSpec('description', 'Description', required: false),
      ],
      onSave: (data) async {
        await widget.app.api.request('POST', '/channels', body: data);
      },
    );
    if (result == true) await refresh();
  }

  Future<void> manage() async {
    try {
      await manageChannel();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> manageChannel() async {
    final conversation = selected!;
    final action = await showDialog<String>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Manage channel'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.pop(context, 'settings'),
            child: const Text('Edit channel settings'),
          ),
          if (!conversation.archived)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, 'members'),
              child: const Text('Manage members'),
            ),
        ],
      ),
    );
    if (!mounted || action == null) return;
    if (action == 'settings') {
      final result = await editForm(
        context,
        title: 'Channel settings',
        fields: [
          FieldSpec('name', 'Channel name', value: conversation.name),
          FieldSpec(
            'description',
            'Description',
            value: conversation.description,
            required: false,
          ),
          FieldSpec(
            'state',
            'Channel state',
            value: conversation.archived ? 'Archived' : 'Active',
            options: const ['Active', 'Archived'],
          ),
        ],
        onSave: (data) async {
          await widget.app.api.request(
            'PATCH',
            '/channels/${conversation.id}',
            body: {
              'name': data['name'],
              'description': data['description'],
              'is_archived': data['state'] == 'Archived',
            },
          );
        },
      );
      if (result == true) await refresh();
      return;
    }
    if (!mounted || conversation.archived) return;
    final users = await widget.app.api.request('GET', '/users') as List;
    if (!mounted) return;
    final ids = conversation.memberIds.toSet();
    final save = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: const Text('Channel members'),
          content: SizedBox(
            width: 400,
            height: 340,
            child: ListView(
              children: [
                for (final u in users)
                  if (u['is_active'])
                    CheckboxListTile(
                      title: Text(u['username']),
                      subtitle: Text(u['role']),
                      value: ids.contains(u['id']),
                      onChanged: (checked) => update(() {
                        if (checked!) {
                          ids.add(u['id']);
                        } else {
                          ids.remove(u['id']);
                        }
                      }),
                    ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Save members'),
            ),
          ],
        ),
      ),
    );
    if (save == true) {
      try {
        await widget.app.api.request(
          'PUT',
          '/channels/${conversation.id}/members',
          body: {'user_ids': ids.toList()},
        );
        await refresh();
      } catch (e) {
        if (mounted) showError(context, e);
      }
    }
  }

  Future<void> profile() async {
    final user = widget.app.account!;
    await editForm(
      context,
      title: 'Your profile',
      fields: [
        FieldSpec('email', 'Email', value: user.email),
        FieldSpec(
          'first_name',
          'First name',
          value: user.firstName,
          required: false,
        ),
        FieldSpec(
          'last_name',
          'Last name',
          value: user.lastName,
          required: false,
        ),
        const FieldSpec(
          'current_password',
          'Current password (to change password)',
          secret: true,
          required: false,
        ),
        const FieldSpec(
          'new_password',
          'New password (12+ characters)',
          secret: true,
          required: false,
        ),
      ],
      onSave: (data) async {
        final values = <String, dynamic>{...data};
        if (data['new_password']!.isEmpty) {
          values.remove('new_password');
          values.remove('current_password');
        }
        await widget.app.updateProfile(values);
      },
    );
  }

  void openConversation(Conversation conversation, {ChatMessage? thread}) {
    setState(() {
      selected = conversation;
      section = conversation.kind == 'dm' ? 1 : 0;
      threadRoot = thread;
    });
    if (thread != null && MediaQuery.sizeOf(context).width < 1200) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => Scaffold(
            body: SafeArea(
              child: ChatPanel(
                app: widget.app,
                conversation: conversation,
                parent: thread,
                drafts: drafts,
                onBack: () => Navigator.of(context).pop(),
              ),
            ),
          ),
        ),
      );
    }
  }

  void navigate(int destination) {
    setState(() {
      section = destination;
      threadRoot = null;
      if (destination == 1 && selected?.kind != 'dm') selected = null;
    });
  }

  Widget accountMenu({bool light = false}) => PopupMenuButton<String>(
    tooltip: 'Account menu',
    onSelected: (value) async {
      if (value == 'profile') {
        await profile();
      } else if (value == 'audit') {
        navigate(5);
      } else {
        try {
          await widget.app.logout();
        } catch (e) {
          if (mounted) showError(context, e);
        }
      }
    },
    itemBuilder: (_) => [
      PopupMenuItem(
        enabled: false,
        child: Text(
          '${widget.app.account!.name} · ${widget.app.account!.role}',
        ),
      ),
      const PopupMenuItem(value: 'profile', child: Text('Edit profile')),
      if ({'Admin', 'Owner'}.contains(widget.app.account!.role))
        const PopupMenuItem(value: 'audit', child: Text('Workspace audit log')),
      const PopupMenuItem(value: 'logout', child: Text('Sign out')),
    ],
    child: Padding(
      padding: const EdgeInsets.all(8),
      child: Avatar(widget.app.account!.name, radius: 17),
    ),
  );

  Widget conversationTile(Conversation c, {bool dark = true}) => Material(
    color: selected?.key == c.key ? selection : Colors.transparent,
    child: ListTile(
      dense: true,
      visualDensity: const VisualDensity(vertical: -2),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18),
      leading: c.kind == 'channel'
          ? Icon(Icons.tag, color: dark ? mutedInk : Colors.black54, size: 19)
          : Stack(
              children: [
                Avatar(c.name, radius: 13),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: c.online
                          ? const Color(0xFF2BAC76)
                          : const Color(0xFF8BA2B9),
                      shape: BoxShape.circle,
                      border: Border.all(color: dark ? sidebar : Colors.white),
                    ),
                  ),
                ),
              ],
            ),
      minLeadingWidth: 18,
      horizontalTitleGap: 9,
      title: Text(
        c.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: dark
              ? ink.withValues(
                  alpha: c.unread > 0 || selected?.key == c.key ? 1 : .78,
                )
              : ink,
          fontSize: 14,
          fontWeight: c.unread > 0 ? FontWeight.w800 : FontWeight.w400,
        ),
      ),
      trailing: c.unread > 0
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
              decoration: BoxDecoration(
                color: paper,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${c.unread}',
                style: const TextStyle(
                  color: blue,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            )
          : null,
      onTap: () => openConversation(c),
    ),
  );

  Widget conversationList() {
    final needle = workspaceSearch.text.trim().toLowerCase();
    final entries = widget.app.conversations
        .where(
          (c) =>
              c.name.toLowerCase().contains(needle) &&
              c.archived == archived &&
              (section != 1 || c.kind == 'dm'),
        )
        .toList();
    return GlassPanel(
      color: sidebar,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 17, 10, 14),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFFC6DCEE))),
            ),
            child: Row(
              children: [
                const AppLogo(size: 32),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SHK Connect',
                        style: TextStyle(
                          color: ink,
                          fontWeight: FontWeight.w800,
                          fontSize: 19,
                        ),
                      ),
                      Text(
                        'Your team workspace',
                        style: TextStyle(color: mutedInk, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                if (widget.app.account!.management)
                  IconButton(
                    tooltip: 'Create channel',
                    onPressed: createChannel,
                    icon: const Icon(Icons.edit_square, color: ink, size: 20),
                  ),
              ],
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextButton(
                onPressed: refresh,
                child: Text(
                  '$error · Retry',
                  style: const TextStyle(color: ink),
                ),
              ),
            ),
          const SizedBox(height: 10),
          _sideLink(
            Icons.forum_outlined,
            'Threads',
            () => navigate(4),
            selected: section == 4,
          ),
          _sideLink(
            Icons.alternate_email,
            'Activity',
            () => navigate(2),
            selected: section == 2,
          ),
          _sideLink(
            Icons.people_outline,
            'People',
            () => navigate(3),
            selected: section == 3,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
            child: Row(
              children: [
                PopupMenuButton<bool>(
                  tooltip: 'Filter channels',
                  initialValue: archived,
                  onSelected: (v) => setState(() => archived = v),
                  itemBuilder: (_) => [
                    CheckedPopupMenuItem(
                      value: false,
                      checked: !archived,
                      child: const Text('Active conversations'),
                    ),
                    CheckedPopupMenuItem(
                      value: true,
                      checked: archived,
                      child: const Text('Archived channels'),
                    ),
                  ],
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.keyboard_arrow_down,
                          color: mutedInk,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          archived
                              ? 'Archived channels'
                              : section == 1
                              ? 'Direct messages'
                              : 'Channels',
                          style: const TextStyle(color: mutedInk, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
                if (widget.app.account!.management && !archived && section != 1)
                  IconButton(
                    tooltip: 'Add channel',
                    onPressed: createChannel,
                    icon: const Icon(Icons.add, color: mutedInk, size: 17),
                  ),
              ],
            ),
          ),
          Expanded(
            child: loading
                ? const Center(
                    child: CircularProgressIndicator(color: mutedInk),
                  )
                : RefreshIndicator(
                    onRefresh: refresh,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        for (final c in entries.where(
                          (c) => section == 1 || c.kind == 'channel',
                        ))
                          conversationTile(c),
                        if (!archived && section != 1) ...[
                          const Padding(
                            padding: EdgeInsets.fromLTRB(22, 20, 12, 6),
                            child: Text(
                              'Direct messages',
                              style: TextStyle(color: mutedInk, fontSize: 13),
                            ),
                          ),
                          for (final c in entries.where((c) => c.kind == 'dm'))
                            conversationTile(c),
                        ],
                        if (entries.isEmpty)
                          Padding(
                            padding: const EdgeInsets.all(22),
                            child: Text(
                              needle.isNotEmpty
                                  ? 'No conversations found.'
                                  : 'No conversations here yet.',
                              style: const TextStyle(color: mutedInk),
                            ),
                          ),
                      ],
                    ),
                  ),
          ),
          const Divider(color: Color(0xFFC6DCEE), height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                const Icon(Icons.circle, color: Color(0xFF2BAC76), size: 9),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    widget.app.account!.name,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: mutedInk, fontSize: 12),
                  ),
                ),
                IconButton(
                  tooltip: 'Refresh conversations',
                  onPressed: refresh,
                  icon: const Icon(Icons.sync, size: 17, color: mutedInk),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sideLink(
    IconData icon,
    String text,
    VoidCallback onTap, {
    bool selected = false,
  }) => Material(
    color: selected ? const Color(0xFFAED4F5) : Colors.transparent,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 17, color: mutedInk),
            const SizedBox(width: 11),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(color: mutedInk, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  Widget activity() {
    final unread = widget.app.conversations.where((c) => c.unread > 0).toList();
    return ColoredBox(
      color: paper,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.all(22),
            child: Text(
              'Activity',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: unread.isEmpty
                ? const EmptyState(
                    icon: Icons.notifications_none,
                    title: 'You’re all caught up',
                    subtitle: 'Unread conversations will appear here.',
                  )
                : ListView.separated(
                    itemCount: unread.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final c = unread[i];
                      return ListTile(
                        contentPadding: const EdgeInsets.all(20),
                        leading: Avatar(c.name),
                        title: Text(
                          c.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: Text(
                          '${c.unread} unread ${c.unread == 1 ? 'message' : 'messages'}',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => openConversation(c),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget workspaceRail() {
    const destinations = [
      (Icons.home_filled, 'Home'),
      (Icons.chat_bubble_outline, 'DMs'),
      (Icons.notifications_none, 'Activity'),
      (Icons.people_outline, 'People'),
    ];
    return Container(
      width: 76,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xD9D1E7FC), Color(0xB3F5F9FF)],
        ),
        border: Border(bottom: BorderSide(color: Colors.white)),
      ),
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 18),
            child: AppLogo(size: 40),
          ),
          for (var i = 0; i < destinations.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Tooltip(
                message: destinations[i].$2,
                child: InkWell(
                  onTap: () => navigate(i),
                  borderRadius: BorderRadius.circular(8),
                  child: Column(
                    children: [
                      Container(
                        width: 42,
                        height: 38,
                        decoration: BoxDecoration(
                          color: section == i
                              ? const Color(0xFFAED4F5)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(destinations[i].$1, size: 22, color: ink),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        destinations[i].$2,
                        style: const TextStyle(color: mutedInk, fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const Spacer(),
          accountMenu(light: true),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final desktop = constraints.maxWidth >= 1000,
          split = constraints.maxWidth >= 720,
          inlineThread = constraints.maxWidth >= 1200;
      final account = widget.app.account!;
      final chat = selected == null
          ? EmptyState(
              icon: section == 1 ? Icons.chat_bubble_outline : Icons.tag,
              title: section == 1
                  ? 'Your next conversation starts here'
                  : 'Welcome to your workspace',
              subtitle: section == 1
                  ? 'Choose a teammate to send a direct message.'
                  : 'Choose a channel to get everyone on the same page.',
            )
          : ChatPanel(
              key: ValueKey('${selected!.key}:${selected!.archived}'),
              app: widget.app,
              conversation: selected!,
              drafts: drafts,
              onBack: !split
                  ? () => setState(() {
                      selected = null;
                      threadRoot = null;
                    })
                  : null,
              onManage: selected!.kind == 'channel' && account.management
                  ? manage
                  : null,
              onOpenThread: inlineThread
                  ? (message) => setState(() => threadRoot = message)
                  : null,
            );
      Widget main;
      if (section == 2) {
        main = activity();
      } else if (section == 3 || section == 5) {
        main = PeoplePage(
          key: ValueKey(section),
          app: widget.app,
          audit: section == 5,
          onMessage: (c) => openConversation(c),
        );
      } else if (section == 4) {
        main = ThreadsPage(
          app: widget.app,
          onOpen: (c, m) => openConversation(c, thread: m),
        );
      } else {
        main = !split && selected == null
            ? conversationList()
            : Row(
                children: [
                  Expanded(child: chat),
                  if (inlineThread &&
                      threadRoot != null &&
                      selected != null) ...[
                    const VerticalDivider(width: 1),
                    SizedBox(
                      width: 350,
                      child: ChatPanel(
                        key: ValueKey('thread:${threadRoot!.id}'),
                        app: widget.app,
                        conversation: selected!,
                        parent: threadRoot,
                        drafts: drafts,
                        onBack: () => setState(() => threadRoot = null),
                      ),
                    ),
                  ],
                ],
              );
      }
      final searchBar = SizedBox(
        width: desktop ? 560 : double.infinity,
        height: 36,
        child: TextField(
          controller: workspaceSearch,
          style: const TextStyle(color: ink, fontSize: 13),
          onChanged: (_) => setState(() {
            if (section >= 2) section = 0;
            if (!split) selected = null;
          }),
          decoration: InputDecoration(
            hintText: 'Find a channel or teammate',
            hintStyle: const TextStyle(color: mutedInk, fontSize: 13),
            prefixIcon: const Icon(Icons.search, color: mutedInk, size: 19),
            filled: true,
            fillColor: const Color(0xD9F6FAFF),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(7),
              borderSide: const BorderSide(color: Color(0xFFC6DCEE)),
            ),
          ),
        ),
      );
      return GlassBackground(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: SafeArea(
            child: Column(
              children: [
                Container(
                  height: 52,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xD9D1E7FC), Color(0xB3F5F9FF)],
                    ),
                    border: Border(bottom: BorderSide(color: Colors.white)),
                  ),
                  child: Row(
                    children: [
                      if (desktop) const SizedBox(width: 62),
                      if (desktop)
                        const Expanded(
                          child: Text(
                            'SHK Connect',
                            style: TextStyle(color: mutedInk, fontSize: 13),
                          ),
                        ),
                      Expanded(
                        flex: desktop ? 3 : 1,
                        child: Center(child: searchBar),
                      ),
                      if (desktop)
                        Expanded(
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: IconButton(
                              tooltip: 'Unread activity',
                              onPressed: () => navigate(2),
                              icon: Badge(
                                isLabelVisible: widget.app.conversations.any(
                                  (c) => c.unread > 0,
                                ),
                                child: const Icon(
                                  Icons.notifications_none,
                                  color: ink,
                                  size: 20,
                                ),
                              ),
                            ),
                          ),
                        )
                      else
                        accountMenu(light: true),
                    ],
                  ),
                ),
                Expanded(
                  child: Row(
                    children: [
                      if (desktop) workspaceRail(),
                      if (split)
                        SizedBox(
                          width: desktop ? 250 : 240,
                          child: conversationList(),
                        ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: desktop
                              ? const BorderRadius.only(
                                  topLeft: Radius.circular(9),
                                  topRight: Radius.circular(9),
                                )
                              : BorderRadius.zero,
                          child: main,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: desktop
              ? null
              : NavigationBar(
                  selectedIndex: section < 4 ? section : 0,
                  backgroundColor: paper,
                  indicatorColor: const Color(0xFFD6EAFE),
                  onDestinationSelected: navigate,
                  destinations: const [
                    NavigationDestination(
                      icon: Icon(Icons.home_outlined),
                      selectedIcon: Icon(Icons.home_filled),
                      label: 'Home',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.chat_bubble_outline),
                      label: 'DMs',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.notifications_none),
                      label: 'Activity',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.people_outline),
                      label: 'People',
                    ),
                  ],
                ),
        ),
      );
    },
  );
}
