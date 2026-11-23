"""CI only: exercise real PostgreSQL transactions in a dedicated empty test DB."""
from fastapi.testclient import TestClient
from .app.core.security import hash_password
from .app.db import SessionLocal, engine
from .app.main import app
from .app.models import User


def main():
    assert engine.dialect.name == 'postgresql'
    assert engine.url.database.endswith('_test'), 'Use a dedicated database ending in _test'
    with SessionLocal() as db:
        db.add(User(username='ci-admin', email='ci@example.com', password_hash=hash_password('ci-long-password'), role='Admin'))
        db.commit()
    with TestClient(app, base_url='http://localhost') as client:
        pair = client.post('/api/v1/auth/login', json={'identifier': 'ci-admin', 'password': 'ci-long-password', 'native': True}).json()
        headers = {'Authorization': f'Bearer {pair["access_token"]}'}
        cid = client.post('/api/v1/channels', headers=headers, json={'name': 'Postgres CI'}).json()['id']
        path = f'/api/v1/conversations/channel/{cid}'
        assert client.post(f'{path}/messages', headers=headers, json={'content': 'Committed', 'client_id': 'ci-1'}).status_code == 201
        assert client.get('/api/v1/workspace', headers=headers).status_code == 200
        assert client.get(f'{path}/messages', headers=headers).json()['messages'][0]['content'] == 'Committed'
        assert client.post('/api/v1/auth/refresh', json={'refresh_token': pair['refresh_token']}).status_code == 200
    print('PostgreSQL API smoke check passed')


if __name__ == '__main__':
    main()
