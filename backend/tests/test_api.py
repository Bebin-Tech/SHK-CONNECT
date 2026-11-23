from datetime import timedelta
from pathlib import Path
import hashlib
import sqlite3
import jwt
from alembic import command
from alembic.config import Config
from backend.app.core.config import Settings, get_settings
from backend.app.core.security import verify_password
from backend.app.db import SessionLocal
from backend.app.models import AuthSession, User, now

PREFIX = '/api/v1'


def channel(client, auth):
    admin, _ = auth()
    result = client.post(f'{PREFIX}/channels', headers=admin, json={'name': 'Operations', 'description': 'Team updates'})
    assert result.status_code == 201
    return admin, result.json()['id']


def test_authentication_validation_and_disabled_users(client, auth):
    assert client.get(f'{PREFIX}/workspace').status_code == 401
    assert client.post(f'{PREFIX}/auth/login', json={'identifier': 'admin', 'password': 'wrong'}).status_code == 401
    headers, _ = auth()
    assert client.get(f'{PREFIX}/auth/me', headers=headers).json()['role'] == 'Admin'
    assert client.patch(f'{PREFIX}/users/2', headers=headers, json={'role': 'Member', 'is_active': False}).status_code == 200
    assert client.post(f'{PREFIX}/auth/login', json={'identifier': 'alice', 'password': 'long-password-123'}).status_code == 401
    assert client.post(f'{PREFIX}/auth/register', json={'username': 'new', 'email': 'bad', 'password': 'short'}).status_code == 422


def test_refresh_rotation_reuse_and_logout_revocation(client, auth):
    headers, pair = auth()
    refreshed = client.post(f'{PREFIX}/auth/refresh', json={'refresh_token': pair['refresh_token']})
    assert refreshed.status_code == 200
    assert client.post(f'{PREFIX}/auth/refresh', json={'refresh_token': pair['refresh_token']}).status_code == 401
    assert client.get(f'{PREFIX}/auth/me', headers=headers).status_code == 401
    headers, pair = auth()
    assert client.post(f'{PREFIX}/auth/logout', headers=headers).status_code == 204
    assert client.get(f'{PREFIX}/auth/me', headers=headers).status_code == 401
    assert client.post(f'{PREFIX}/auth/refresh', json={'refresh_token': pair['refresh_token']}).status_code == 401


def test_web_cookie_csrf_and_session_expiry(client, auth):
    _, pair = auth(native=False)
    assert 'refresh_token' not in pair
    assert 'HttpOnly' in client.cookies.get('shk_refresh', '') or client.cookies.get('shk_refresh')
    assert client.post(f'{PREFIX}/auth/refresh', json={}, headers={'Origin': 'https://evil.example'}).status_code == 403
    assert client.post(f'{PREFIX}/auth/refresh', json={}, headers={'Origin': 'http://localhost:5000'}).status_code == 200
    headers, pair = auth()
    assert client.get(f'{PREFIX}/auth/me', headers={'Authorization': f'Bearer {pair["refresh_token"]}'}).status_code == 401
    with SessionLocal() as db:
        claims = jwt.decode(pair['access_token'], get_settings().jwt_secret, algorithms=['HS256'], audience='shk-clients', issuer='shk-connect')
        db.get(AuthSession, claims['sid']).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get(f'{PREFIX}/auth/me', headers=headers).status_code == 401


def test_channel_membership_threads_idempotency_and_search(client, auth):
    admin, cid = channel(client, auth)
    alice, _ = auth('alice')
    bob, _ = auth('bob')
    path = f'{PREFIX}/conversations/channel/{cid}'
    assert client.get(f'{path}/messages', headers=alice).status_code == 403
    assert client.put(f'{PREFIX}/channels/{cid}/members', headers=admin, json={'user_ids': [1, 2]}).status_code == 200
    payload = {'content': 'Team launch update', 'client_id': 'root-1'}
    root = client.post(f'{path}/messages', headers=alice, json=payload).json()
    assert client.post(f'{path}/messages', headers=alice, json=payload).json()['id'] == root['id']
    reply = client.post(f'{path}/messages', headers=admin, json={'content': 'Ready!', 'client_id': 'reply-1', 'parent_id': root['id']})
    assert reply.status_code == 201
    assert len(client.get(f'{path}/messages', headers=alice).json()['messages']) == 1
    assert len(client.get(f'{path}/messages?parent_id={root["id"]}', headers=alice).json()['messages']) == 1
    assert len(client.get(f'{path}/messages?q=launch', headers=alice).json()['messages']) == 1
    assert client.get(f'{path}/messages', headers=bob).status_code == 403
    other = client.post(f'{PREFIX}/channels', headers=admin, json={'name': 'Private'}).json()['id']
    assert client.post(f'{PREFIX}/conversations/channel/{other}/messages', headers=admin,
        json={'content': 'bad reply', 'client_id': 'bad', 'parent_id': root['id']}).status_code == 422
    assert client.post(f'{PREFIX}/channels', headers=alice, json={'name': 'Denied'}).status_code == 403


def test_dm_privacy_and_attachment_authorization(client, auth):
    alice, _ = auth('alice')
    bob, _ = auth('bob')
    admin, _ = auth()
    uploaded = client.post(f'{PREFIX}/attachments', headers=alice, files={'file': ('report.txt', b'private report', 'text/plain')})
    assert uploaded.status_code == 201
    fid = uploaded.json()['id']
    assert client.get(f'{PREFIX}/attachments/{fid}', headers=bob).status_code == 403
    sent = client.post(f'{PREFIX}/conversations/dm/3/messages', headers=alice,
        json={'content': 'Report', 'client_id': 'dm-file', 'attachment_id': fid})
    assert sent.status_code == 201
    assert client.get(f'{PREFIX}/attachments/{fid}', headers=bob).content == b'private report'
    assert client.get(f'{PREFIX}/attachments/{fid}', headers=admin).status_code == 403
    assert client.get(f'{PREFIX}/conversations/dm/2/messages', headers=admin).json()['messages'] == []
    assert client.get(f'{PREFIX}/conversations/dm/2/messages?parent_id={sent.json()["id"]}', headers=admin).status_code == 404


def test_unread_archive_presence_and_pagination(client, auth):
    admin, cid = channel(client, auth)
    client.put(f'{PREFIX}/channels/{cid}/members', headers=admin, json={'user_ids': [1, 2]})
    alice, _ = auth('alice')
    path = f'{PREFIX}/conversations/channel/{cid}'
    for i in range(4):
        assert client.post(f'{path}/messages', headers=admin, json={'content': str(i), 'client_id': str(i)}).status_code == 201
    page = client.get(f'{path}/messages?limit=2', headers=alice).json()
    assert page['has_more'] is True
    assert len(client.get(f'{path}/messages?before={page["messages"][0]["id"]}', headers=alice).json()['messages']) == 2
    assert client.get(f'{PREFIX}/workspace', headers=alice).json()['channels'][0]['unread'] == 4
    assert client.post(f'{path}/read', headers=alice, json={'last_message_id': 99999}).status_code == 204
    assert client.get(f'{PREFIX}/workspace', headers=alice).json()['channels'][0]['unread'] == 0
    assert client.post(f'{PREFIX}/presence', headers=alice, json={'conversation': f'channel:{cid}', 'typing': True}).status_code == 204
    assert client.get(f'{path}/messages', headers=admin).json()['typing_user_ids'] == [2]
    assert client.patch(f'{PREFIX}/channels/{cid}', headers=admin, json={'name': 'Operations', 'is_archived': True}).status_code == 200
    assert client.get(f'{path}/messages', headers=alice).status_code == 200
    assert client.post(f'{path}/messages', headers=alice, json={'content': 'no', 'client_id': 'archived'}).status_code == 409


def test_administration_permissions_and_removed_modules(client, auth):
    admin, _ = auth()
    alice, _ = auth('alice')
    assert client.get(f'{PREFIX}/audit', headers=alice).status_code == 403
    assert client.post(f'{PREFIX}/users', headers=alice, json={'username': 'denied', 'email': 'denied@example.com', 'password': 'long-password-123'}).status_code == 403
    created = client.post(f'{PREFIX}/users', headers=admin, json={'username': 'teammate', 'email': 'team@example.com', 'password': 'long-password-123'})
    assert created.status_code == 201
    assert any(r['action'] == 'user.create' for r in client.get(f'{PREFIX}/audit', headers=admin).json())
    for route in ['expenses', 'tickets']:
        assert client.get(f'{PREFIX}/{route}', headers=admin).status_code == 404
        assert client.post(f'{PREFIX}/{route}', headers=admin, json={}).status_code == 404
    assert 'open_tickets' not in client.get(f'{PREFIX}/dashboard', headers=admin).json()


def test_password_change_revokes_sessions_and_admin_safety(client, auth):
    admin, _ = auth()
    assert client.patch(f'{PREFIX}/users/1', headers=admin, json={'role': 'Member', 'is_active': True}).status_code == 409
    alice, _ = auth('alice')
    assert client.patch(f'{PREFIX}/auth/me', headers=alice, json={'email': 'alice@example.com', 'current_password': 'long-password-123', 'new_password': 'another-long-password'}).status_code == 200
    assert client.get(f'{PREFIX}/auth/me', headers=alice).status_code == 401


def test_thread_inbox_respects_channel_and_dm_privacy(client, auth):
    admin, cid = channel(client, auth)
    alice, _ = auth('alice')
    bob, _ = auth('bob')
    path = f'{PREFIX}/conversations/channel/{cid}/messages'
    root = client.post(path, headers=admin, json={'content': 'Channel root', 'client_id': 'thread-root'}).json()
    client.post(path, headers=admin, json={'content': 'Reply', 'client_id': 'thread-reply', 'parent_id': root['id']})
    assert client.get(f'{PREFIX}/threads', headers=admin).json()['threads'][0]['reply_count'] == 1
    assert client.get(f'{PREFIX}/threads', headers=alice).json()['threads'] == []
    client.put(f'{PREFIX}/channels/{cid}/members', headers=admin, json={'user_ids': [1, 2]})
    assert client.get(f'{PREFIX}/threads', headers=alice).json()['threads'][0]['conversation']['id'] == cid
    dm = f'{PREFIX}/conversations/dm/3/messages'
    root = client.post(dm, headers=alice, json={'content': 'Private root', 'client_id': 'private-root'}).json()
    client.post(dm, headers=alice, json={'content': 'Private reply', 'client_id': 'private-reply', 'parent_id': root['id']})
    assert len(client.get(f'{PREFIX}/threads', headers=alice).json()['threads']) == 2
    assert client.get(f'{PREFIX}/threads', headers=bob).json()['threads'][0]['message']['content'] == 'Private root'
    assert len(client.get(f'{PREFIX}/threads', headers=admin).json()['threads']) == 1


def test_rate_limit_and_origin(client):
    assert client.post(f'{PREFIX}/auth/login', headers={'Origin': 'https://evil.example'}, json={'identifier': 'admin', 'password': 'wrong'}).status_code == 403
    for _ in range(10):
        assert client.post(f'{PREFIX}/auth/login', json={'identifier': 'admin', 'password': 'wrong'}).status_code == 401
    assert client.post(f'{PREFIX}/auth/login', json={'identifier': 'admin', 'password': 'wrong'}).status_code == 429


def test_production_config_rejects_insecure_database():
    import pytest
    with pytest.raises(ValueError):
        Settings(environment='production', jwt_secret='a' * 40, database_url='sqlite://', cookie_secure=True)


def test_initial_migration_is_reversible(tmp_path, monkeypatch):
    from backend.app.core import config
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{(tmp_path / "migrated.db").as_posix()}')
    config.get_settings.cache_clear()
    cfg = Config('alembic.ini')
    try:
        command.upgrade(cfg, 'head')
        connection = sqlite3.connect(tmp_path / 'migrated.db')
        assert connection.execute("SELECT name FROM sqlite_master WHERE name='auth_sessions'").fetchone()
        command.check(cfg)
        command.downgrade(cfg, 'base')
        assert not connection.execute("SELECT name FROM sqlite_master WHERE name='users'").fetchone()
        connection.close()
    finally:
        config.get_settings.cache_clear()


def test_legacy_password_compatibility():
    salt = 'legacy-salt'
    value = hashlib.scrypt(b'old-password', salt=salt.encode(), n=32768, r=8, p=1, maxmem=128*1024*1024).hex()
    assert verify_password('old-password', f'scrypt:32768:8:1${salt}${value}')
    assert not verify_password('wrong', f'scrypt:32768:8:1${salt}${value}')


def test_case_insensitive_registration_and_no_role_escalation(client):
    data = {'username': 'NewPerson', 'email': 'NewPerson@example.com', 'password': 'long-password-123'}
    created = client.post(f'{PREFIX}/auth/register', json=data)
    assert created.status_code == 201
    assert created.json()['username'] == 'newperson'
    assert created.json()['role'] == 'Member'
    assert client.post(f'{PREFIX}/auth/register', json={**data, 'role': 'Admin'}).status_code == 422
    assert client.post(f'{PREFIX}/auth/register', json={**data, 'username': 'other'}).status_code == 409
