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


def export_delta(connection, baseline):
    previous = json.loads(gzip.decompress(base64.b64decode(baseline)))['tables']
    current, _ = export_snapshot(connection)
    latest = json.loads(gzip.decompress(base64.b64decode(current)))['tables']
    changes = {}
    for name in TABLES:
        keys = [column.name for column in Base.metadata.tables[name].primary_key]
        old = {tuple(row[key] for key in keys): row for row in previous[name]}
        changes[name] = [{'before': old.get(tuple(row[key] for key in keys)), 'after': row}
                         for row in latest[name] if old.get(tuple(row[key] for key in keys)) != row]
    payload = json.dumps({'version': 2, 'tables': changes}).encode()
    return base64.b64encode(gzip.compress(payload, mtime=0)).decode(), hashlib.sha256(payload).hexdigest()


def typed_row(table, raw):
    row = dict(raw)
    for column in table.columns:
        value = row.get(column.name)
        if value is not None and isinstance(column.type, DateTime):
            row[column.name] = datetime.fromisoformat(value)
        elif value is not None and isinstance(column.type, Numeric):
            row[column.name] = Decimal(str(value))
    return row


def reset_sequences(connection, target):
    if target.dialect.name == 'postgresql':
        for name in ['users', 'channels', 'messages', 'expenses', 'tickets', 'audit_logs']:
            connection.execute(text(f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), COALESCE((SELECT MAX(id) FROM {name}), 1), EXISTS(SELECT 1 FROM {name}))"))


def import_snapshot(target, encoded, checksum):
    with gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(encoded, validate=True))) as archive:
        payload = archive.read(2 * 1024 * 1024 + 1)
    if len(payload) > 2 * 1024 * 1024 or hashlib.sha256(payload).hexdigest() != checksum:
        raise ValueError('Cloud snapshot integrity check failed')
    data = json.loads(payload)
    if data.get('version') not in (1, 2) or set(data['tables']) != TABLES:
        raise ValueError('Unsupported cloud snapshot schema')
    # Files need a separate private transfer before enabling migrations containing attachments.
    if data['tables']['attachments']:
        raise ValueError('Transfer attachment files before importing an attachment-bearing snapshot')
    with target.begin() as connection:
        if target.dialect.name == 'postgresql':
            connection.execute(text('SELECT pg_advisory_xact_lock(78245916)'))
        if data['version'] == 2:
            # Three-way cutover: update only rows unchanged since the first snapshot.
            # Preserve cloud-created records and reject conflicting edits atomically.
            for table in Base.metadata.sorted_tables:
                if table.name not in TABLES:
                    continue
                for change in data['tables'][table.name]:
                    after = typed_row(table, change['after'])
                    if table.name == 'audit_logs':
                        values = {key: value for key, value in after.items() if key != 'id'}
                        match = select(table).where(*(table.c[key] == value for key, value in values.items()))
                        if connection.execute(match).first() is None:
                            connection.execute(table.insert().values(**values))
                        continue
                    match = [column == after[column.name] for column in table.primary_key]
                    current = connection.execute(select(table).where(*match)).mappings().first()
                    if current is not None and dict(current) == after:
                        continue
                    before = typed_row(table, change['before']) if change['before'] is not None else None
                    if current is None and before is None:
                        connection.execute(table.insert().values(**after))
                    elif current is not None and dict(current) == before:
                        connection.execute(table.update().where(*match).values(**after))
                    else:
                        raise ValueError(f'Cloud migration conflict in {table.name}; no records overwritten')
            reset_sequences(connection, target)
            return True
        if any(connection.scalar(select(func.count()).select_from(Base.metadata.tables[name])) for name in TABLES):
            return False
        for table in Base.metadata.sorted_tables:
            if table.name not in TABLES:
                continue
            for raw in data['tables'][table.name]:
                row = typed_row(table, raw)
                connection.execute(table.insert().values(**row))
        reset_sequences(connection, target)
    return True


if __name__ == '__main__':
    encoded = os.getenv('INITIAL_DATA_BASE64')
    if encoded:
        migrated = import_snapshot(engine, encoded, os.environ['INITIAL_DATA_SHA256'])
        print('Private cloud data migration completed.' if migrated else 'Cloud database already populated; migration skipped.')
    delta = os.getenv('MIGRATION_DELTA_BASE64')
    if delta:
        import_snapshot(engine, delta, os.environ['MIGRATION_DELTA_SHA256'])
        print('Private cloud cutover synchronization completed.')
