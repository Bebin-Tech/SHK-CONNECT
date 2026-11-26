from datetime import timedelta
from csv import Error as CsvError
from pathlib import Path
from uuid import uuid4
from zipfile import BadZipFile
from xml.etree.ElementTree import ParseError
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import Session
from .. import schemas
from ..attachments import content_preview, detect_type, metadata
from ..notifications import notify
from ..conversations import message_scope, scope, serialize
from ..core.config import get_settings
from ..core.security import MANAGEMENT, audit, current_user, require
from ..db import get_db
from ..models import Attachment, Channel, Message, Presence, ReadCursor, User, now

router = APIRouter(tags=['Workspace'])


@router.get('/threads')
def threads(before: int | None = Query(default=None, gt=0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    replies = select(Message.parent_id.label('root'), func.count().label('reply_count'), func.max(Message.id).label('latest')).where(
        Message.parent_id.is_not(None)).group_by(Message.parent_id).subquery()
    channels = select(Channel.id)
    if user.role not in MANAGEMENT:
        channels = channels.where(Channel.members.any(User.id == user.id))
    query = select(Message, replies.c.reply_count, replies.c.latest).join(replies, replies.c.root == Message.id).where(
        (Message.channel_id.in_(channels)) | ((Message.channel_id.is_(None)) & ((Message.user_id == user.id) | (Message.recipient_id == user.id))))
    if before:
        query = query.where(replies.c.latest < before)
    rows = list(db.execute(query.order_by(replies.c.latest.desc()).limit(51)))
    results = []
    for message, count, latest in rows[:50]:
        if message.channel_id:
            channel = db.get(Channel, message.channel_id)
            conversation = {'id': channel.id, 'kind': 'channel', 'name': channel.name, 'description': channel.description,
                            'is_archived': channel.is_archived, 'member_ids': [m.id for m in channel.members]}
        else:
            other = db.get(User, message.recipient_id if message.user_id == user.id else message.user_id)
            if not other or not other.is_active:
                continue
            conversation = {'id': other.id, 'kind': 'dm', 'name': other.first_name or other.username}
        results.append({'message': serialize(db, message), 'conversation': conversation, 'reply_count': count, 'latest_id': latest})
    return {'threads': results, 'has_more': len(rows) > 50}


@router.get('/workspace')
def workspace(user: User = Depends(current_user), db: Session = Depends(get_db)):
    channels = select(Channel).order_by(Channel.name)
    if user.role not in MANAGEMENT:
        channels = channels.where(Channel.members.any(User.id == user.id))
    visible = list(db.scalars(channels))
    # Aggregate in SQL using indexed conversation cursors; no message history is materialized.
    channel_counts = db.execute(select(Message.channel_id, func.count()).outerjoin(ReadCursor,
        (ReadCursor.user_id == user.id) & (ReadCursor.conversation == 'channel:' + cast(Message.channel_id, String)))
        .where(Message.channel_id.in_([c.id for c in visible]), Message.user_id != user.id,
               Message.id > func.coalesce(ReadCursor.last_message_id, 0)).group_by(Message.channel_id))
    unread = {f'channel:{identifier}': count for identifier, count in channel_counts}
    dm_counts = db.execute(select(Message.user_id, func.count()).outerjoin(ReadCursor,
        (ReadCursor.user_id == user.id) & (ReadCursor.conversation == 'dm:' + cast(Message.user_id, String)))
        .where(Message.channel_id.is_(None), Message.recipient_id == user.id,
               Message.id > func.coalesce(ReadCursor.last_message_id, 0)).group_by(Message.user_id))
    unread.update({f'dm:{identifier}': count for identifier, count in dm_counts})
    presence = {p.user_id: p for p in db.scalars(select(Presence).where(Presence.last_seen > now() - timedelta(seconds=45)))}
    return {'channels': [{'id': c.id, 'kind': 'channel', 'name': c.name, 'description': c.description,
             'is_archived': c.is_archived, 'member_ids': [m.id for m in c.members],
             'unread': unread.get(f'channel:{c.id}', 0)} for c in visible],
            'people': [{'id': p.id, 'kind': 'dm', 'name': p.first_name or p.username, 'role': p.role,
             'online': p.id in presence, 'unread': unread.get(f'dm:{p.id}', 0)}
             for p in db.scalars(select(User).where(User.is_active.is_(True), User.id != user.id).order_by(User.username))]}


@router.post('/channels', status_code=201)
def create_channel(data: schemas.ChannelInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, MANAGEMENT)
    channel = Channel(**data.model_dump(), created_by=user.id, members=[user])
    db.add(channel)
    audit(db, user, 'channel.create', data.name)
    db.commit()
    return {'id': channel.id}


@router.patch('/channels/{channel_id}')
def edit_channel(channel_id: int, data: schemas.ChannelEdit, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, MANAGEMENT)
    scope(db, user, 'channel', channel_id, allow_archived=True)
    channel = db.get(Channel, channel_id)
    for key, value in data.model_dump().items():
        setattr(channel, key, value)
    audit(db, user, 'channel.update', str(channel_id))
    db.commit()
    return {'id': channel.id}


@router.put('/channels/{channel_id}/members')
def set_members(channel_id: int, data: schemas.MembersInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, MANAGEMENT)
    scope(db, user, 'channel', channel_id)
    users = list(db.scalars(select(User).where(User.id.in_(set(data.user_ids)), User.is_active.is_(True))))
    if len(users) != len(set(data.user_ids)):
        raise HTTPException(422, 'One or more users are unavailable')
    db.get(Channel, channel_id).members = users
    audit(db, user, 'channel.members', str(channel_id))
    db.commit()
    return {'member_ids': [u.id for u in users]}


@router.get('/conversations/{kind}/{target_id}/messages')
def messages(kind: str, target_id: int, before: int | None = Query(default=None, gt=0),
             after: int | None = Query(default=None, ge=0), q: str = Query(default='', max_length=100),
             parent_id: int | None = Query(default=None, gt=0), limit: int = Query(default=50, ge=1, le=100),
             user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = scope(db, user, kind, target_id, allow_archived=True)
    latest_id = db.scalar(query.with_only_columns(func.max(Message.id))) or 0
    if parent_id is not None:
        if not db.scalar(query.where(Message.id == parent_id, Message.parent_id.is_(None))):
            raise HTTPException(404, 'Thread not found in this conversation')
        query = query.where(Message.parent_id == parent_id)
    elif not q:
        query = query.where(Message.parent_id.is_(None))
    if q:
        query = query.where(Message.content.icontains(q, autoescape=True))
    if before:
        query = query.where(Message.id < before)
    if after is not None:
        query = query.where(Message.id > after)
    rows = list(db.scalars(query.order_by(Message.id.asc() if after is not None else Message.id.desc()).limit(limit + 1)))
    more = len(rows) > limit
    rows = rows[:limit]
    if after is None:
        rows.reverse()
    key = f'{kind}:{target_id}'
    typers = list(db.scalars(select(Presence).where(Presence.conversation == key, Presence.user_id != user.id,
                                                 Presence.typing_at > now() - timedelta(seconds=6))))
    if kind == 'dm':
        typers = list(db.scalars(select(Presence).where(Presence.conversation == f'dm:{user.id}',
                    Presence.user_id == target_id, Presence.typing_at > now() - timedelta(seconds=6))))
    return {'messages': [serialize(db, m) for m in rows], 'has_more': more, 'latest_id': latest_id, 'typing_user_ids': [p.user_id for p in typers]}


@router.post('/conversations/{kind}/{target_id}/messages', status_code=201)
def send(kind: str, target_id: int, data: schemas.MessageInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = scope(db, user, kind, target_id)
    if not data.content.strip() and not data.attachment_id:
        raise HTTPException(422, 'Enter a message or attach a file')
    existing = db.scalar(select(Message).where(Message.user_id == user.id, Message.client_id == data.client_id))
    if existing:
        if not db.scalar(query.where(Message.id == existing.id)):
            raise HTTPException(409, 'Client message ID already used')
        return serialize(db, existing)
    if data.parent_id and not db.scalar(query.where(Message.id == data.parent_id, Message.parent_id.is_(None))):
        raise HTTPException(422, 'Reply must belong to this conversation')
    if data.attachment_id:
        attachment = db.get(Attachment, data.attachment_id)
        if not attachment or attachment.user_id != user.id:
            raise HTTPException(403, 'Attachment does not belong to you')
        if db.scalar(select(Message).where(Message.attachment_id == attachment.id)):
            raise HTTPException(409, 'Attachment is already linked to a message')
    message = Message(**data.model_dump(), user_id=user.id,
                      channel_id=target_id if kind == 'channel' else None,
                      recipient_id=target_id if kind == 'dm' else None)
    db.add(message)
    db.flush()
    recipients = [target_id] if kind == 'dm' else [m.id for m in db.get(Channel, target_id).members if m.id != user.id]
    notify(db, recipients, 'messages', f'{user.first_name or user.username} sent a message',
           message.content or 'Shared an attachment', f'message:{message.id}', {'kind': kind, 'target_id': user.id if kind == 'dm' else target_id})
    db.commit()
    return serialize(db, message)


@router.patch('/messages/{message_id}/pin')
def pin(message_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    message = db.get(Message, message_id)
    if not message:
        raise HTTPException(404, 'Message not found')
    message_scope(db, user, message)
    message.is_pinned = not message.is_pinned
    audit(db, user, 'message.pin', str(message_id))
    db.commit()
    return serialize(db, message)


@router.post('/conversations/{kind}/{target_id}/read', status_code=204)
def mark_read(kind: str, target_id: int, data: schemas.Cursor, user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = scope(db, user, kind, target_id, allow_archived=True)
    latest = db.scalar(query.with_only_columns(func.max(Message.id))) or 0
    key = (user.id, f'{kind}:{target_id}')
    cursor = db.get(ReadCursor, key)
    if not cursor:
        cursor = ReadCursor(user_id=user.id, conversation=key[1], last_message_id=0)
        db.add(cursor)
    cursor.last_message_id = max(cursor.last_message_id, min(data.last_message_id, latest))
    db.commit()


@router.post('/presence', status_code=204)
def heartbeat(data: schemas.Heartbeat, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if data.conversation:
        kind, target = data.conversation.split(':')
        scope(db, user, kind, int(target), allow_archived=True)
    row = db.get(Presence, user.id)
    if not row:
        row = Presence(user_id=user.id)
        db.add(row)
    row.last_seen, row.conversation = now(), data.conversation
    row.typing_at = now() if data.typing else None
    db.commit()


@router.post('/attachments', status_code=201)
def upload(file: UploadFile, user: User = Depends(current_user), db: Session = Depends(get_db)):
    cfg = get_settings()
    cfg.upload_dir.mkdir(parents=True, exist_ok=True)
    identifier, size = str(uuid4()), 0
    destination = cfg.upload_dir / identifier
    try:
        with destination.open('wb') as output:
            while chunk := file.file.read(64 * 1024):
                size += len(chunk)
                if size > cfg.max_upload_bytes:
                    raise HTTPException(413, 'File exceeds 20 MB')
                output.write(chunk)
        if not size:
            raise HTTPException(422, 'Empty files are not supported')
        filename = Path((file.filename or 'attachment').replace('\\', '/')).name[:255]
        row = Attachment(id=identifier, user_id=user.id, filename=filename,
                         content_type=detect_type(destination, filename), size=size)
        db.add(row)
        db.commit()
        return metadata(row)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        file.file.close()


def accessible_attachment(attachment_id: str, user: User, db: Session):
    attachment = db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(404, 'File not found')
    if attachment.user_id != user.id:
        linked = list(db.scalars(select(Message).where(Message.attachment_id == attachment_id)))
        allowed = False
        for message in linked:
            try:
                message_scope(db, user, message)
                allowed = True
                break
            except HTTPException:
                continue
        if not allowed:
            raise HTTPException(403, 'This file is private')
    path = get_settings().upload_dir / attachment.id
    if not path.is_file():
        raise HTTPException(404, 'File is unavailable')
    return attachment, path


@router.get('/attachments/{attachment_id}')
def download(attachment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    attachment, path = accessible_attachment(attachment_id, user, db)
    return FileResponse(path, media_type=metadata(attachment)['content_type'], filename=attachment.filename,
                        headers={'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store'})


@router.get('/attachments/{attachment_id}/preview')
def preview_attachment(attachment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    attachment, path = accessible_attachment(attachment_id, user, db)
    try:
        return content_preview(path, attachment)
    except (ValueError, BadZipFile, ParseError, KeyError, RuntimeError, OSError, CsvError) as error:
        raise HTTPException(422, 'This file could not be previewed. Download the original to open it.') from error
