import 'package:file_saver/file_saver.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';
import '../core/api.dart';
import '../domain/attachment.dart';
import 'theme.dart';

IconData attachmentIcon(String kind) => switch (kind) {
  'image' => Icons.image_outlined,
  'pdf' => Icons.picture_as_pdf_outlined,
  'spreadsheet' => Icons.table_chart_outlined,
  'document' => Icons.description_outlined,
  'presentation' => Icons.slideshow_outlined,
  'archive' => Icons.folder_zip_outlined,
  'audio' => Icons.audio_file_outlined,
  'video' => Icons.video_file_outlined,
  'text' => Icons.article_outlined,
  _ => Icons.insert_drive_file_outlined,
};

Color attachmentColor(String kind) => switch (kind) {
  'pdf' => const Color(0xFFBE4354),
  'spreadsheet' => const Color(0xFF247553),
  'presentation' => const Color(0xFFA55C20),
  'archive' || 'audio' || 'video' => const Color(0xFF7858A0),
  _ => blue,
};

class AttachmentCard extends StatefulWidget {
  final Api api;
  final Map<String, dynamic> attachment;
  final bool pending;
  final VoidCallback? onRemove;
  const AttachmentCard({
    super.key,
    required this.api,
    required this.attachment,
    this.pending = false,
    this.onRemove,
  });
  @override
  State<AttachmentCard> createState() => _AttachmentCardState();
}

class _AttachmentCardState extends State<AttachmentCard> {
  Future<Uint8List>? _bytes;
  bool saving = false;
  AttachmentInfo get file => AttachmentInfo(widget.attachment);
  Future<Uint8List> bytes() =>
      _bytes ??= widget.api.download(file.id).catchError((Object error) {
        _bytes = null;
        throw error;
      });
  @override
  void didUpdateWidget(covariant AttachmentCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.attachment['id'] != file.id) _bytes = null;
  }

  Future<void> save() async {
    if (saving) return;
    setState(() => saving = true);
    try {
      final data = await bytes();
      final dot = file.filename.lastIndexOf('.');
      final usePicker =
          !kIsWeb &&
          {
            TargetPlatform.android,
            TargetPlatform.iOS,
            TargetPlatform.macOS,
            TargetPlatform.windows,
          }.contains(defaultTargetPlatform);
      final saveFile = usePicker
          ? FileSaver.instance.saveAs
          : FileSaver.instance.saveFile;
      final path = await saveFile(
        name: dot > 0 ? file.filename.substring(0, dot) : file.filename,
        bytes: data,
        fileExtension: file.extension,
        mimeType: MimeType.custom,
        customMimeType: file.mime,
      );
      if (usePicker && path == null) return;
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Attachment saved.')));
      }
    } catch (error) {
      _bytes = null;
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  void preview() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AttachmentPreview(
          api: widget.api,
          file: file,
          loadBytes: bytes,
          onSave: save,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: 440),
    child: Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: glassSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: blueBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (file.preview == 'image' && !widget.pending)
            Semantics(
              label: 'Preview ${file.filename}',
              button: true,
              child: InkWell(
                onTap: preview,
                child: SizedBox(
                  height: 180,
                  child: FutureBuilder<Uint8List>(
                    future: bytes(),
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        return _PreviewFallback(
                          onRetry: () => setState(() => _bytes = null),
                        );
                      }
                      if (!snapshot.hasData) {
                        return const Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        );
                      }
                      return Image.memory(
                        snapshot.data!,
                        fit: BoxFit.cover,
                        cacheWidth: 880,
                        semanticLabel: file.filename,
                        errorBuilder: (_, _, _) => const Center(
                          child: Text('Image preview unavailable'),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: attachmentColor(file.kind).withValues(alpha: .09),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    attachmentIcon(file.kind),
                    color: attachmentColor(file.kind),
                    size: 25,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        file.filename,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${widget.pending ? 'Ready to send · ' : ''}${file.details}',
                        style: const TextStyle(color: mutedInk, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                if (widget.onRemove != null)
                  IconButton(
                    tooltip: 'Remove attachment',
                    onPressed: widget.onRemove,
                    icon: const Icon(Icons.close, size: 19),
                  ),
              ],
            ),
          ),
          if (!widget.pending)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: Wrap(
                spacing: 4,
                children: [
                  TextButton.icon(
                    onPressed: preview,
                    icon: Icon(
                      file.preview == null
                          ? Icons.info_outline
                          : Icons.visibility_outlined,
                      size: 17,
                    ),
                    label: Text(
                      file.preview == null ? 'File details' : 'Preview',
                    ),
                  ),
                  TextButton.icon(
                    onPressed: saving ? null : save,
                    icon: saving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download_outlined, size: 17),
                    label: Text(saving ? 'Saving…' : 'Download'),
                  ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

class _PreviewFallback extends StatelessWidget {
  final VoidCallback onRetry;
  const _PreviewFallback({required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
    child: TextButton.icon(
      onPressed: onRetry,
      icon: const Icon(Icons.refresh),
      label: const Text('Could not load preview · Retry'),
    ),
  );
}

class AttachmentPreview extends StatefulWidget {
  final Api api;
  final AttachmentInfo file;
  final Future<Uint8List> Function() loadBytes;
  final Future<void> Function() onSave;
  const AttachmentPreview({
    super.key,
    required this.api,
    required this.file,
    required this.loadBytes,
    required this.onSave,
  });
  @override
  State<AttachmentPreview> createState() => _AttachmentPreviewState();
}

class _AttachmentPreviewState extends State<AttachmentPreview> {
  late Future<Object> content = load();
  bool saving = false;
  Future<Object> load() async {
    if (widget.file.preview == 'image' || widget.file.preview == 'pdf') {
      return widget.loadBytes();
    }
    return await widget.api.request(
          'GET',
          '/attachments/${widget.file.id}/preview',
        )
        as Map<String, dynamic>;
  }

  @override
  Widget build(BuildContext context) => GlassBackground(
    child: Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.file.filename,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16),
            ),
            Text(
              widget.file.details,
              style: const TextStyle(fontSize: 11, color: mutedInk),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Download original',
            onPressed: saving
                ? null
                : () async {
                    setState(() => saving = true);
                    try {
                      await widget.onSave();
                    } finally {
                      if (mounted) setState(() => saving = false);
                    }
                  },
            icon: const Icon(Icons.download_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: widget.file.preview == null
            ? EmptyState(
                icon: attachmentIcon(widget.file.kind),
                title: widget.file.label,
                subtitle:
                    'Preview is not available for this format. Download the original to open it in a compatible app.',
              )
            : FutureBuilder<Object>(
                future: content,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.file_present_outlined,
                              size: 42,
                              color: mutedInk,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Could not preview this file. Download the original or try again.',
                              textAlign: TextAlign.center,
                            ),
                            TextButton(
                              onPressed: () => setState(() {
                                content = load();
                              }),
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }
                  if (!snapshot.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (widget.file.preview == 'image') {
                    return Center(
                      child: InteractiveViewer(
                        minScale: .5,
                        maxScale: 5,
                        child: Image.memory(
                          snapshot.data! as Uint8List,
                          cacheWidth: 2048,
                          errorBuilder: (_, _, _) => const Text(
                            'Image preview unavailable. Download the original to open it.',
                          ),
                        ),
                      ),
                    );
                  }
                  if (widget.file.preview == 'pdf') {
                    return PdfViewer.data(
                      snapshot.data! as Uint8List,
                      sourceName: widget.file.id,
                      params: PdfViewerParams(
                        errorBannerBuilder: (_, _, _, _) => const Center(
                          child: Text(
                            'PDF preview unavailable. Download the original to open it.',
                          ),
                        ),
                      ),
                    );
                  }
                  final result = snapshot.data! as Map<String, dynamic>;
                  return _ContentPreview(result: result);
                },
              ),
      ),
    ),
  );
}

class _ContentPreview extends StatelessWidget {
  final Map<String, dynamic> result;
  const _ContentPreview({required this.result});
  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (result['note'] != null || result['truncated'] == true)
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text(
            result['note'] as String? ??
                'This is a partial preview. Download the original for the complete file.',
            style: const TextStyle(color: mutedInk, fontSize: 12),
          ),
        ),
      Expanded(
        child: result['type'] == 'text'
            ? SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: SelectableText(
                    result['text'] as String? ?? '',
                    style: const TextStyle(height: 1.6),
                  ),
                ),
              )
            : ListView(
                children: [
                  for (final sheet in result['sheets'] as List? ?? [])
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            sheet['name'] as String,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 10),
                          if ((sheet['rows'] as List).isEmpty)
                            const Text('This sheet is empty.'),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Table(
                              defaultColumnWidth: const FixedColumnWidth(140),
                              border: TableBorder.all(color: blueBorder),
                              children: [
                                for (final row in sheet['rows'] as List)
                                  TableRow(
                                    children: [
                                      for (final cell in row as List)
                                        Padding(
                                          padding: const EdgeInsets.all(10),
                                          child: SelectableText(
                                            cell.toString(),
                                            maxLines: 5,
                                            style: const TextStyle(
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
      ),
    ],
  );
}
