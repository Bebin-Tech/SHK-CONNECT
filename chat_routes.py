import os
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, current_app
from flask_login import login_required, current_user
from models import db, Message, Group, Role
from werkzeug.utils import secure_filename

chat_bp = Blueprint('chat', __name__)

# ... (helper functions)

def apply_default_group_access(group):
    role_name = current_user.role.name if current_user.role else 'Member'
    if role_name in ['Admin', 'Owner']:
        group.roles = Role.query.all()
    elif current_user.role:
        group.roles.append(current_user.role)


def can_manage_group(group):
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
    if size_bytes > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ValueError(f'File too large. Max {MAX_FILE_SIZE_MB}MB allowed.')

    import uuid
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    upload_root = current_app.config.get('UPLOAD_FOLDER', os.path.join(current_app.root_path, 'static', 'uploads'))
    upload_dir = os.path.join(upload_root, 'channel_profiles')
    os.makedirs(upload_dir, exist_ok=True)
    file.save(os.path.join(upload_dir, safe_name))
    return f'/static/uploads/channel_profiles/{safe_name}'



@chat_bp.route('/init')
@chat_bp.route('/init/<int:group_id>')
@login_required
def api_init(group_id=None):
    role_obj = current_user.role
    role_name = role_obj.name if role_obj else 'Member'
    from sqlalchemy import or_
    
    if role_name in ['Admin', 'Owner']:
        groups = Group.query.filter_by(is_archived=False).order_by(Group.created_at.asc()).all()
    else:
        groups = Group.query.filter(Group.is_archived == False).filter(
            or_(
                Group.members.any(id=current_user.id),
                Group.roles.any(id=current_user.role_id)
            )
        ).order_by(Group.created_at.asc()).all()

    groups_data = [{
        'id': g.id,
        'name': g.name,
        'description': g.description,
        'avatar_url': g.avatar_url,
        'member_count': g.members.count(),
        'roles': [r.id for r in g.roles],
        'created_by': g.created_by
    } for g in groups]

    group_data = None
    messages_data = []
    
    if group_id:
        group = Group.query.get(group_id)
        if group:
            is_member = current_user in group.members
            role_connected = role_obj in group.roles if role_obj else False
            if role_name not in ['Admin', 'Owner'] and not (is_member or role_connected):
                return jsonify({'error': 'Unauthorized'}), 403
            
            group_data = {
                'id': group.id,
                'name': group.name,
                'description': group.description,
                'avatar_url': group.avatar_url,
                'member_count': group.members.count(),
                'created_by': group.created_by,
                'roles': [r.id for r in group.roles]
            }
            
            messages = Message.query.filter_by(group_id=group_id, parent_id=None)\
                                   .order_by(Message.timestamp.desc())\
                                   .limit(50).all()
            messages.reverse()
            for m in messages:
                messages_data.append({
                    'id': m.id,
                    'user_id': m.user_id,
                    'username': m.author.username if m.author else 'Unknown',
                    'role': m.author.role.name if m.author and m.author.role else 'Member',
                    'content': m.content,
                    'timestamp': m.timestamp.strftime('%b %d, %I:%M %p'),
                    'file_url': m.file_url,
                    'file_type': m.message_type if m.message_type != 'text' else None,
                    'file_name': m.file_url.split('/')[-1] if m.file_url else None,
                    'replies': [{
                        'id': r.id,
                        'user_id': r.user_id,
                        'username': r.author.username,
                        'role': r.author.role.name if r.author and r.author.role else 'Member',
                        'content': r.content,
                        'timestamp': r.timestamp.strftime('%b %d, %I:%M %p')
                    } for r in m.replies]
                })

    all_roles = [{'id': r.id, 'name': r.name} for r in Role.query.all()]
    
    return jsonify({
        'groups': groups_data,
        'current_group': group_data,
        'messages': messages_data,
        'all_roles': all_roles,
        'current_user': {
            'id': current_user.id,
            'username': current_user.username,
            'role': role_name
        }
    })

@chat_bp.route('/load_history/<int:group_id>')
@login_required
def load_history(group_id):
    # Offset-based pagination for older messages
    offset = request.args.get('offset', 0, type=int)
    messages = Message.query.filter_by(group_id=group_id, parent_id=None)\
                           .order_by(Message.timestamp.desc())\
                           .offset(offset).limit(50).all()
    
    # We return them in descending order for the frontend to prepend
    results = []
    for m in messages:
        results.append({
            'id': m.id,
            'username': m.author.username if m.author else 'Unknown',
            'role': m.author.role.name if m.author and m.author.role else 'Member',
            'content': m.content,
            'timestamp': m.timestamp.strftime('%I:%M %p'),
            'file_url': m.file_url,
            'file_type': m.message_type if m.message_type != 'text' else None,
            # Simple reply handling for history
            'replies': [{
                'username': r.author.username,
                'content': r.content,
                'timestamp': r.timestamp.strftime('%I:%M %p')
            } for r in m.replies]
        })
    return jsonify(results)

@chat_bp.route('/connect_roles/<int:group_id>', methods=['POST'])
@login_required
def connect_roles(group_id):
    group = Group.query.get_or_404(group_id)
    
    # Only Admin, Owner, or Group Creator can connect roles
    if not can_manage_group(group):
        return jsonify({'error': 'Unauthorized'}), 403
        
    role_ids = request.form.getlist('role_ids')
    
    # Clear existing roles and add selected ones
    group.roles = []
    for rid in role_ids:
        r = Role.query.get(rid)
        if r:
            group.roles.append(r)
            
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

    db.session.commit()
    return jsonify({
        'success': True,
        'id': group.id,
        'name': group.name,
        'description': group.description,
        'avatar_url': group.avatar_url
    })

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

@chat_bp.route('/upload', methods=['POST'])
@login_required
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Check file size (read into memory check)
    file.seek(0, 2)
    size_bytes = file.tell()
    file.seek(0)
    if size_bytes > MAX_FILE_SIZE_MB * 1024 * 1024:
        return jsonify({'error': f'File too large. Max {MAX_FILE_SIZE_MB}MB allowed.'}), 400

    ftype, ext = get_file_type(file.filename)
    
    # Build a safe unique filename
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
    import string, random
    name = (request.form.get('name') or '').strip()
    desc = (request.form.get('description') or '').strip()
    invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    if name:
        group = Group(name=name, description=desc, created_by=current_user.id, invite_code=invite_code)
        apply_default_group_access(group)
        group.members.append(current_user)
        db.session.add(group)
        db.session.commit()
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
    return jsonify({'success': True})

@chat_bp.route('/search')
@login_required
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    # Search in groups or private messages involving the current user
    messages = Message.query.filter(
        Message.content.ilike(f'%{query}%')
    ).limit(50).all()
    
    results = [{
        'id': m.id,
        'content': m.content,
        'user': m.author.username if m.author else 'Unknown',
        'timestamp': m.timestamp.strftime('%Y-%m-%d %H:%M') if m.timestamp else ''
    } for m in messages]
    
    return jsonify(results)
