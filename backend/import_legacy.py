"""Explicit, transactional legacy SQLite import into an EMPTY migrated database.

The source is opened read-only. --apply is required; otherwise only counts print.
Missing legacy attachment files abort the import rather than silently dropping data.
"""
import argparse
import base64
from datetime import datetime
from decimal import Decimal
from pathlib import Path
import shutil
import sqlite3
from urllib.parse import unquote
from uuid import uuid4
from sqlalchemy import func, select, text
from .app.core.config import ROOT, get_settings
from .app.db import Base, SessionLocal
from .app.models import Attachment, AuditLog, Channel, Expense, Message, ReadCursor, Ticket, User


def dt(value):
    return datetime.fromisoformat(value) if value else datetime.now()


def import_database(source: Path, apply=False):
    source = source.resolve(strict=True)
    legacy = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)
    legacy.row_factory = sqlite3.Row
    def rows(table):
        if not legacy.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
            return []
        return [dict(r) for r in legacy.execute(f'SELECT * FROM "{table}"')]
    tables = {t: rows(t) for t in ['roles', 'users', 'groups', 'group_members', 'messages', 'expenses', 'support_tickets', 'activity_logs', 'conversation_reads']}
    print({k: len(v) for k, v in tables.items()})
    legacy.close()
    if not apply:
        print('Read-only preview. Pass --apply to import into an empty migrated destination.')
        return
    cfg = get_settings()
    copied = []
    with SessionLocal() as db:
        if any(db.scalar(select(func.count()).select_from(t)) for t in [User, Channel, Message, Expense, Ticket, AuditLog]):
            raise ValueError('Destination must be empty. Existing data was not changed.')
        try:
            roles = {r['id']: r['name'] for r in tables['roles']}
            users = {}
            for r in tables['users']:
                user = User(id=r['id'], username=r['username'], email=r['email'], password_hash=r['password_hash'],
                            first_name=r['first_name'] or '', last_name=r['last_name'] or '', role=roles.get(r['role_id'], 'Member'),
                            is_active=bool(r['is_active']), created_at=dt(r['created_at']))
                users[user.id] = user
                db.add(user)
            db.flush()
            channels = {}
            for r in tables['groups']:
                c = Channel(id=r['id'], name=r['name'], description=r['description'] or '', is_archived=bool(r['is_archived']),
                            created_by=r['created_by'] or next(iter(users)), created_at=dt(r['created_at']))
                c.members = [users[m['user_id']] for m in tables['group_members'] if m['group_id'] == c.id]
                channels[c.id] = c
                db.add(c)
            db.flush()
            for r in sorted(tables['messages'], key=lambda m: m['id']):
                attachment_id = None
                url = r['file_url']
                if url:
                    attachment_id = str(uuid4())
                    destination = cfg.upload_dir / attachment_id
                    cfg.upload_dir.mkdir(parents=True, exist_ok=True)
                    copied.append(destination)
                    if url.startswith('data:'):
                        header, payload = url.split(',', 1)
                        extension = header.split('/')[1].split(';')[0]
                        destination.write_bytes(base64.b64decode(payload, validate=True))
                        filename = f'attachment.{extension}'
                    else:
                        path = unquote(url).split('?')[0]
                        if path.startswith('/chat/uploads/'):
                            source_file = ROOT / 'instance' / 'uploads' / path.removeprefix('/chat/uploads/')
                            allowed = ROOT / 'instance' / 'uploads'
                        elif path.startswith('/static/uploads/'):
                            source_file = ROOT / 'instance' / 'legacy-static-uploads' / path.removeprefix('/static/uploads/')
                            allowed = ROOT / 'instance' / 'legacy-static-uploads'
                        else:
                            raise ValueError(f'Unsupported historical attachment URL on message {r["id"]}. Export it locally before importing.')
                        if not source_file.resolve().is_relative_to(allowed.resolve()):
                            raise ValueError('Invalid attachment path')
                        shutil.copyfile(source_file, destination)
                        filename = source_file.name
                    db.add(Attachment(id=attachment_id, user_id=r['user_id'], filename=filename,
                                      content_type='application/octet-stream', size=destination.stat().st_size))
                    db.flush()
                db.add(Message(id=r['id'], user_id=r['user_id'], channel_id=r['group_id'], recipient_id=r['recipient_id'],
                    parent_id=r['parent_id'], content=r['content'], attachment_id=attachment_id,
                    is_pinned=bool(r['is_pinned']), created_at=dt(r['timestamp'])))
                db.flush()
            for r in tables['expenses']:
                db.add(Expense(id=r['id'], amount=Decimal(str(r['amount'])).quantize(Decimal('.01')), category=r['category'] or 'General',
                    description=r['description'] or '', status='paid' if r['is_paid'] else r['status'], type=r['type'],
                    bill_date=dt(r['bill_date']), user_id=r['user_id'], created_at=dt(r['created_at'])))
            for r in tables['support_tickets']:
                db.add(Ticket(id=r['id'], subject=r['subject'], description=r['description'], status=r['status'], priority=r['priority'], user_id=r['user_id'], created_at=dt(r['created_at'])))
            for r in tables['activity_logs']:
                if r['user_id']:
                    db.add(AuditLog(id=r['id'], user_id=r['user_id'], action=r['action'], details=r['details'] or '', created_at=dt(r['timestamp'])))
            for r in tables['conversation_reads']:
                db.add(ReadCursor(user_id=r['user_id'], conversation=r['conversation'].replace('group:', 'channel:'), last_message_id=r['last_message_id']))
            db.flush()
            if db.bind.dialect.name == 'postgresql':
                for table in ['users', 'channels', 'messages', 'expenses', 'tickets', 'audit_logs']:
                    db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 1), EXISTS(SELECT 1 FROM {table}))"))
            db.commit()
            print('Import complete. Source database and original uploads were not modified.')
        except Exception:
            db.rollback()
            for path in copied:
                path.unlink(missing_ok=True)
            raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'instance' / 'shk_connect.db')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    import_database(args.source, args.apply)
