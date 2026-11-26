import asyncio
import json
import time
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..core.config import get_settings
from ..core.security import audit, current_user, decode, digest, require
from ..db import SessionLocal, get_db
from ..models import AuthSession, Notification, NotificationPreference, PushDevice, User, now
from ..notifications import CATEGORIES, notify, preferences, serialize
from ..schemas import Input

router = APIRouter(prefix='/notifications', tags=['Notifications'])


class PreferencesInput(Input):
    enabled: bool = True
    sound: bool = True
    show_preview: bool = False
    categories: dict[str, bool] = Field(default_factory=dict, max_length=6)


class DeviceInput(Input):
    token: str = Field(min_length=20, max_length=4096)
    platform: Literal['android', 'ios']


class PublishInput(Input):
    category: Literal['attendance', 'assignments', 'seminars', 'approvals', 'announcements']
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=2000)
    recipient_ids: list[int] = Field(min_length=1, max_length=500)
    event_key: str = Field(min_length=1, max_length=100)


@router.get('/preferences')
def get_preferences(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {**preferences(db, user.id), 'push_configured': bool(get_settings().firebase_service_account_json)}


@router.put('/preferences')
def set_preferences(data: PreferencesInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if set(data.categories) - set(CATEGORIES):
        raise HTTPException(422, 'Unknown notification category')
    row = db.get(NotificationPreference, user.id) or NotificationPreference(user_id=user.id)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    db.add(row)
    db.commit()
    return preferences(db, user.id)


@router.post('/devices')
def register_device(data: DeviceInput, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    claims = decode(request.headers['authorization'].split(' ', 1)[1], 'access')
    token_hash = digest(data.token)
    device = db.scalar(select(PushDevice).where(PushDevice.token_hash == token_hash))
    if not device:
        device = PushDevice(id=str(uuid4()), token_hash=token_hash)
    device.user_id, device.session_id = user.id, claims['sid']
    device.token, device.platform, device.enabled, device.updated_at = data.token, data.platform, True, now()
    db.add(device)
    db.commit()
    return {'id': device.id, 'push_configured': bool(get_settings().firebase_service_account_json)}


@router.delete('/devices/{device_id}', status_code=204)
def unregister_device(device_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    device = db.get(PushDevice, device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(404, 'Device not found')
    device.enabled = False
    db.commit()


@router.get('')
def inbox(after_id: int = Query(default=0, ge=0), before_id: int | None = Query(default=None, gt=0),
          limit: int = Query(default=50, ge=1, le=100), user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(Notification).where(Notification.user_id == user.id, Notification.id > after_id)
    if before_id:
        query = query.where(Notification.id < before_id)
    rows = list(db.scalars(query.order_by(Notification.id.asc() if after_id else Notification.id.desc()).limit(limit + 1)))
    return {'items': [serialize(n) for n in rows[:limit]], 'has_more': len(rows) > limit,
            'preferences': preferences(db, user.id), 'push_configured': bool(get_settings().firebase_service_account_json),
            'latest_id': db.scalar(select(func.max(Notification.id)).where(Notification.user_id == user.id)) or 0,
            'unread_count': db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)))}


@router.post('/{notification_id}/read', status_code=204)
def mark_read(notification_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(Notification, notification_id)
    if not row or row.user_id != user.id:
        raise HTTPException(404, 'Notification not found')
    row.read_at = row.read_at or now()
    db.commit()


@router.get('/item/{notification_id}')
def get_notification(notification_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(Notification, notification_id)
    if not row or row.user_id != user.id:
        raise HTTPException(404, 'Notification not found')
    return serialize(row)


@router.post('/publish', status_code=201)
def publish(data: PublishInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, {'Admin', 'Owner', 'ED', 'Manager'})
    recipients = list(db.scalars(select(User.id).where(User.id.in_(set(data.recipient_ids)), User.is_active.is_(True))))
    if len(recipients) != len(set(data.recipient_ids)):
        raise HTTPException(422, 'Select active recipients')
    # Namespace publisher-supplied keys so one staff account cannot collide with another.
    key = f'staff:{user.id}:{digest(data.event_key)}'
    rows = notify(db, recipients, data.category, data.title, data.body, key)
    audit(db, user, 'notification.publish', data.category)
    db.commit()
    return {'created': len(rows)}


def event_batch(user_id, session_id, after):
    with SessionLocal() as db:
        session, user = db.get(AuthSession, session_id), db.get(User, user_id)
        if not session or session.revoked or session.expires_at <= now() or not user or not user.is_active:
            return None
        return [serialize(n) for n in db.scalars(select(Notification).where(
            Notification.user_id == user_id, Notification.id > after).order_by(Notification.id).limit(100))]


@router.get('/events')
async def events(request: Request, after_id: int = Query(default=0, ge=0)):
    authorization = request.headers.get('authorization', '')
    if not authorization.lower().startswith('bearer '):
        raise HTTPException(401, 'Authentication required')
    token = authorization.split(' ', 1)[1]
    claims = decode(token, 'access')
    # Close the authentication DB session before holding an SSE connection open.
    with SessionLocal() as db:
        user = current_user(HTTPAuthorizationCredentials(scheme='Bearer', credentials=token), db)
        uid, sid = user.id, claims['sid']

    async def stream():
        cursor, heartbeat = after_id, 0
        yield 'retry: 3000\n\n'
        while not await request.is_disconnected():
            if time.time() >= claims['exp']:
                break
            rows = await asyncio.to_thread(event_batch, uid, sid, cursor)
            if rows is None:
                break
            for row in rows:
                cursor = row['id']
                yield f'id: {cursor}\ndata: {json.dumps(row)}\n\n'
            heartbeat += 1
            if heartbeat % 15 == 0:
                yield ': keepalive\n\n'
            await asyncio.sleep(1)
    return StreamingResponse(stream(), media_type='text/event-stream',
        headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})
