import base64
import gzip
import hashlib
import json
import pytest
from sqlalchemy import create_engine, select
from backend.app.db import Base, SessionLocal
from backend.app.models import User, Message
from backend.cloud_seed import TABLES, export_snapshot, import_snapshot


def test_private_cloud_migration_preserves_accounts_and_is_idempotent(client, auth):
    headers, _ = auth()
    channel = client.post('/api/v1/channels', headers=headers, json={'name': 'Migration test'}).json()['id']
    client.post(f'/api/v1/conversations/channel/{channel}/messages', headers=headers, json={'content': 'Keep this message', 'client_id': 'seed-test'})
    with SessionLocal() as db:
        encoded, checksum = export_snapshot(db.connection())
        expected = {u.username: u.password_hash for u in db.scalars(select(User))}
    destination = create_engine('sqlite://')
    Base.metadata.create_all(destination)
    assert import_snapshot(destination, encoded, checksum)
    assert not import_snapshot(destination, encoded, checksum)
    with destination.connect() as connection:
        actual = {row.username: row.password_hash for row in connection.execute(select(User.username, User.password_hash))}
        assert actual == expected
        assert connection.scalar(select(Message.content)) == 'Keep this message'


def test_private_cloud_migration_rejects_corrupt_snapshot():
    payload = json.dumps({'version': 1, 'tables': {name: [] for name in TABLES}}).encode()
    encoded = base64.b64encode(gzip.compress(payload)).decode()
    with pytest.raises(ValueError, match='integrity'):
        import_snapshot(create_engine('sqlite://'), encoded, hashlib.sha256(b'different').hexdigest())
