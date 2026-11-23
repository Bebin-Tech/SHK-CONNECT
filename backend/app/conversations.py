from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from .core.security import MANAGEMENT
from .models import Attachment, Channel, Message, User


def scope(db, user, kind, target_id, allow_archived=False):
    if kind == 'channel':
        channel = db.get(Channel, target_id)
        if not channel:
            raise HTTPException(404, 'Channel not found')
        if user.role not in MANAGEMENT and user.id not in {member.id for member in channel.members}:
            raise HTTPException(403, 'Channel membership required')
        if channel.is_archived and not allow_archived:
            raise HTTPException(409, 'Channel is archived')
        return select(Message).where(Message.channel_id == target_id)
    if kind == 'dm':
        recipient = db.get(User, target_id)
        if not recipient or target_id == user.id or not recipient.is_active:
            raise HTTPException(404, 'Teammate not available')
        return select(Message).where(Message.channel_id.is_(None), or_(
            and_(Message.user_id == user.id, Message.recipient_id == target_id),
            and_(Message.user_id == target_id, Message.recipient_id == user.id)))
    raise HTTPException(404, 'Unknown conversation')


def message_scope(db, user, message):
    if message.channel_id:
        return scope(db, user, 'channel', message.channel_id, allow_archived=True)
    if user.id not in (message.user_id, message.recipient_id):
        raise HTTPException(403, 'Private conversation')
    target = message.recipient_id if message.user_id == user.id else message.user_id
    return scope(db, user, 'dm', target)


def serialize(db, message):
    attachment = db.get(Attachment, message.attachment_id) if message.attachment_id else None
    return {'id': message.id, 'user_id': message.user_id, 'author': message.author.first_name or message.author.username,
            'content': message.content, 'parent_id': message.parent_id, 'is_pinned': message.is_pinned,
            'created_at': message.created_at.isoformat() + 'Z',
            'attachment': {'id': attachment.id, 'filename': attachment.filename, 'size': attachment.size} if attachment else None}
