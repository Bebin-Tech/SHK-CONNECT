from flask_socketio import emit, join_room, leave_room
from models import db, Message, User, Group
from flask_login import current_user
from datetime import datetime

online_users = {}  # { user_id: { username, role } }

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
        group_id = str(data.get('group_id', ''))
        if group_id:
            join_room(group_id)

    @socketio.on('send_message')
    def handle_message(data):
        group_id  = data.get('group_id')
        content   = (data.get('content') or '').strip()
        parent_id = data.get('parent_id')
        file_url  = data.get('file_url')
        file_type = data.get('file_type', 'file')
        file_name = data.get('file_name', '')
        msg_type  = 'file' if file_url else 'text'

        if not content and not file_url:
            return
        if not group_id:
            return

        group = Group.query.get(int(group_id))
        if not group:
            return

        msg = Message(
            content=content or file_name,
            user_id=current_user.id,
            group_id=int(group_id),
            parent_id=int(parent_id) if parent_id else None,
            message_type=msg_type,
            file_url=file_url,
            timestamp=datetime.utcnow()
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
            'timestamp':    msg.timestamp.strftime('%I:%M %p'),
            'group_id':     group_id,
            'parent_id':    parent_id,
            'reply_preview': reply_preview
        }

        emit('receive_message', output, room=str(group_id))

    @socketio.on('typing')
    def handle_typing(data):
        group_id = str(data.get('group_id', ''))
        if group_id:
            emit('user_typing', {'username': current_user.username}, room=group_id, include_self=False)
