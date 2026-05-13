from flask_socketio import emit, join_room, leave_room
from models import db, Message, User, Group
from flask_login import current_user
from datetime import datetime

online_users = {}  # { user_id: { username, role } }

def user_can_access_group(group):
    if not current_user.is_authenticated or not group or group.is_archived:
        return False

    role = current_user.role
    role_name = role.name if role else 'Member'
    if role_name in ['Admin', 'Owner']:
        return True

    return current_user in group.members or (role in group.roles if role else False)

def register_socket_handlers(socketio):

    @socketio.on('connect')
    def handle_connect():
        if current_user.is_authenticated:
            online_users[current_user.id] = {
                'username': current_user.username,
                'role': current_user.role.name if current_user.role else 'Member'
            }
            emit('presence_update', {'online': list(online_users.values())}, broadcast=True)

    @socketio.on('disconnect')
    def handle_disconnect():
        if current_user.is_authenticated:
            online_users.pop(current_user.id, None)
            emit('presence_update', {'online': list(online_users.values())}, broadcast=True)

    @socketio.on('join')
    def on_join(data):
        if not current_user.is_authenticated:
            return

        raw_group_id = data.get('group_id', '')
        try:
            group_id = int(raw_group_id)
        except (TypeError, ValueError):
            return

        group = Group.query.get(group_id)
        if not user_can_access_group(group):
            return

        room_id = str(group_id)
        join_room(room_id)
        emit('new_notification', {
            'type': 'join',
            'username': current_user.username,
            'group_name': group.name,
            'timestamp': datetime.now().strftime('%I:%M %p')
        }, room=room_id, include_self=False)

    @socketio.on('send_message')
    def handle_message(data):
        group_id  = data.get('group_id')
        content   = (data.get('content') or '').strip()
        parent_id = data.get('parent_id')
        file_url  = data.get('file_url')
        file_type = data.get('file_type', 'file')
        file_name = data.get('file_name', '')
        msg_type  = 'file' if file_url else 'text'

        if not current_user.is_authenticated:
            return
        if not content and not file_url:
            return
        if not group_id:
            return

        try:
            group_id = int(group_id)
        except (TypeError, ValueError):
            return

        group = Group.query.get(group_id)
        if not user_can_access_group(group):
            return

        msg = Message(
            content=content or file_name,
            user_id=current_user.id,
            group_id=group_id,
            parent_id=int(parent_id) if parent_id else None,
            message_type=msg_type,
            file_url=file_url,
            timestamp=datetime.now()
        )
        db.session.add(msg)
        db.session.commit()

        role = current_user.role.name if current_user.role else 'Member'

        reply_preview = None
        if parent_id:
            parent_msg = Message.query.get(int(parent_id))
            if parent_msg:
                reply_preview = {
                    'username': parent_msg.author.username if parent_msg.author else 'Unknown',
                    'content': parent_msg.content[:80]
                }

        output = {
            'id':           msg.id,
            'username':     current_user.username,
            'role':         role,
            'content':      content,
            'file_url':     file_url,
            'file_type':    file_type,
            'file_name':    file_name,
            'msg_type':     msg_type,
            'timestamp':    msg.timestamp.strftime('%b %d, %I:%M %p'),
            'group_id':     group_id,
            'parent_id':    parent_id,
            'reply_preview': reply_preview
        }

        emit('receive_message', output, room=str(group_id))
        
        # Also emit a notification for everyone in the group (excluding sender)
        emit('new_notification', {
            'type': 'message',
            'username': current_user.username,
            'content': content or 'sent a file',
            'group_id': group_id,
            'group_name': group.name,
            'timestamp': output['timestamp']
        }, room=str(group_id), include_self=False)

    @socketio.on('typing')
    def handle_typing(data):
        group_id = str(data.get('group_id', ''))
        if group_id:
            emit('user_typing', {'username': current_user.username}, room=group_id, include_self=False)
