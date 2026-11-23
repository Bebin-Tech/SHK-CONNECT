import os
import tempfile
from pathlib import Path

_root = Path(tempfile.mkdtemp(prefix='shk-api-tests-'))
os.environ['JWT_SECRET'] = 'test-only-signing-secret-do-not-use-in-production'
test_url = os.environ.get('SHK_TEST_DATABASE_URL')
if test_url:
    from sqlalchemy.engine import make_url
    if not (make_url(test_url).database or '').endswith('_test'):
        raise RuntimeError('Integration tests require a dedicated database ending in _test')
os.environ['DATABASE_URL'] = test_url or f'sqlite:///{(_root / "test.db").as_posix()}'
os.environ['UPLOAD_DIR'] = str(_root / 'uploads')
os.environ['ALLOW_REGISTRATION'] = 'true'

import pytest
from fastapi.testclient import TestClient
from backend.app.core.security import hash_password
from backend.app.db import Base, SessionLocal, engine
from backend.app.main import create_app
from backend.app.models import User


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for name, role in [('admin', 'Admin'), ('alice', 'Member'), ('bob', 'Member'), ('finance', 'Accounts')]:
            db.add(User(username=name, email=f'{name}@example.com', password_hash=hash_password('long-password-123'), role=role))
        db.commit()
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def auth(client):
    def login(name='admin', native=True):
        response = client.post('/api/v1/auth/login', json={'identifier': name, 'password': 'long-password-123', 'native': native})
        assert response.status_code == 200, response.text
        pair = response.json()
        return {'Authorization': f'Bearer {pair["access_token"]}'}, pair
    return login
