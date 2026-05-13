from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from models import db, User, Role, Group, Message
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

@admin_bp.route('/users')
@login_required
@admin_required
def users():
    all_users = User.query.all()
    roles = Role.query.all()
    return render_template('admin/users.html', title='Manage Users', users=all_users, roles=roles)

@admin_bp.route('/users/create', methods=['POST'])
@login_required
@admin_required
def create_user():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    role_id = request.form.get('role_id')

    if User.query.filter_by(email=email).first():
        flash('Email already exists.', 'danger')
    else:
        user = User(username=username, email=email, role_id=role_id)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash(f'User {username} created successfully!', 'success')
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

@admin_bp.route('/users/<int:user_id>/change_role', methods=['POST'])
@login_required
@admin_required
def change_role(user_id):
    user = User.query.get_or_404(user_id)
    role_id = request.form.get('role_id')
    user.role_id = role_id
    db.session.commit()
    flash(f'Role updated for {user.username}.', 'success')
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

@admin_bp.route('/users/<int:user_id>/delete', methods=['POST'])
@login_required
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('Cannot delete your own account.', 'danger')
        return redirect(url_for('admin.users'))
    db.session.delete(user)
    db.session.commit()
    flash(f'User deleted.', 'warning')
    return redirect(url_for('admin.users'))

# ─── Group Management (Admin only) ────────────────────────────────────────────

@admin_bp.route('/groups/create', methods=['POST'])
@login_required
@admin_or_owner_required
def create_group():
    import string, random
    name = request.form.get('name')
    desc = request.form.get('description')
    invite_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    if name:
        group = Group(name=name, description=desc, created_by=current_user.id, invite_code=invite_code)
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

# ─── History (All roles, filtered by role) ────────────────────────────────────

@admin_bp.route('/history')
@login_required
def history():
    role = get_user_role()
    if role in ['Admin', 'Owner']:
        archived_groups = Group.query.filter_by(is_archived=True).all()
    else:
        # Members only see history of their own groups
        archived_groups = [g for g in Group.query.filter_by(is_archived=True).all()
                           if current_user in g.members]
    return render_template('admin/history.html', title='History', groups=archived_groups)

@admin_bp.route('/history/<int:group_id>')
@login_required
def history_detail(group_id):
    role = get_user_role()
    group = Group.query.get_or_404(group_id)
    
    # Security check
    if role == 'Member' and current_user not in group.members:
        flash('Access denied.', 'danger')
        return redirect(url_for('admin.history'))
        
    return render_template('admin/history_detail.html', title=f'History: {group.name}', group=group)
