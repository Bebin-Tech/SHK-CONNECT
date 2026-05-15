from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from models import db, User, Role, Group, Message, ActivityLog, SupportTicket
from functools import wraps
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

# ─── Role Decorators ──────────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.role or current_user.role.name != 'Admin':
            flash('Access denied. Admin privileges required.', 'danger')
            return redirect(url_for('chat.index'))
        return f(*args, **kwargs)
    return decorated_function

def admin_or_owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.role or current_user.role.name not in ['Admin', 'Owner']:
            flash('Access denied. Insufficient privileges.', 'danger')
            return redirect(url_for('chat.index'))
        return f(*args, **kwargs)
    return decorated_function

# ─── Admin Dashboard Stats ────────────────────────────────────────────────────

@admin_bp.route('/stats')
@login_required
@admin_or_owner_required
def get_stats():
    from models import Expense
    active_groups = Group.query.filter_by(is_archived=False).all()
    user_count = User.query.count()
    now = datetime.utcnow()
    start_of_month = datetime(now.year, now.month, 1)
    
    monthly_credit = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.type == 'credit', Expense.bill_date >= start_of_month
    ).scalar() or 0
    
    monthly_debit = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.type == 'debit', Expense.bill_date >= start_of_month
    ).scalar() or 0
    
    return jsonify({
        'users': user_count,
        'groups': len(active_groups),
        'monthly_credit': round(monthly_credit, 2),
        'monthly_debit': round(monthly_debit, 2),
        'active_channels': [{
            'id': g.id,
            'name': g.name,
            'invite_code': g.invite_code,
            'description': g.description
        } for g in active_groups]
    })

# ─── Admin Dashboard ──────────────────────────────────────────────────────────

@admin_bp.route('/')
@login_required
@admin_or_owner_required
def index():
    from models import Expense
    active_groups = Group.query.filter_by(is_archived=False).all()
    user_count = User.query.count()
    now = datetime.utcnow()
    start_of_month = datetime(now.year, now.month, 1)
    
    monthly_credit = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.type == 'credit', Expense.bill_date >= start_of_month
    ).scalar() or 0
    
    monthly_debit = db.session.query(db.func.sum(Expense.amount)).filter(
        Expense.type == 'debit', Expense.bill_date >= start_of_month
    ).scalar() or 0
    
    stats = {
        'users': user_count,
        'groups': len(active_groups),
        'monthly_credit': round(monthly_credit, 2),
        'monthly_debit': round(monthly_debit, 2)
    }
    return render_template('admin/dashboard.html', title='Admin Command Center', groups=active_groups, stats=stats)


# ─── User Management (Admin only) ─────────────────────────────────────────────

@admin_bp.route('/users')
@login_required
@admin_required
def users():
    all_users = User.query.order_by(User.created_at.desc()).all()
    roles = Role.query.all()
    return render_template('admin/users.html', title='User Directory', users=all_users, roles=roles)

@admin_bp.route('/users/create', methods=['POST'])
@login_required
@admin_required
def create_user():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    role_id = request.form.get('role_id')

    if not username or not email or not password:
        flash('Missing required fields.', 'danger')
        return redirect(url_for('admin.users'))

    if User.query.filter_by(email=email).first():
        flash('Email already exists.', 'danger')
        return redirect(url_for('admin.users'))
    
    user = User(username=username, email=email, role_id=role_id)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    flash(f'User {username} has been created.', 'success')
    return redirect(url_for('admin.users'))

@admin_bp.route('/users/<int:user_id>/edit', methods=['POST'])
@login_required
@admin_required
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    username = request.form.get('username', '').strip()
    email    = request.form.get('email', '').strip()
    password = request.form.get('password', '').strip()
    role_id  = request.form.get('role_id')

    if username and username != user.username:
        if User.query.filter_by(username=username).first():
            flash('Username already taken.', 'danger')
            return redirect(url_for('admin.users'))
        user.username = username

    if email and email != user.email:
        if User.query.filter_by(email=email).first():
            flash('Email already in use.', 'danger')
            return redirect(url_for('admin.users'))
        user.email = email

    if password:
        user.set_password(password)

    if role_id:
        user.role_id = role_id

    db.session.commit()
    flash(f'User {user.username} updated successfully.', 'success')
    return redirect(url_for('admin.users'))

@admin_bp.route('/users/<int:user_id>/delete', methods=['POST', 'DELETE'])
@login_required
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('You cannot delete your own account.', 'danger')
        return redirect(url_for('admin.users'))

    # Clean up associations
    user.groups = []
    db.session.delete(user)
    db.session.commit()

    if request.method == 'DELETE' or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True})

    flash(f'User {user.username} has been removed.', 'warning')
    return redirect(url_for('admin.users'))

@admin_bp.route('/users/<int:user_id>/toggle', methods=['POST'])
@login_required
@admin_required
def toggle_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({'error': 'Cannot deactivate yourself'}), 400
    user.is_active = not user.is_active
    db.session.commit()
    return jsonify({'success': True, 'is_active': user.is_active})

# ─── Group Management (Admin/Owner) ───────────────────────────────────────────

@admin_bp.route('/groups/create', methods=['POST'])
@login_required
@admin_or_owner_required
def create_group():
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
        flash(f'Group "{name}" created. Invite code: {invite_code}', 'success')
    return redirect(url_for('admin.index'))

@admin_bp.route('/groups/<int:group_id>/archive')
@login_required
@admin_or_owner_required
def archive_group(group_id):
    group = Group.query.get_or_404(group_id)
    group.is_archived = True
    db.session.commit()
    flash(f'Channel "{group.name}" moved to History.', 'info')
    return redirect(url_for('admin.index'))

@admin_bp.route('/groups/<int:group_id>/delete')
@login_required
@admin_or_owner_required
def delete_group(group_id):
    group = Group.query.get_or_404(group_id)
    is_history = group.is_archived
    group.members = []
    db.session.delete(group)
    db.session.commit()
    flash(f'Channel "{group.name}" permanently removed.', 'warning')
    
    if is_history:
        return redirect(url_for('admin.history'))
    return redirect(url_for('admin.index'))

# ─── History (All roles) ──────────────────────────────────────────────────────

@admin_bp.route('/history')
@login_required
def history():
    return render_template('admin/history.html', title='Archived History')

@admin_bp.route('/history_groups')
@login_required
def get_history_groups():
    role_name = current_user.role.name if current_user.role else 'Member'
    if role_name in ['Admin', 'Owner']:
        groups = Group.query.filter_by(is_archived=True).all()
    else:
        groups = Group.query.filter(Group.is_archived == True).filter(
            Group.members.any(id=current_user.id)
        ).all()
    
    return jsonify([{
        'id': g.id,
        'name': g.name,
        'description': g.description,
        'created_at': g.created_at.strftime('%Y-%m-%d') if g.created_at else 'N/A',
        'message_count': len(g.messages)
    } for g in groups])

@admin_bp.route('/history_groups/<int:group_id>')
@login_required
def get_history_detail(group_id):
    group = Group.query.get_or_404(group_id)
    role_name = current_user.role.name if current_user.role else 'Member'
    if role_name == 'Member' and current_user not in group.members:
        return jsonify({'error': 'Access denied'}), 403
        
    messages = []
    for msg in group.messages:
        if not msg.parent_id:
            msg_role = msg.author.role.name if msg.author and msg.author.role else 'Member'
            replies = []
            for rep in msg.replies:
                rep_role = rep.author.role.name if rep.author and rep.author.role else 'Member'
                replies.append({
                    'id': rep.id,
                    'content': rep.content,
                    'username': rep.author.username if rep.author else 'Unknown',
                    'role': rep_role,
                    'timestamp': rep.timestamp.strftime('%I:%M %p')
                })
            
            messages.append({
                'id': msg.id,
                'content': msg.content,
                'username': msg.author.username if msg.author else 'Unknown',
                'role': msg_role,
                'timestamp': msg.timestamp.strftime('%d %b %Y, %I:%M %p'),
                'message_type': msg.message_type,
                'file_url': msg.file_url,
                'replies': replies
            })
            
    return jsonify({
        'id': group.id,
        'name': group.name,
        'description': group.description,
        'messages': messages
    })

# ─── Support Tickets ──────────────────────────────────────────────────────────

@admin_bp.route('/tickets')
@login_required
def get_tickets():
    if current_user.role and current_user.role.name == 'Admin':
        tickets = SupportTicket.query.order_by(SupportTicket.created_at.desc()).all()
    else:
        tickets = SupportTicket.query.filter_by(user_id=current_user.id).order_by(SupportTicket.created_at.desc()).all()
        
    return jsonify([{
        'id': t.id,
        'subject': t.subject,
        'description': t.description,
        'status': t.status,
        'priority': t.priority,
        'username': t.user.username,
        'created_at': t.created_at.strftime('%Y-%m-%d %H:%M')
    } for t in tickets])
