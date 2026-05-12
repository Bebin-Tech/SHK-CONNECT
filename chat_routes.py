import os
from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from models import db, Message, Group
from werkzeug.utils import secure_filename

chat_bp = Blueprint('chat', __name__)

# Helper to save files
def save_uploaded_file(file, folder='docs'):
    if not file:
        return None
    
    upload_path = os.path.join('static', 'uploads', folder)
    if not os.path.exists(upload_path):
        os.makedirs(upload_path)
    
    filename = secure_filename(file.filename)
    file.save(os.path.join(upload_path, filename))
    return f'/static/uploads/{folder}/{filename}'

@chat_bp.route('/')
@chat_bp.route('/<int:group_id>')
@login_required
def index(group_id=None):
    role = current_user.role.name if current_user.role else 'Member'

    # Admins/Owners see all groups; Members see only their groups
    if role in ['Admin', 'Owner']:
        groups = Group.query.filter_by(is_archived=False).order_by(Group.created_at.asc()).all()
    else:
        groups = [g for g in current_user.groups if not g.is_archived]

    group = None
    if group_id:
        group = Group.query.get_or_404(group_id)
        # Members can only view groups they belong to
        if role == 'Member' and current_user not in group.members:
            flash('You are not a member of this channel.', 'danger')
            return redirect(url_for('chat.index'))

    return render_template('chat/index.html', title='Team Chat', group=group, groups=groups)

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
    upload_dir = os.path.join('static', 'uploads', ftype)
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
