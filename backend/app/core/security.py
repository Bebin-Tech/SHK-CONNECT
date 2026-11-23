import hashlib
import hmac
import secrets
from datetime import timedelta
from uuid import uuid4
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import AuthSession, AuditLog, User, now
from .config import get_settings

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash(secrets.token_urlsafe(32))
bearer = HTTPBearer(auto_error=False)
MANAGEMENT = {'Admin', 'Owner', 'ED'}


def hash_password(password):
    return passwords.hash(password)


def verify_password(password, encoded):
    try:
        # Read historical hashes without keeping Flask/Werkzeug in the runtime.
        # Successful legacy sign-ins are upgraded to Argon2 by the auth service.
        if encoded.startswith(('scrypt:', 'pbkdf2:')):
            method, salt, expected = encoded.split('$', 2)
            parts = method.split(':')
            if parts[0] == 'scrypt':
                n, r, p = map(int, parts[1:])
                actual = hashlib.scrypt(password.encode(), salt=salt.encode(), n=n, r=r, p=p, maxmem=256 * 1024 * 1024).hex()
            else:
                actual = hashlib.pbkdf2_hmac(parts[1], password.encode(), salt.encode(), int(parts[2])).hex()
            return hmac.compare_digest(actual, expected)
        return passwords.verify(password, encoded)
    except Exception:
        return False


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def encode(user_id, session_id, kind, minutes):
    cfg = get_settings()
    return jwt.encode({'sub': str(user_id), 'sid': session_id, 'type': kind,
        'iat': now(), 'exp': now() + timedelta(minutes=minutes), 'jti': str(uuid4()),
        'iss': cfg.jwt_issuer, 'aud': cfg.jwt_audience}, cfg.jwt_secret, algorithm='HS256')


def decode(token, kind):
    cfg = get_settings()
    try:
        claims = jwt.decode(token, cfg.jwt_secret, algorithms=['HS256'], audience=cfg.jwt_audience,
                            issuer=cfg.jwt_issuer, options={'require': ['sub', 'sid', 'exp', 'iat', 'jti', 'type']})
        if claims['type'] != kind:
            raise ValueError()
        int(claims['sub'])
        return claims
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, 'Session expired. Please sign in again.', headers={'WWW-Authenticate': 'Bearer'})


def token_pair(db, user, session=None):
    cfg = get_settings()
    if session is None:
        session = AuthSession(id=str(uuid4()), user_id=user.id, refresh_hash='',
                              expires_at=now() + timedelta(days=cfg.refresh_days))
        db.add(session)
    refresh = encode(user.id, session.id, 'refresh', cfg.refresh_days * 24 * 60)
    session.refresh_hash = digest(refresh)
    # Absolute session expiry never slides beyond the original sign-in.
    db.commit()
    return {'access_token': encode(user.id, session.id, 'access', cfg.access_minutes),
            'refresh_token': refresh, 'token_type': 'bearer', 'expires_in': cfg.access_minutes * 60}


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if not credentials:
        raise HTTPException(401, 'Authentication required', headers={'WWW-Authenticate': 'Bearer'})
    claims = decode(credentials.credentials, 'access')
    session = db.get(AuthSession, claims['sid'])
    user = db.get(User, int(claims['sub']))
    if not session or session.revoked or session.expires_at <= now() or session.user_id != int(claims['sub']) or not user or not user.is_active:
        raise HTTPException(401, 'Session expired. Please sign in again.')
    return user


def require(user, roles):
    if user.role not in roles:
        raise HTTPException(403, 'Your role cannot perform this action')


def audit(db, user, action, details=''):
    db.add(AuditLog(user_id=user.id, action=action, details=details))


def public_user(user):
    return {key: getattr(user, key) for key in ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active')}
