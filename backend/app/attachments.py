"""Attachment metadata and bounded, read-only Office/text previews."""
import csv
import io
import mimetypes
from pathlib import Path
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree as ET

MIMES = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel', '.doc': 'application/msword',
    '.csv': 'text/csv', '.md': 'text/markdown', '.json': 'application/json',
}


def detect_type(path: Path, filename: str) -> str:
    with path.open('rb') as source:
        head = source.read(512)
    for signature, mime in [(b'\x89PNG\r\n\x1a\n', 'image/png'), (b'\xff\xd8\xff', 'image/jpeg'),
                            (b'GIF87a', 'image/gif'), (b'GIF89a', 'image/gif'), (b'%PDF-', 'application/pdf')]:
        if head.startswith(signature):
            return mime
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'image/webp'
    if head.startswith(b'PK\x03\x04'):
        try:
            with ZipFile(path) as archive:
                names = set(archive.namelist())
                for marker, ext in [('word/document.xml', '.docx'), ('xl/workbook.xml', '.xlsx'), ('ppt/presentation.xml', '.pptx')]:
                    if marker in names and '[Content_Types].xml' in names:
                        return MIMES[ext]
        except BadZipFile:
            pass
        return 'application/zip'
    ext = Path(filename).suffix.lower()
    mime = MIMES.get(ext) or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    # Image and PDF previews require a matching signature, never just a renamed file.
    if mime.startswith('image/') or mime == 'application/pdf':
        return 'application/octet-stream'
    return mime


def metadata(row):
    mime = row.content_type
    ext = Path(row.filename).suffix.lower()
    kind = ('image' if mime in {'image/png', 'image/jpeg', 'image/gif', 'image/webp'} else
            'pdf' if mime == 'application/pdf' else
            'spreadsheet' if mime == MIMES['.xlsx'] or ext in {'.xlsx', '.xls', '.xlsm', '.csv', '.ods'} else
            'document' if mime == MIMES['.docx'] or ext in {'.doc', '.docx', '.odt', '.rtf'} else
            'presentation' if mime == MIMES['.pptx'] or ext in {'.ppt', '.pptx', '.odp'} else
            'archive' if ext in {'.zip', '.7z', '.rar', '.gz', '.tar'} else
            'audio' if mime.startswith('audio/') else 'video' if mime.startswith('video/') else
            'text' if mime.startswith('text/') or ext in {'.json', '.xml', '.yaml', '.yml', '.log'} else 'file')
    preview = ('image' if kind == 'image' else 'pdf' if kind == 'pdf' else
               'table' if mime in {'text/csv', MIMES['.xlsx']} else
               'text' if mime == MIMES['.docx'] or kind == 'text' else None)
    return {'id': row.id, 'filename': row.filename, 'size': row.size,
            'content_type': mime, 'kind': kind, 'preview': preview}


def content_preview(path: Path, row):
    """Never executes formulas, macros, links, HTML or embedded document content."""
    info = metadata(row)
    if info['preview'] not in {'table', 'text'}:
        raise ValueError('Preview is not available for this format. Download the original to open it.')
    if row.content_type in {MIMES['.docx'], MIMES['.xlsx']}:
        with ZipFile(path) as archive:
            if len(archive.infolist()) > 2000:
                raise ValueError('This document is too complex to preview.')
            budget = 8 * 1024 * 1024

            def xml(name):
                nonlocal budget
                member = archive.getinfo(name)
                if member.file_size > min(budget, 2 * 1024 * 1024):
                    raise ValueError('This document is too large to preview. Download the original.')
                budget -= member.file_size
                raw = archive.read(member)
                # Office XML does not need entity declarations or a DTD.
                probe = raw.replace(b'\x00', b'').upper()
                if b'<!DOCTYPE' in probe or b'<!ENTITY' in probe:
                    raise ValueError('Unsupported document XML.')
                return ET.fromstring(raw)

            if row.content_type == MIMES['.docx']:
                root = xml('word/document.xml')
                text = '\n'.join(''.join(t.text or '' for t in p.findall('.//{*}t')) for p in root.findall('.//{*}p'))
                return {'type': 'text', 'text': text[:30000], 'truncated': len(text) > 30000,
                        'note': 'Text preview. Download the original for full formatting.'}
            strings = []
            if 'xl/sharedStrings.xml' in archive.namelist():
                strings = [''.join(t.text or '' for t in si.findall('.//{*}t')) for si in xml('xl/sharedStrings.xml')]
            workbook = xml('xl/workbook.xml')
            relations = {r.attrib['Id']: r.attrib['Target'] for r in xml('xl/_rels/workbook.xml.rels')}
            sheets = []
            for sheet in workbook.findall('.//{*}sheet')[:5]:
                rid = sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                target = relations.get(rid, '')
                name = target.lstrip('/') if target.startswith('/') else 'xl/' + target
                if not name.startswith('xl/worksheets/') or '..' in name:
                    continue
                rows = []
                sheet_xml = xml(name)
                all_rows = sheet_xml.findall('.//{*}sheetData/{*}row')
                for r in all_rows[:50]:
                    cells = [''] * 12
                    for c in r.findall('{*}c'):
                        ref = c.attrib.get('r', '')
                        column = 0
                        for char in ref:
                            if not char.isalpha():
                                break
                            column = column * 26 + ord(char.upper()) - 64
                            if column > 12:
                                break
                        if not 1 <= column <= 12:
                            continue
                        value = c.findtext('{*}v', default='')
                        if c.attrib.get('t') == 's':
                            value = strings[int(value)] if value.isdigit() and int(value) < len(strings) else ''
                        elif c.attrib.get('t') == 'inlineStr':
                            value = ''.join(t.text or '' for t in c.findall('.//{*}t'))
                        elif c.attrib.get('t') == 'b':
                            value = 'TRUE' if value == '1' else 'FALSE'
                        elif c.find('{*}f') is not None and not value:
                            value = '=' + (c.findtext('{*}f') or '')
                        cells[column - 1] = value[:500]
                    rows.append(cells)
                sheets.append({'name': sheet.attrib.get('name', 'Sheet'), 'rows': rows})
            return {'type': 'table', 'sheets': sheets,
                    'truncated': True, 'note': 'Values preview: up to 5 sheets, 50 rows and 12 columns. Formatting and macros are not included.'}
    with path.open('rb') as source:
        raw = source.read(128 * 1024)
    text = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig', errors='replace')
    if Path(row.filename).suffix.lower() == '.csv':
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=',;\t|')
        except csv.Error:
            dialect = csv.excel
        rows = []
        for i, values in enumerate(csv.reader(io.StringIO(text), dialect)):
            if i >= 50:
                break
            rows.append([v[:500] for v in values[:12]])
        width = max((len(r) for r in rows), default=0)
        rows = [r + [''] * (width - len(r)) for r in rows]
        return {'type': 'table', 'sheets': [{'name': row.filename, 'rows': rows}], 'truncated': True,
                'note': 'Values preview: up to 50 rows and 12 columns.'}
    return {'type': 'text', 'text': text[:30000], 'truncated': len(text) > 30000 or row.size > len(raw)}
