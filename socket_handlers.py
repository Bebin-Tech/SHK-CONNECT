from flask_socketio import emit, join_room, leave_room
from models import db, Message, User, Group
from flask_login import current_user
from datetime import datetime

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

def register_socket_handlers(socketio):

    @socketio.on('connect')
    def handle_connect():
        if current_user.is_authenticated:
            user_id = current_user.id
            online_users[user_id] = {
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
    def handle_disconnect():
        if current_user.is_authenticated:
            online_users.pop(current_user.id, None)
            emit('presence_update', {'online': list(online_users.values())}, broadcast=True)

    @socketio.on('join')
    def on_join(data):
        if not current_user.is_authenticated:
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
        if not current_user.is_authenticated:
            emit('error', {'message': 'Not authenticated'})
            return

        try:
            group_id_raw = data.get('group_id')
            content      = (data.get('content') or '').strip()
            parent_id    = data.get('parent_id')
            file_url     = data.get('file_url')
            file_type    = data.get('file_type', 'file')
            file_name    = data.get('file_name', '')
            msg_type     = 'file' if file_url else 'text'

            if not content and not file_url:
                return
            if not group_id_raw:
                return

            group_id = int(group_id_raw)
            group = db.session.get(Group, group_id)

            if not group:
                emit('error', {'message': 'Channel not found'})
                return

            if not user_can_access_group(group, current_user):
                emit('error', {'message': 'Access denied'})
                return

            msg = Message(
                content=content or file_name,
                user_id=current_user.id,
                group_id=group_id,
                parent_id=int(parent_id) if parent_id and str(parent_id).isdigit() else None,
                message_type=msg_type,
                file_url=file_url,
                timestamp=datetime.utcnow()
            )
            db.session.add(msg)
            db.session.commit()

            role_name = current_user.role.name if current_user.role else 'Member'

            reply_preview = None
            if msg.parent_id:
                parent_msg = db.session.get(Message, msg.parent_id)
                if parent_msg:
                    reply_preview = {
                        'username': parent_msg.author.username if parent_msg.author else 'Unknown',
                        'content': parent_msg.content[:80]
                    }

            output = {
                'id':           msg.id,
                'username':     current_user.username,
                'full_name':    current_user.first_name,
                'role':         role_name,
                'content':      content,
                'file_url':     file_url,
                'file_type':    file_type,
                'file_name':    file_name,
                'msg_type':     msg_type,
                'timestamp':    msg.timestamp.strftime('%b %d, %I:%M %p'),
                'group_id':     group_id,
                'parent_id':    msg.parent_id,
                'reply_preview': reply_preview
            }

            # Emit to the specific group room
            emit('receive_message', output, room=str(group_id))

            # Send notification to everyone in the room except the sender
            emit('new_notification', {
                'type': 'message',
                'username': current_user.username,
                'content': content or 'sent a file',
                'group_id': group_id,
                'group_name': group.name,
                'timestamp': output['timestamp']
            }, room=str(group_id), include_self=False)

        except Exception as e:
            print(f"Message handling error: {e}")
            db.session.rollback()
            emit('error', {'message': 'Server error. Please try again.'})

    @socketio.on('typing')
    def handle_typing(data):
        if not current_user.is_authenticated:
            return
        group_id = data.get('group_id')
        if group_id:
            emit('user_typing', {'username': current_user.username}, room=str(group_id), include_self=False)
