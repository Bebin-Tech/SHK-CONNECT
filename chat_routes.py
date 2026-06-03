import os
import uuid
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, current_app
from flask_login import login_required, current_user
from models import db, Message, Group, Role, User
from werkzeug.utils import secure_filename
from sqlalchemy import or_
from extensions import socketio

chat_bp = Blueprint('chat', __name__)

ALLOWED_EXTENSIONS = {
    'image': {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'},
    'document': {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'},
    'video': {'mp4', 'webm', 'mov'},
}
MAX_FILE_SIZE_MB = 20

def get_file_type(filename):
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    for ftype, exts in ALLOWED_EXTENSIONS.items():
        if ext in exts:
            return ftype, ext
    return 'file', ext

def can_manage_group(group):
    if not current_user.is_authenticated:
        return False
    role_name = current_user.role.name if current_user.role else 'Member'
    return role_name in ['Admin', 'Owner'] or group.created_by == current_user.id

def save_channel_avatar(file):
    if not file or not file.filename:
        return None

    ftype, ext = get_file_type(file.filename)
    if ftype != 'image':
        raise ValueError('Please upload an image file.')

    file.seek(0, 2)
    size_bytes = file.tell()
    file.seek(0)
    if size_bytes > 2 * 1024 * 1024: # Limit Base64 to 2MB to avoid DB bloat
        raise ValueError('Image too large for permanent storage. Max 2MB.')

    import base64
    img_data = file.read()
    base64_string = base64.b64encode(img_data).decode('utf-8')
    return f"data:image/{ext};base64,{base64_string}"

@chat_bp.route('/')
@chat_bp.route('/<int:group_id>')
@login_required
def index(group_id=None):
    role_obj = current_user.role
    role_name = role_obj.name if role_obj else 'Member'

    # Management Tier (Admin, Owner, ED) can see all channels
    # Others only see channels they are connected to
    if role_name in ['Admin', 'Owner', 'ED']:
        groups = Group.query.filter_by(is_archived=False).order_by(Group.created_at.asc()).all()
    else:
        groups = Group.query.filter(Group.is_archived == False).filter(
            Group.members.any(id=current_user.id)
        ).order_by(Group.created_at.asc()).all()

    group = None
    messages = []
    if group_id:
        group = Group.query.get_or_404(group_id)
        # Security check: Management Tier see all, others MUST be a member
        is_member = current_user in group.members
        if role_name not in ['Admin', 'Owner', 'ED'] and not is_member:
            flash('You must be a member to access this channel.', 'danger')
            return redirect(url_for('chat.index'))
        
        messages = Message.query.filter_by(group_id=group_id, parent_id=None)\
                               .order_by(Message.timestamp.desc())\
                               .limit(50).all()
        messages.reverse()

    # Sort users by role then name to make management easier
    all_users = User.query.join(Role).order_by(Role.name, User.first_name, User.username).all()

    return render_template('chat/index.html', 
                           title=group.name if group else 'Team Chat',
                           groups=groups, 
                           group=group, 
                           messages=messages, 
                           all_users=all_users)

@chat_bp.route('/load_history/<int:group_id>')
@login_required
def load_history(group_id):
    group = Group.query.get_or_404(group_id)
    # Security check: Management Tier see all, others MUST be a member
    role_name = current_user.role.name if current_user.role else 'Member'
    if role_name not in ['Admin', 'Owner', 'ED'] and current_user not in group.members:
        return jsonify({'error': 'Unauthorized'}), 403

    offset = request.args.get('offset', 0, type=int)
    messages = Message.query.filter_by(group_id=group_id, parent_id=None)\
                           .order_by(Message.timestamp.desc())\
                           .offset(offset).limit(50).all()
    
    results = []
    for m in messages:
        results.append({
            'id': m.id,
            'username': m.author.username if m.author else 'Unknown',
            'full_name': m.author.first_name if m.author else None,
            'role': m.author.role.name if m.author and m.author.role else 'Member',
            'content': m.content,
            'timestamp': m.timestamp.strftime('%I:%M %p'),
            'file_url': m.file_url,
            'file_type': m.message_type if m.message_type != 'text' else None,
            'replies': [{
                'username': r.author.username if r.author else 'Unknown',
                'content': r.content,
                'timestamp': r.timestamp.strftime('%I:%M %p')
            } for r in m.replies]
        })
    return jsonify(results)

@chat_bp.route('/connect_users/<int:group_id>', methods=['POST'])
@login_required
def connect_users(group_id):
    group = Group.query.get_or_404(group_id)
    
    if not can_manage_group(group):
        return jsonify({'error': 'Unauthorized'}), 403
        
    user_ids = request.form.getlist('user_ids')
    
    # We maintain individual membership
    from models import User
    group.members = []
    for uid in user_ids:
        u = db.session.get(User, uid)
        if u:
            group.members.append(u)
            
    db.session.commit()
    return jsonify({'success': True})

@chat_bp.route('/edit_group/<int:group_id>', methods=['POST'])
@login_required
def edit_group(group_id):
    group = Group.query.get_or_404(group_id)
    if not can_manage_group(group):
        return jsonify({'error': 'Unauthorized'}), 403

    name = (request.form.get('name') or '').strip()
    description = (request.form.get('description') or '').strip()
    if not name:
        return jsonify({'error': 'Channel name is required'}), 400

    avatar = request.files.get('avatar')
    try:
        avatar_url = save_channel_avatar(avatar) if avatar and avatar.filename else None
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    group.name = name
    group.description = description
    if avatar_url:
        group.avatar_url = avatar_url

    try:
        db.session.add(group)
        db.session.commit()
        print(f"DEBUG: Channel {group.id} profile updated and committed to DB.")
    except Exception as e:
        db.session.rollback()
        print(f"ERROR: Failed to save channel profile: {e}")
        return jsonify({'error': 'Failed to save to database'}), 500

    return jsonify({
        'success': True,
        'id': group.id,
        'name': group.name,
        'description': group.description,
        'avatar_url': group.avatar_url
    })

@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    file.seek(0, 2)
    size_bytes = file.tell()
    file.seek(0)
    if size_bytes > MAX_FILE_SIZE_MB * 1024 * 1024:
        return jsonify({'error': f'File too large. Max {MAX_FILE_SIZE_MB}MB allowed.'}), 400

    ftype, ext = get_file_type(file.filename)
    
    import uuid
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    upload_root = current_app.config.get('UPLOAD_FOLDER', os.path.join(current_app.root_path, 'static', 'uploads'))
    upload_dir = os.path.join(upload_root, ftype)
    os.makedirs(upload_dir, exist_ok=True)
    
    filepath = os.path.join(upload_dir, safe_name)
    file.save(filepath)
    
    file_url = f'/static/uploads/{ftype}/{safe_name}'
    original_name = secure_filename(file.filename)

    return jsonify({
        'url': file_url,
        'type': ftype,
        'ext': ext,
        'name': original_name,
        'size': size_bytes
    }), 200
    
@chat_bp.route('/create_group', methods=['POST'])
@login_required
def create_group():
    if not current_user.role or current_user.role.name not in ['Admin', 'Owner', 'ED']:
        return jsonify({'error': 'Unauthorized'}), 403

    import string, random
    name = (request.form.get('name') or '').strip()
    desc = (request.form.get('description') or '').strip()
    invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    if name:
        group = Group(name=name, description=desc, created_by=current_user.id, invite_code=invite_code)
        Group.apply_default_access(group, current_user)
        group.members.append(current_user)
        db.session.add(group)
        db.session.commit()
        socketio.emit('refresh_channels', {'id': group.id, 'action': 'create'}, namespace='/')
        return jsonify({'success': True, 'id': group.id, 'name': group.name})
    return jsonify({'error': 'Name is required'}), 400

@chat_bp.route('/archive_group/<int:group_id>', methods=['POST'])
@login_required
def archive_group(group_id):
    role = current_user.role.name if current_user.role else 'Member'
    if role not in ['Admin', 'Owner']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    group = Group.query.get_or_404(group_id)
    group.is_archived = True
    db.session.commit()
    socketio.emit('refresh_channels', {'id': group_id, 'action': 'archive'}, namespace='/')
    return jsonify({'success': True})

@chat_bp.route('/search')
@login_required
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    # Filter messages from groups the user has access to
    role_obj = current_user.role
    role_name = role_obj.name if role_obj else 'Member'

    # Management Tier see all, others only connected
    if role_name in ['Admin', 'Owner', 'ED']:
        accessible_group_ids = db.session.query(Group.id).all()
    else:
        accessible_group_ids = db.session.query(Group.id).filter(
            Group.members.any(id=current_user.id)
        ).all()

    accessible_group_ids = [g[0] for g in accessible_group_ids]

    messages = Message.query.filter(
        Message.group_id.in_(accessible_group_ids),
        Message.content.ilike(f'%{query}%')
    ).limit(50).all()
    
    results = [{
        'id': m.id,
        'content': m.content,
        'user': m.author.username if m.author else 'Unknown',
        'timestamp': m.timestamp.strftime('%Y-%m-%d %H:%M') if m.timestamp else '',
        'group_id': m.group_id
    } for m in messages]
    
    return jsonify(results)
