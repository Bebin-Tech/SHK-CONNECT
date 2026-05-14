from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from models import db, User, Role, Group, Message, ActivityLog, SupportTicket
from functools import wraps

admin_bp = Blueprint('admin', __name__)

# ─── Role Decorators ──────────────────────────────────────────────────────────

def admin_required(f):
    """Only Admin role can access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.role or current_user.role.name != 'Admin':
            flash('Access denied. Admin privileges required.', 'danger')
            return redirect(url_for('chat.index'))
        return f(*args, **kwargs)
    return decorated_function

def admin_or_owner_required(f):
    """Admin or Owner roles can access."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.role or current_user.role.name not in ['Admin', 'Owner']:
            flash('Access denied. Insufficient privileges.', 'danger')
            return redirect(url_for('chat.index'))
        return f(*args, **kwargs)
    return decorated_function

def get_user_role():
    """Helper to get current user role name safely."""
    if current_user.is_authenticated and current_user.role:
        return current_user.role.name
    return 'Member'


def apply_default_group_access(group):
    role = get_user_role()
    if role in ['Admin', 'Owner']:
        group.roles = Role.query.all()
    elif current_user.role:
        group.roles.append(current_user.role)


# ─── Admin Dashboard ──────────────────────────────────────────────────────────

@admin_bp.route('/')
@login_required
@admin_or_owner_required
def index():
    from models import Expense
    from datetime import datetime
    
    active_groups = Group.query.filter_by(is_archived=False).all()
    user_count = User.query.count()
    
    # Simple monthly stats
    now = datetime.now()
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

@admin_bp.route('/roles')
@login_required
@admin_required
def get_roles():
    roles = Role.query.all()
    return jsonify([{'id': r.id, 'name': r.name} for r in roles])

@admin_bp.route('/users')
@login_required
@admin_required
def users():
    all_users = User.query.all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'role': u.role.name if u.role else 'Member',
        'role_id': u.role_id,
        'is_active': u.is_active,
        'created_at': u.created_at.strftime('%Y-%m-%d %H:%M')
    } for u in all_users])

@admin_bp.route('/users/create', methods=['POST'])
@login_required
@admin_required
def create_user():
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role_id = data.get('role_id')

    if not username or not email or not password:
        return jsonify({'error': 'Missing fields'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    user = User(username=username, email=email, role_id=role_id)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True, 'message': f'User {username} created'})

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

@admin_bp.route('/users/<int:user_id>/edit', methods=['POST'])
@login_required
@admin_required
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip()
    password = data.get('password', '').strip()
    role_id  = data.get('role_id')

    if username and username != user.username:
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username taken'}), 400
        user.username = username

    if email and email != user.email:
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email in use'}), 400
        user.email = email

    if password:
        user.set_password(password)

    if role_id:
        user.role_id = role_id

    db.session.commit()
    return jsonify({'success': True, 'message': f'User {user.username} updated'})

@admin_bp.route('/users/<int:user_id>/delete', methods=['DELETE'])
@login_required
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({'error': 'Cannot delete yourself'}), 400
    db.session.delete(user)
    db.session.commit()
    return jsonify({'success': True})

# ─── Group Management (Admin only) ────────────────────────────────────────────

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
        apply_default_group_access(group)
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

# ─── History Logs (Admin only) ─────────────────────────────────────────────────

@admin_bp.route('/history_logs')
@login_required
@admin_required
def get_history_logs():
    logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(100).all()
    return jsonify([{
        'id': l.id,
        'action': l.action,
        'details': l.details,
        'username': l.user.username if l.user else 'System',
        'timestamp': l.timestamp.strftime('%Y-%m-%d %H:%M'),
        'ip': l.ip_address
    } for l in logs])

# ─── Support Tickets (All users) ──────────────────────────────────────────────

@admin_bp.route('/tickets')
@login_required
def get_tickets():
    if current_user.role.name == 'Admin':
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

@admin_bp.route('/tickets/create', methods=['POST'])
@login_required
def create_ticket():
    data = request.get_json() or {}
    subject = data.get('subject')
    description = data.get('description')
    priority = data.get('priority', 'medium')
    
    if not subject or not description:
        return jsonify({'error': 'Missing fields'}), 400
        
    ticket = SupportTicket(
        subject=subject, 
        description=description, 
        priority=priority, 
        user_id=current_user.id
    )
    db.session.add(ticket)
    db.session.commit()
    return jsonify({'success': True, 'id': ticket.id})

@admin_bp.route('/tickets/<int:ticket_id>/status', methods=['POST'])
@login_required
@admin_required
def update_ticket_status(ticket_id):
    ticket = SupportTicket.query.get_or_404(ticket_id)
    data = request.get_json() or {}
    status = data.get('status')
    if status in ['open', 'in_progress', 'closed']:
        ticket.status = status
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'error': 'Invalid status'}), 400
