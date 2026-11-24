"""One-time private-network migration into an empty cloud database.

Transfer the compressed snapshot through the hosting provider's private variables,
not a public import API or a public database port. Existing databases are never
overwritten. Remove INITIAL_DATA_BASE64 after a successful migration.
"""
import base64
import gzip
import hashlib
import io
import json
import os
from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, Numeric, func, select, text
from .app.db import Base, engine
from .app import models

TABLES = {'users', 'channels', 'channel_members', 'messages', 'attachments',
          'read_cursors', 'expenses', 'tickets', 'audit_logs'}


def export_snapshot(connection):
    tables = {}
    for table in Base.metadata.sorted_tables:
        if table.name in TABLES:
            tables[table.name] = [dict(row) for row in connection.execute(select(table)).mappings()]
            if 'id' in table.c:
                tables[table.name].sort(key=lambda row: row['id'])
    payload = json.dumps({'version': 1, 'tables': tables}, default=lambda value: value.isoformat() if isinstance(value, datetime) else str(value)).encode()
    return base64.b64encode(gzip.compress(payload, mtime=0)).decode(), hashlib.sha256(payload).hexdigest()


def import_snapshot(target, encoded, checksum):
    with gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(encoded, validate=True))) as archive:
        payload = archive.read(2 * 1024 * 1024 + 1)
    if len(payload) > 2 * 1024 * 1024 or hashlib.sha256(payload).hexdigest() != checksum:
        raise ValueError('Cloud snapshot integrity check failed')
    data = json.loads(payload)
    if data.get('version') != 1 or set(data['tables']) != TABLES:
        raise ValueError('Unsupported cloud snapshot schema')
    # Files need a separate private transfer before enabling migrations containing attachments.
    if data['tables']['attachments']:
        raise ValueError('Transfer attachment files before importing an attachment-bearing snapshot')
    with target.begin() as connection:
        if target.dialect.name == 'postgresql':
            connection.execute(text('SELECT pg_advisory_xact_lock(78245916)'))
        if any(connection.scalar(select(func.count()).select_from(Base.metadata.tables[name])) for name in TABLES):
            return False
        for table in Base.metadata.sorted_tables:
            if table.name not in TABLES:
                continue
            for raw in data['tables'][table.name]:
                row = dict(raw)
                for column in table.columns:
                    value = row.get(column.name)
                    if value is not None and isinstance(column.type, DateTime):
                        row[column.name] = datetime.fromisoformat(value)
                    elif value is not None and isinstance(column.type, Numeric):
                        row[column.name] = Decimal(str(value))
                connection.execute(table.insert().values(**row))
        if target.dialect.name == 'postgresql':
            for name in ['users', 'channels', 'messages', 'expenses', 'tickets', 'audit_logs']:
                connection.execute(text(f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), COALESCE((SELECT MAX(id) FROM {name}), 1), EXISTS(SELECT 1 FROM {name}))"))
    return True


if __name__ == '__main__':
    encoded = os.getenv('INITIAL_DATA_BASE64')
    if encoded:
        migrated = import_snapshot(engine, encoded, os.environ['INITIAL_DATA_SHA256'])
        print('Private cloud data migration completed.' if migrated else 'Cloud database already populated; migration skipped.')
