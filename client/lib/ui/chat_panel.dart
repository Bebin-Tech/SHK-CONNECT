import 'dart:async';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../domain/models.dart';
import '../state/app_controller.dart';
import 'theme.dart';
import 'attachment_card.dart';

class ChatPanel extends StatefulWidget {
  final AppController app;
  final Conversation conversation;
  final ChatMessage? parent;
  final Map<String, String> drafts;
  final VoidCallback? onBack, onManage;
  final ValueChanged<ChatMessage>? onOpenThread;
  const ChatPanel({
    super.key,
    required this.app,
    required this.conversation,
    required this.drafts,
    this.parent,
    this.onBack,
    this.onManage,
    this.onOpenThread,
  });
  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel> with WidgetsBindingObserver {
  final composer = TextEditingController(), search = TextEditingController();
  final focus = FocusNode();
  List<ChatMessage> messages = [];
  Map<String, dynamic>? attachment;
  bool loading = true,
      sending = false,
      uploading = false,
      more = false,
      polling = false,
      active = true,
      typing = false,
      showSearch = false;
  String? error, pendingId, pendingContent, pendingAttachment;
  Timer? timer, searchTimer;
  DateTime lastTyping = DateTime(2000);
  String get draftKey => '${widget.conversation.key}:${widget.parent?.id ?? 0}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    composer.text = widget.drafts[draftKey] ?? '';
    composer.addListener(() {
      widget.drafts[draftKey] = composer.text;
      if (DateTime.now().difference(lastTyping).inSeconds >= 3) {
        lastTyping = DateTime.now();
        heartbeat(composer.text.isNotEmpty);
      }
    });
    load();
    timer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (active && !polling && (ModalRoute.of(context)?.isCurrent ?? true)) {
        load(silent: true);
      }
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
    searchTimer?.cancel();
    composer.dispose();
    search.dispose();
    focus.dispose();
    super.dispose();
  }

  Future<void> heartbeat(bool isTyping) async {
    try {
      await widget.app.api.request(
        'POST',
        '/presence',
        body: {'conversation': widget.conversation.key, 'typing': isTyping},
      );
    } catch (_) {
      /* next heartbeat retries */
    }
  }

  Future<void> load({bool silent = false, bool older = false}) async {
    if (polling) return;
    polling = true;
    try {
      final incremental = silent && search.text.isEmpty && messages.isNotEmpty;
      var result = await widget.app.repository.messages(
        widget.conversation,
        search: search.text.trim(),
        parent: widget.parent?.id,
        before: older && messages.isNotEmpty ? messages.first.id : null,
        after: incremental ? messages.last.id : null,
      );
      if (!mounted) return;
      // Keep previously loaded history when refreshing the most recent page.
      final byId = <int, ChatMessage>{
        if (older || (silent && search.text.isEmpty))
          for (final m in messages) m.id: m,
        for (final m in result.$1) m.id: m,
      };
      while (incremental && result.$2 && result.$1.isNotEmpty) {
        result = await widget.app.repository.messages(
          widget.conversation,
          parent: widget.parent?.id,
          after: result.$1.last.id,
        );
        for (final message in result.$1) {
          byId[message.id] = message;
        }
        if (!mounted) return;
      }
      setState(() {
        messages = byId.values.toList()..sort((a, b) => a.id.compareTo(b.id));
        if (older || !silent) more = result.$2;
        typing = result.$3;
        loading = false;
        error = null;
      });
      if (active &&
          search.text.isEmpty &&
          widget.parent == null &&
          messages.isNotEmpty) {
        await widget.app.api.request(
          'POST',
          '${widget.conversation.path}/read',
          body: {'last_message_id': result.$4},
        );
      }
      await heartbeat(false);
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    } finally {
      polling = false;
    }
  }

  Future<void> send() async {
    if (sending ||
        uploading ||
        (composer.text.trim().isEmpty && attachment == null)) {
      return;
    }
    setState(() => sending = true);
    if (pendingId == null ||
        pendingContent != composer.text.trim() ||
        pendingAttachment != attachment?['id']) {
      pendingId = const Uuid().v4();
      pendingContent = composer.text.trim();
      pendingAttachment = attachment?['id'];
    }
    try {
      await widget.app.api.request(
        'POST',
        '${widget.conversation.path}/messages',
        body: {
          'content': composer.text.trim(),
          'client_id': pendingId,
          if (widget.parent != null) 'parent_id': widget.parent!.id,
          if (attachment != null) 'attachment_id': attachment!['id'],
        },
      );
      if (!mounted) return;
      composer.clear();
      pendingId = null;
      setState(() => attachment = null);
      await load(silent: true);
      focus.requestFocus();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  Future<void> attach() async {
    if (uploading || sending) return;
    setState(() => uploading = true);
    try {
      final result = await FilePicker.platform.pickFiles(
        withData: false,
        withReadStream: true,
      );
      if (result == null || !mounted) return;
      final file = result.files.single;
      const limit = 20 * 1024 * 1024;
      if (file.size > limit) {
        throw Exception('Choose a file smaller than 20 MB.');
      }
      final buffer = BytesBuilder(copy: false);
      if (file.readStream != null) {
        await for (final chunk in file.readStream!) {
          if (!mounted) return;
          if (buffer.length + chunk.length > limit) {
            throw Exception('Choose a file smaller than 20 MB.');
          }
          buffer.add(chunk);
        }
      } else if (file.bytes != null) {
        buffer.add(file.bytes!);
      } else {
        throw Exception('Could not read this file.');
      }
      if (buffer.isEmpty) throw Exception('Empty files are not supported.');
      final value = await widget.app.api.upload(file.name, buffer.takeBytes());
      if (mounted) setState(() => attachment = value);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  void thread(ChatMessage message) {
    if (widget.onOpenThread != null) {
      widget.onOpenThread!(message);
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          body: SafeArea(
            child: ChatPanel(
              app: widget.app,
              conversation: widget.conversation,
              parent: message,
              drafts: widget.drafts,
              onBack: () => Navigator.of(context).pop(),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> pin(ChatMessage message) async {
    try {
      await widget.app.api.request('PATCH', '/messages/${message.id}/pin');
      await load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Widget messageTile(ChatMessage m) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Avatar(m.author, radius: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 9,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    m.author,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                  Text(
                    '${m.createdAt.hour.toString().padLeft(2, '0')}:${m.createdAt.minute.toString().padLeft(2, '0')}',
                    style: const TextStyle(color: Colors.black45, fontSize: 11),
                  ),
                  if (m.pinned)
                    const Icon(
                      Icons.push_pin,
                      size: 12,
                      color: Color(0xFFB56D16),
                    ),
                ],
              ),
              if (m.content.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: SelectableText(
                    m.content,
                    style: const TextStyle(fontSize: 14, height: 1.45),
                  ),
                ),
              if (m.attachment != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: AttachmentCard(
                    key: ValueKey(m.attachment!['id']),
                    api: widget.app.api,
                    attachment: m.attachment!,
                  ),
                ),
              if (widget.parent == null)
                TextButton(
                  onPressed: () => thread(m),
                  style: TextButton.styleFrom(
                    foregroundColor: blue,
                    minimumSize: const Size(44, 28),
                    padding: EdgeInsets.zero,
                  ),
                  child: const Text(
                    'Reply in thread',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
        ),
        PopupMenuButton<String>(
          tooltip: 'Message actions',
          onSelected: (_) => pin(m),
          itemBuilder: (_) => [
            PopupMenuItem(
              value: 'pin',
              child: Text(m.pinned ? 'Unpin message' : 'Pin message'),
            ),
          ],
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: glassSurface,
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: blueBorder)),
          ),
          child: Row(
            children: [
              if (widget.onBack != null)
                IconButton(
                  tooltip: widget.parent == null ? 'Back' : 'Close thread',
                  onPressed: widget.onBack,
                  icon: Icon(
                    widget.parent == null ? Icons.arrow_back : Icons.close,
                    size: 20,
                  ),
                ),
              if (widget.parent == null) ...[
                Icon(
                  widget.conversation.kind == 'channel'
                      ? Icons.tag
                      : Icons.person_outline,
                  size: 23,
                ),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.parent != null
                          ? 'Thread'
                          : widget.conversation.name,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (widget.parent == null)
                      Text(
                        widget.conversation.archived
                            ? 'Archived · read only'
                            : widget.conversation.kind == 'dm'
                            ? 'Direct message · just the two of you'
                            : widget.conversation.description.isNotEmpty
                            ? widget.conversation.description
                            : '${widget.conversation.memberIds.length} members',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.black54,
                        ),
                      ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Search messages',
                onPressed: () {
                  setState(() {
                    showSearch = !showSearch;
                    if (!showSearch) search.clear();
                  });
                  if (!showSearch) load();
                },
                icon: const Icon(Icons.search, size: 21),
              ),
              if (widget.onManage != null)
                IconButton(
                  tooltip: 'Channel settings',
                  onPressed: widget.onManage,
                  icon: const Icon(Icons.more_vert, size: 21),
                ),
            ],
          ),
        ),
        if (widget.parent == null)
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: blueBorder)),
            ),
            child: Row(
              children: [
                Container(
                  height: 36,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: blue, width: 2)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 14),
                      SizedBox(width: 7),
                      Text(
                        'Messages',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                if (widget.conversation.archived)
                  const Icon(
                    Icons.inventory_2_outlined,
                    size: 15,
                    color: Colors.black45,
                  ),
              ],
            ),
          ),
        if (widget.parent != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: blueBorder)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.parent!.author,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 5),
                SelectableText(
                  widget.parent!.content.isEmpty
                      ? 'Attachment'
                      : widget.parent!.content,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Replies',
                  style: TextStyle(color: Colors.black45, fontSize: 11),
                ),
              ],
            ),
          ),
        if (showSearch)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            child: TextField(
              controller: search,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Search this conversation',
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
              onChanged: (_) {
                searchTimer?.cancel();
                searchTimer = Timer(
                  const Duration(milliseconds: 350),
                  () => load(),
                );
              },
            ),
          ),
        if (error != null)
          MaterialBanner(
            content: Text(error!),
            actions: [
              TextButton(onPressed: () => load(), child: const Text('Retry')),
            ],
          ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : messages.isEmpty
              ? EmptyState(
                  icon: widget.parent != null
                      ? Icons.forum_outlined
                      : widget.conversation.kind == 'channel'
                      ? Icons.tag
                      : Icons.chat_bubble_outline,
                  title: search.text.isNotEmpty
                      ? 'No matching messages'
                      : widget.parent != null
                      ? 'No replies yet'
                      : 'Start a conversation',
                  subtitle: search.text.isNotEmpty
                      ? 'Try a different search.'
                      : widget.parent != null
                      ? 'Keep the details here, so the channel stays focused.'
                      : 'This is the beginning of your conversation. Share an update or say hello.',
                )
              : ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  itemCount: messages.length + (more ? 1 : 0),
                  itemBuilder: (_, index) {
                    if (index == messages.length) {
                      return TextButton(
                        onPressed: () => load(older: true),
                        child: const Text('Load earlier messages'),
                      );
                    }
                    final m = messages[messages.length - index - 1];
                    final older = index + 1 < messages.length
                        ? messages[messages.length - index - 2]
                        : null;
                    final dayStart =
                        older == null ||
                        older.createdAt.year != m.createdAt.year ||
                        older.createdAt.month != m.createdAt.month ||
                        older.createdAt.day != m.createdAt.day;
                    return Column(
                      children: [
                        if (dayStart)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(
                              children: [
                                const Expanded(child: Divider()),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: blueBorder),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Text(
                                    '${m.createdAt.day}/${m.createdAt.month}/${m.createdAt.year}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                const Expanded(child: Divider()),
                              ],
                            ),
                          ),
                        messageTile(m),
                      ],
                    );
                  },
                ),
        ),
        if (typing)
          const Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 22, vertical: 4),
              child: Text(
                'Someone is typing…',
                style: TextStyle(color: Colors.black54, fontSize: 11),
              ),
            ),
          ),
        if (!widget.conversation.archived)
          Container(
            margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            decoration: BoxDecoration(
              color: const Color(0xA6FFFFFF),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A3576AD),
                  blurRadius: 16,
                  offset: Offset(0, 4),
                ),
              ],
              border: Border.all(color: blueBorder),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                if (attachment != null)
                  Padding(
                    padding: const EdgeInsets.all(8),
                    child: AttachmentCard(
                      key: ValueKey(attachment!['id']),
                      api: widget.app.api,
                      attachment: attachment!,
                      pending: true,
                      onRemove: sending
                          ? null
                          : () => setState(() => attachment = null),
                    ),
                  ),
                TextField(
                  controller: composer,
                  focusNode: focus,
                  enabled: !sending,
                  minLines: 2,
                  maxLines: 5,
                  style: const TextStyle(fontSize: 14),
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: widget.parent != null
                        ? 'Reply to thread…'
                        : 'Message ${widget.conversation.name}…',
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 8, 6),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Attach file',
                        onPressed: sending || uploading ? null : attach,
                        icon: uploading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.add_circle_outline, size: 21),
                      ),
                      const Spacer(),
                      if (widget.parent != null)
                        const Padding(
                          padding: EdgeInsets.only(right: 8),
                          child: Text(
                            'Reply in thread',
                            style: TextStyle(
                              color: Colors.black45,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      IconButton.filled(
                        tooltip: 'Send message',
                        style: IconButton.styleFrom(
                          backgroundColor: blue,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(5),
                          ),
                        ),
                        onPressed: sending || uploading ? null : send,
                        icon: sending
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.send_rounded, size: 18),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    ),
  );
}
