import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session
from ..core.config import get_settings
from ..core.security import DUMMY_HASH, audit, current_user, decode, digest, hash_password, public_user, token_pair, verify_password
from ..db import get_db
from ..models import AuthSession, LoginAttempt, PushDevice, User, now
from ..schemas import Login, Profile, Refresh, Register

router = APIRouter(prefix='/auth', tags=['Authentication'])


def browser_origin(request):
    origin = request.headers.get('origin')
    if origin and origin not in get_settings().cors_origins:
        raise HTTPException(403, 'Untrusted origin')
    if request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Cross-site authentication is not allowed')


def deliver(pair, response, native):
    response.headers['Cache-Control'] = 'no-store'
    if not native:
        response.set_cookie('shk_refresh', pair.pop('refresh_token'), httponly=True, secure=get_settings().cookie_secure,
                            samesite='strict', path='/api/v1/auth', max_age=get_settings().refresh_days * 86400)
    return pair


def ensure_unique(db, username, email, exclude=None):
    query = select(User).where(or_(func.lower(User.email).in_([email.lower(), username.lower()]),
                                 func.lower(User.username).in_([email.lower(), username.lower()])))
    if exclude:
        query = query.where(User.id != exclude)
    if db.scalar(query):
        raise HTTPException(409, 'Username or email is already in use')


@router.post('/register', status_code=201)
def register(data: Register, db: Session = Depends(get_db)):
    if not get_settings().allow_registration:
        raise HTTPException(403, 'Ask your administrator to create an account')
    ensure_unique(db, data.username, str(data.email))
    user = User(**data.model_dump(exclude={'password'}), password_hash=hash_password(data.password))
    db.add(user)
    db.flush()
    audit(db, user, 'account.register')
    db.commit()
    return public_user(user)


@router.post('/login')
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    browser_origin(request)
    # Database-backed throttling works across API workers. Never trust forwarded IP headers here.
    key = digest(f'{request.client.host if request.client else "unknown"}:{data.identifier.lower()}')
    attempt = db.scalar(select(LoginAttempt).where(LoginAttempt.key == key).with_for_update())
    if not attempt:
        attempt = LoginAttempt(key=key, attempts=0, window_start=now())
        db.add(attempt)
    if attempt.window_start < now() - timedelta(minutes=15):
        attempt.attempts, attempt.window_start = 0, now()
    if attempt.attempts >= 10:
        raise HTTPException(429, 'Too many attempts. Try again in 15 minutes.', headers={'Retry-After': '900'})
    attempt.attempts += 1
    db.commit()
    user = db.scalar(select(User).where(or_(func.lower(User.email) == data.identifier.lower(),
                                            func.lower(User.username) == data.identifier.lower())))
    valid = verify_password(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not user.is_active or not valid:
        raise HTTPException(401, 'Invalid username or password')
    if not user.password_hash.startswith('$argon2'):
        user.password_hash = hash_password(data.password)
    attempt.attempts = 0
    audit(db, user, 'auth.login')
    pair = token_pair(db, user)
    pair['user'] = public_user(user)
    return deliver(pair, response, data.native)


@router.post('/refresh')
def refresh(data: Refresh, request: Request, response: Response, db: Session = Depends(get_db)):
    browser_origin(request)
    token = data.refresh_token or request.cookies.get('shk_refresh')
    if not token:
        raise HTTPException(401, 'Refresh token required')
    claims = decode(token, 'refresh')
    session = db.scalar(select(AuthSession).where(AuthSession.id == claims['sid']).with_for_update())
    user = db.get(User, int(claims['sub']))
    if not session or session.revoked or session.expires_at <= now() or session.user_id != int(claims['sub']) or not user or not user.is_active:
        raise HTTPException(401, 'Session expired')
    if not secrets.compare_digest(session.refresh_hash, digest(token)):
        session.revoked = True
        db.commit()
        raise HTTPException(401, 'Refresh token reuse detected. Sign in again.')
    pair = token_pair(db, user, session)
    pair['user'] = public_user(user)
    return deliver(pair, response, data.refresh_token is not None)


@router.post('/logout', status_code=204)
def logout(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claims = decode(request.headers['authorization'].split(' ', 1)[1], 'access')
    session = db.get(AuthSession, claims['sid'])
    session.revoked = True
    db.execute(update(PushDevice).where(PushDevice.session_id == session.id).values(enabled=False))
    audit(db, user, 'auth.logout')
    db.commit()
    response.delete_cookie('shk_refresh', path='/api/v1/auth')


@router.get('/me')
def me(user: User = Depends(current_user)):
    return public_user(user)


@router.patch('/me')
def profile(data: Profile, user: User = Depends(current_user), db: Session = Depends(get_db)):
    ensure_unique(db, user.username, str(data.email), user.id)
    if data.new_password:
        if not data.current_password or not verify_password(data.current_password, user.password_hash):
            raise HTTPException(400, 'Current password is incorrect')
        user.password_hash = hash_password(data.new_password)
        db.execute(update(AuthSession).where(AuthSession.user_id == user.id).values(revoked=True))
    user.email, user.first_name, user.last_name = str(data.email), data.first_name, data.last_name
    audit(db, user, 'profile.update')
    db.commit()
    return public_user(user)
