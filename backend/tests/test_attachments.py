import io
from zipfile import ZipFile

import pytest
from backend.app.db import SessionLocal
from backend.app.models import Attachment

PREFIX = '/api/v1/attachments'


def office(parts):
    output = io.BytesIO()
    with ZipFile(output, 'w') as archive:
        archive.writestr('[Content_Types].xml', '<Types/>')
        for name, content in parts.items():
            archive.writestr(name, content)
    return output.getvalue()


def upload(client, headers, name, data):
    result = client.post(PREFIX, headers=headers, files={'file': (name, data, 'text/html')})
    assert result.status_code == 201, result.text
    return result.json()


@pytest.mark.parametrize('name,data,kind,mime', [
    ('photo.bin', b'\x89PNG\r\n\x1a\nrest', 'image', 'image/png'),
    ('report.jpg', b'%PDF-1.7\ntest', 'pdf', 'application/pdf'),
    ('fake.png', b'<html>not an image</html>', 'file', 'application/octet-stream'),
    ('budget.XLS', b'legacy workbook', 'spreadsheet', 'application/vnd.ms-excel'),
    ('unknown.xyz123', b'bytes', 'file', 'application/octet-stream'),
])
def test_file_type_is_identified_without_trusting_upload_mime(client, auth, name, data, kind, mime):
    headers, _ = auth()
    item = upload(client, headers, name, data)
    assert (item['kind'], item['content_type'], item['size']) == (kind, mime, len(data))
    response = client.get(f'{PREFIX}/{item["id"]}', headers=headers)
    assert response.content == data
    assert response.headers['content-type'].split(';')[0] == mime
    assert response.headers['content-disposition'].startswith('attachment;')
    assert response.headers['x-content-type-options'] == 'nosniff'


def test_preview_requires_the_same_private_access_as_download(client, auth):
    alice, _ = auth('alice')
    bob, _ = auth('bob')
    admin, _ = auth()
    item = upload(client, alice, 'notes.txt', b'Private document')
    route = f'{PREFIX}/{item["id"]}/preview'
    assert client.get(route).status_code == 401
    assert client.get(route, headers=bob).status_code == 403
    assert client.get(route, headers=admin).status_code == 403
    sent = client.post('/api/v1/conversations/dm/3/messages', headers=alice,
                       json={'content': '', 'client_id': 'preview-permission', 'attachment_id': item['id']})
    assert sent.status_code == 201
    assert sent.json()['attachment']['preview'] == 'text'
    assert client.get(route, headers=bob).json()['text'] == 'Private document'
    assert client.get(route, headers=admin).status_code == 403


def test_word_excel_and_csv_previews(client, auth):
    headers, _ = auth()
    doc = office({'word/document.xml': '<document><body><p><r><t>Hello Word</t></r></p><p><r><t>Second paragraph</t></r></p></body></document>'})
    item = upload(client, headers, 'renamed.bin', doc)
    assert item['preview'] == 'text'
    result = client.get(f'{PREFIX}/{item["id"]}/preview', headers=headers).json()
    assert result['text'] == 'Hello Word\nSecond paragraph'
    book = office({
        'xl/workbook.xml': '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Costs" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/sharedStrings.xml': '<sst><si><t>Materials</t></si></sst>',
        'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>12.5</v></c></row><row r="2"><c r="B2"><f>1+2</f><v>3</v></c></row></sheetData></worksheet>',
    })
    item = upload(client, headers, 'costs.xlsx', book)
    assert item['preview'] == 'table'
    result = client.get(f'{PREFIX}/{item["id"]}/preview', headers=headers).json()
    assert result['sheets'][0]['name'] == 'Costs'
    assert result['sheets'][0]['rows'][0][:3] == ['Materials', '', '12.5']
    assert result['sheets'][0]['rows'][1][1] == '3'
    item = upload(client, headers, 'rows.csv', b'Name,Qty,Price\nWood,2\n"Bolt, steel",10,3.5')
    rows = client.get(f'{PREFIX}/{item["id"]}/preview', headers=headers).json()['sheets'][0]['rows']
    assert rows[1] == ['Wood', '2', '']
    assert rows[2] == ['Bolt, steel', '10', '3.5']


def test_corrupt_and_large_documents_fall_back_without_server_errors(client, auth):
    headers, _ = auth()
    for xml in ['not xml', '<document>' + 'x' * (2 * 1024 * 1024) + '</document>']:
        item = upload(client, headers, 'broken.docx', office({'word/document.xml': xml}))
        result = client.get(f'{PREFIX}/{item["id"]}/preview', headers=headers)
        assert result.status_code == 422
        assert client.get(f'{PREFIX}/{item["id"]}', headers=headers).status_code == 200
    item = upload(client, headers, 'large.txt', b'x' * 150000)
    preview = client.get(f'{PREFIX}/{item["id"]}/preview', headers=headers).json()
    assert len(preview['text']) == 30000 and preview['truncated']


def test_existing_generic_uploads_gain_previews_without_a_data_migration(client, auth):
    headers, _ = auth()
    doc = office({'word/document.xml': '<document><p><r><t>Existing upload</t></r></p></document>'})
    item = upload(client, headers, 'old.docx', doc)
    with SessionLocal() as db:
        db.get(Attachment, item['id']).content_type = 'application/octet-stream'
        db.commit()
    response = client.get(f'{PREFIX}/{item["id"]}/preview', headers=headers)
    assert response.json()['text'] == 'Existing upload'
    assert client.get(f'{PREFIX}/{item["id"]}', headers=headers).headers['content-type'].startswith('application/vnd.openxmlformats')
