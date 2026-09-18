"""Slack-style workspace endpoints. Every conversation is scoped to its viewer."""
from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from api_routes import json_login_required
from extensions import socketio
from models import db, User, Group, Message, ConversationRead
from messaging import conversation_query, serialize_message

workspace_bp = Blueprint('workspace', __name__)


@workspace_bp.errorhandler(PermissionError)
def forbidden(error):
    return jsonify(error=str(error)), 403


@workspace_bp.errorhandler(LookupError)
def not_found(error):
    return jsonify(error=str(error)), 404


@workspace_bp.errorhandler(ValueError)
def invalid(error):
    return jsonify(error=str(error)), 400


@workspace_bp.get('/workspace')
@json_login_required
def workspace():
    from socket_handlers import online_users
    groups = Group.query.filter_by(is_archived=False)
    if not current_user.role or current_user.role.name not in ['Admin', 'Owner', 'ED']:
        groups = groups.filter(Group.members.any(id=current_user.id))
    cursors = {row.conversation: row.last_message_id for row in ConversationRead.query.filter_by(user_id=current_user.id)}
    channels = []
    for group in groups.order_by(Group.name).all():
        key = f'group:{group.id}'
        unread = Message.query.filter(Message.group_id == group.id, Message.user_id != current_user.id,
                                      Message.id > cursors.get(key, 0)).count()
        channels.append({'id': group.id, 'kind': 'group', 'key': key, 'name': group.name,
                         'description': group.description, 'avatar_url': group.avatar_url,
                         'member_count': group.members.count(), 'members': [{'id': u.id} for u in group.members],
                         'created_by': group.created_by, 'unread': unread})
    people = []
    for person in User.query.filter(User.id != current_user.id, User.is_active.is_(True)).order_by(User.username):
        key = f'dm:{person.id}'
        query, _ = conversation_query('dm', person.id, current_user)
        last = query.order_by(Message.id.desc()).first()
        unread = query.filter(Message.user_id == person.id, Message.id > cursors.get(key, 0)).count()
        people.append({'id': person.id, 'kind': 'dm', 'key': key,
                       'name': person.first_name or person.username, 'username': person.username,
                       'description': 'Only you and this teammate can view this conversation.',
                       'online': person.id in online_users, 'unread': unread,
                       'last_message': last.content[:100] if last else '', 'last_id': last.id if last else 0})
    people.sort(key=lambda person: (-person['last_id'], person['name'].lower()))
    return jsonify(channels=channels, people=people)


@workspace_bp.get('/conversations/<kind>/<int:target_id>/messages')
@json_login_required
def messages(kind, target_id):
    query, _ = conversation_query(kind, target_id, current_user)
    roots = query.filter(Message.parent_id.is_(None))
    before = request.args.get('before', type=int)
    if before:
        roots = roots.filter(Message.id < before)
    rows = roots.order_by(Message.id.desc()).limit(51).all()
    has_more = len(rows) > 50
    rows = rows[:50]
    return jsonify(messages=[serialize_message(message, True) for message in reversed(rows)],
                   has_more=has_more, latest_id=query.with_entities(func.max(Message.id)).scalar() or 0)


@workspace_bp.post('/conversations/<kind>/<int:target_id>/read')
@json_login_required
def mark_read(kind, target_id):
    query, _ = conversation_query(kind, target_id, current_user)
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or type(data.get('last_message_id')) is not int or data['last_message_id'] < 0:
        raise ValueError('A valid last_message_id is required')
    requested = data['last_message_id']
    latest = query.with_entities(func.max(Message.id)).scalar() or 0
    cursor = min(requested, latest)
    key = f'{kind}:{target_id}'
    row = db.session.get(ConversationRead, (current_user.id, key))
    if not row:
        db.session.add(ConversationRead(user_id=current_user.id, conversation=key, last_message_id=0))
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()  # A simultaneous tab may have created the same cursor.
    ConversationRead.query.filter_by(user_id=current_user.id, conversation=key).filter(
        ConversationRead.last_message_id < cursor).update({'last_message_id': cursor})
    db.session.commit()
    socketio.emit('read_update', {'conversation': key}, to=f'user:{current_user.id}')
    return jsonify(success=True)


@workspace_bp.get('/conversations/<kind>/<int:target_id>/search')
@json_login_required
def search(kind, target_id):
    query, _ = conversation_query(kind, target_id, current_user)
    term = request.args.get('q', '').strip()
    if not term:
        return jsonify([])
    rows = query.filter(Message.content.contains(term, autoescape=True)).order_by(Message.id.desc()).limit(50).all()
    return jsonify([serialize_message(message) for message in rows])


@workspace_bp.get('/threads/<int:message_id>')
@json_login_required
def thread(message_id):
    message = db.get_or_404(Message, message_id)
    kind = 'group' if message.group_id else 'dm'
    target = message.group_id or (message.recipient_id if message.user_id == current_user.id else message.user_id)
    query, _ = conversation_query(kind, target, current_user)
    if not query.filter(Message.id == message_id).first():
        raise PermissionError('This thread is private')
    root = message.parent if message.parent_id else message
    return jsonify(serialize_message(root, True))
