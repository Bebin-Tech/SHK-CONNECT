"""Shared conversation authorization and message serialization."""
from sqlalchemy import and_, or_
from models import db, Group, Message, User


def conversation_query(kind, target_id, user):
    if not user.is_authenticated or not user.is_active:
        raise PermissionError('Sign in to continue')
    if kind == 'group':
        target = db.session.get(Group, target_id)
        if not target:
            raise LookupError('Channel not found')
        management = user.role and user.role.name in ['Admin', 'Owner', 'ED']
        if target.is_archived or not (management or target.members.filter_by(id=user.id).first()):
            raise PermissionError('This channel is not accessible')
        query = Message.query.filter_by(group_id=target.id)
    elif kind == 'dm':
        target = db.session.get(User, target_id)
        if not target or not target.is_active or target.id == user.id:
            raise LookupError('Choose an active teammate')
        query = Message.query.filter(Message.group_id.is_(None), or_(
            and_(Message.user_id == user.id, Message.recipient_id == target.id),
            and_(Message.user_id == target.id, Message.recipient_id == user.id)))
    else:
        raise ValueError('Unknown conversation type')
    return query, target


def serialize_message(message, include_replies=False):
    author = message.author
    result = {
        'id': message.id, 'user_id': message.user_id,
        'username': author.username if author else 'Deleted user',
        'full_name': author.first_name if author else None,
        'role': author.role.name if author and author.role else 'Member',
        'content': message.content, 'group_id': message.group_id,
        'recipient_id': message.recipient_id, 'parent_id': message.parent_id,
        'file_url': message.file_url, 'msg_type': message.message_type,
        'timestamp': message.timestamp.strftime('%b %d, %I:%M %p'),
        'created_at': message.timestamp.isoformat() + 'Z',
    }
    if include_replies:
        result['replies'] = [serialize_message(reply) for reply in sorted(message.replies, key=lambda item: item.id)]
    return result


def can_read_attachment(url, user):
    from models import UploadedFile
    upload = UploadedFile.query.filter_by(url=url).first()
    if upload and upload.user_id == user.id:
        return True
    for message in Message.query.filter_by(file_url=url):
        if message.group_id:
            group = message.group
            if group and ((user.role and user.role.name in ['Admin', 'Owner', 'ED']) or group.members.filter_by(id=user.id).first()):
                return True
        elif user.id in [message.user_id, message.recipient_id]:
            return True
    return False
