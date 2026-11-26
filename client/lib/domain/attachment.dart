class AttachmentInfo {
  final Map<String, dynamic> data;
  const AttachmentInfo(this.data);
  String get id => data['id'] as String;
  String get filename => data['filename'] as String? ?? 'Attachment';
  int get size => (data['size'] as num?)?.toInt() ?? 0;
  String get extension {
    final dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.substring(dot + 1).toLowerCase() : '';
  }

  String get mime =>
      data['content_type'] as String? ?? 'application/octet-stream';
  String get kind =>
      data['kind'] as String? ??
      switch (extension) {
        'png' || 'jpg' || 'jpeg' || 'webp' || 'gif' => 'image',
        'pdf' => 'pdf',
        'xlsx' || 'xls' || 'xlsm' || 'ods' || 'csv' => 'spreadsheet',
        'docx' || 'doc' || 'odt' || 'rtf' => 'document',
        'pptx' || 'ppt' || 'odp' => 'presentation',
        'zip' || 'rar' || '7z' || 'gz' || 'tar' => 'archive',
        'mp3' || 'wav' || 'm4a' || 'ogg' => 'audio',
        'mp4' || 'mov' || 'webm' => 'video',
        'txt' || 'md' || 'json' || 'xml' || 'log' || 'yaml' || 'yml' => 'text',
        _ => 'file',
      };
  String? get preview => data.containsKey('preview')
      ? data['preview'] as String?
      : switch (kind) {
          'image' => 'image',
          'pdf' => 'pdf',
          _ => null,
        };
  String get label => switch (kind) {
    'image' => 'Image',
    'pdf' => 'PDF document',
    'spreadsheet' => 'Spreadsheet',
    'document' => 'Document',
    'presentation' => 'Presentation',
    'archive' => 'Archive',
    'audio' => 'Audio',
    'video' => 'Video',
    'text' => 'Text document',
    _ => 'File',
  };
  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  String get format => switch (mime) {
    'image/png' => 'PNG',
    'image/jpeg' => 'JPEG',
    'image/gif' => 'GIF',
    'image/webp' => 'WebP',
    'application/pdf' => 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' =>
      'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' =>
      'XLSX',
    _ => extension.isEmpty ? label : extension.toUpperCase(),
  };
  String get details => '$format · $formattedSize';
}
