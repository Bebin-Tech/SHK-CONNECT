from flask import request
from flask_socketio import emit, join_room, leave_room
from models import db, Message, User, Group
from flask_login import current_user
from datetime import datetime, timezone
from messaging import conversation_query, serialize_message, can_read_attachment

user_connections = {}
online_users = {}  # { user_id: { username, role } }

def user_can_access_group(group, user):
    if not user.is_authenticated or not group or group.is_archived:
        return False

    role = user.role
    role_name = role.name if role else 'Member'

    # Management Tier (Admin, Owner, ED) always have access
    if role_name in ['Admin', 'Owner', 'ED']:
        return True

    # Check if user is a direct member
    is_member = group.members.filter_by(id=user.id).first() is not None
    return is_member

def sync_group_rooms(socketio, group):
    for user_id, connections in list(user_connections.items()):
        user = db.session.get(User, user_id)
        allowed = user and user.is_active and user_can_access_group(group, user)
        for sid in list(connections):
            action = socketio.server.enter_room if allowed else socketio.server.leave_room
            action(sid, str(group.id), namespace='/')

def disconnect_user(socketio, user_id):
    """Revoke live transports when account access changes or the user logs out."""
    for sid in list(user_connections.get(user_id, ())):
        socketio.server.disconnect(sid, namespace='/')
    user_connections.pop(user_id, None)
    online_users.pop(user_id, None)

def register_socket_handlers(socketio):

    @socketio.on('connect')
    def handle_connect(auth=None):
        if not current_user.is_authenticated or not current_user.is_active:
            return False
        if current_user.is_authenticated:
            user_id = current_user.id
            join_room(f'user:{user_id}')
            user_connections.setdefault(user_id, set()).add(request.sid)
            online_users[user_id] = {
                'id': user_id,
                'username': current_user.username,
                'role': current_user.role.name if current_user.role else 'Member'
            }

            # Join rooms for all groups the user has access to
            try:
                # Use a join or efficient query if possible, but for now:
                active_groups = Group.query.filter_by(is_archived=False).all()
                for group in active_groups:
                    if user_can_access_group(group, current_user):
                        join_room(str(group.id))
            except Exception as e:
                print(f"Socket connect room join error: {e}")

            emit('presence_update', {'online': list(online_users.values())}, broadcast=True)

    @socketio.on('disconnect')
    def handle_disconnect(reason=None):
        # The HTTP session may already be disabled/deleted; identify the
        # connection by SID instead of relying on a still-authenticated user.
        for user_id, connections in list(user_connections.items()):
            if request.sid in connections:
                connections.discard(request.sid)
                if not connections:
                    user_connections.pop(user_id, None)
                    online_users.pop(user_id, None)
                break
        emit('presence_update', {'online': list(online_users.values())}, broadcast=True)

    @socketio.on('join')
    def on_join(data):
        if not current_user.is_authenticated:
            return

        if not isinstance(data, dict):
            return
        raw_id = data.get('group_id')
        if not raw_id:
            return

        try:
            group_id = int(raw_id)
            group = db.session.get(Group, group_id)
            if group and user_can_access_group(group, current_user):
                join_room(str(group_id))
        except Exception:
            pass

    @socketio.on('send_message')
    def handle_message(data):
        def fail(message):
            emit('error', {'message': message})
            return {'ok': False, 'error': message}

        if not current_user.is_authenticated or not current_user.is_active:
            return fail('Not authenticated')
        if not isinstance(data, dict):
            return fail('Invalid message')
        try:
            if bool(data.get('group_id')) == bool(data.get('recipient_id')):
                return fail('Choose one conversation')
            kind = 'group' if data.get('group_id') else 'dm'
            target_id = int(data.get('group_id') or data.get('recipient_id'))
            query, target = conversation_query(kind, target_id, current_user)
            content = data.get('content') or ''
            if not isinstance(content, str) or len(content) > 10000:
                return fail('Messages must contain at most 10,000 characters')
            content = content.strip()
            file_url = data.get('file_url')
            if file_url and (not isinstance(file_url, str) or not file_url.startswith((
                    '/static/uploads/', '/chat/uploads/', 'data:image/png;base64,',
                    'data:image/jpeg;base64,', 'data:image/gif;base64,', 'data:image/webp;base64,'))):
                return fail('Invalid attachment URL')
            if file_url and file_url.startswith('/chat/uploads/') and not can_read_attachment(file_url, current_user):
                return fail('Attachment is not accessible')
            if file_url and len(file_url) > 20 * 1024 * 1024:
                return fail('Attachment is too large')
            if not content and not file_url:
                return fail('Write a message or attach a file')
            parent_id = data.get('parent_id')
            if parent_id:
                parent = query.filter(Message.id == int(parent_id), Message.parent_id.is_(None)).first()
                if not parent:
                    return fail('Invalid reply target')
            filename = str(data.get('file_name') or 'Attachment')[:255]
            msg = Message(content=content or filename, user_id=current_user.id,
                          group_id=target_id if kind == 'group' else None,
                          recipient_id=target_id if kind == 'dm' else None,
                          parent_id=int(parent_id) if parent_id else None,
                          message_type='file' if file_url else 'text', file_url=file_url,
                          timestamp=datetime.now(timezone.utc).replace(tzinfo=None))
            db.session.add(msg)
            db.session.commit()
            output = serialize_message(msg)
            output['file_name'] = filename if file_url else None
            output['file_type'] = data.get('file_type')
            notification = {
                'type': 'message', 'id': msg.id, 'username': current_user.username,
                'content': content or 'Sent an attachment', 'group_id': msg.group_id,
                'recipient_id': current_user.id if kind == 'dm' else None,
                'group_name': target.name if kind == 'group' else 'Direct message',
                'timestamp': output['timestamp'], 'parent_id': msg.parent_id,
            }
            if kind == 'group':
                sync_group_rooms(socketio, target)
                emit('receive_message', output, room=str(target_id))
                # Notify other people, not the sender's additional tabs.
                for user_id in list(user_connections):
                    person = db.session.get(User, user_id)
                    if user_id != current_user.id and person and person.is_active and user_can_access_group(target, person):
                        socketio.emit('new_notification', notification, to=f'user:{user_id}')
            else:
                for user_id in {current_user.id, target_id}:
                    socketio.emit('receive_message', output, to=f'user:{user_id}')
                socketio.emit('new_notification', notification, to=f'user:{target_id}')
            return {'ok': True, 'message': output}
        except (ValueError, TypeError, LookupError, PermissionError) as exc:
            db.session.rollback()
            return fail(str(exc) or 'Invalid message')
        except Exception:
            db.session.rollback()
            return fail('Message could not be saved. Please try again.')

    @socketio.on('typing')
    def handle_typing(data):
        if not current_user.is_authenticated or not isinstance(data, dict):
            return
        try:
            kind = 'group' if data.get('group_id') else 'dm'
            target_id = int(data.get('group_id') or data.get('recipient_id'))
            _, target = conversation_query(kind, target_id, current_user)
        except (ValueError, TypeError, LookupError, PermissionError):
            return
        payload = {'username': current_user.username, 'user_id': current_user.id,
                   'group_id': target_id if kind == 'group' else None,
                   'recipient_id': target_id if kind == 'dm' else None}
        if kind == 'group':
            sync_group_rooms(socketio, target)
            emit('user_typing', payload, room=str(target_id), include_self=False)
        else:
            socketio.emit('user_typing', payload, to=f'user:{target_id}')
