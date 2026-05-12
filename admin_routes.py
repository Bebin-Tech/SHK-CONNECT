from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from models import db, User, Role, Group, Message, Expense
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

# ─── Admin Dashboard (Admin only) ─────────────────────────────────────────────

@admin_bp.route('/')
@login_required
@admin_required
def index():
    from sqlalchemy import func
    from datetime import datetime

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    stats = {
        'users': User.query.count(),
        'groups': Group.query.filter_by(is_archived=False).count(),
        'pending_expenses': Expense.query.filter_by(status='pending').count(),
        'monthly_credit': db.session.query(func.sum(Expense.amount)).filter(
            Expense.type == 'credit',
            Expense.created_at >= month_start
        ).scalar() or 0,
        'monthly_debit': db.session.query(func.sum(Expense.amount)).filter(
            Expense.type == 'debit',
            Expense.created_at >= month_start
        ).scalar() or 0
    }
    groups = Group.query.filter_by(is_archived=False).all()
    return render_template('admin/dashboard.html', title='Admin Panel', stats=stats, groups=groups)

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
@admin_required
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
@admin_required
def archive_group(group_id):
    group = Group.query.get_or_404(group_id)
    group.is_archived = True
    db.session.commit()
    flash(f'Channel "{group.name}" moved to History.', 'info')
    return redirect(url_for('admin.index'))

@admin_bp.route('/groups/<int:group_id>/delete')
@login_required
@admin_required
def delete_group(group_id):
    group = Group.query.get_or_404(group_id)
    group.members = []
    db.session.delete(group)
    db.session.commit()
    flash(f'Channel "{group.name}" permanently removed.', 'warning')
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

# ─── Expenses (Role-filtered) ─────────────────────────────────────────────────

@admin_bp.route('/expenses')
@login_required
def expenses():
    from sqlalchemy import func
    from datetime import datetime

    role = get_user_role()
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    # Admins/Owners see ALL expenses; Members see only their own
    if role in ['Admin', 'Owner']:
        expenses_list = Expense.query.order_by(Expense.created_at.desc()).all()
        monthly_credit = db.session.query(func.sum(Expense.amount)).filter(
            Expense.type == 'credit', Expense.created_at >= month_start).scalar() or 0
        monthly_debit = db.session.query(func.sum(Expense.amount)).filter(
            Expense.type == 'debit', Expense.created_at >= month_start).scalar() or 0
    else:
        expenses_list = Expense.query.filter_by(user_id=current_user.id).order_by(Expense.created_at.desc()).all()
        monthly_credit = db.session.query(func.sum(Expense.amount)).filter(
            Expense.type == 'credit', Expense.user_id == current_user.id,
            Expense.created_at >= month_start).scalar() or 0
        monthly_debit = db.session.query(func.sum(Expense.amount)).filter(
            Expense.type == 'debit', Expense.user_id == current_user.id,
            Expense.created_at >= month_start).scalar() or 0

    stats = {'monthly_credit': monthly_credit, 'monthly_debit': monthly_debit}
    return render_template('admin/expenses.html', title='Expense Tracker',
                           stats=stats, expenses=expenses_list)

@admin_bp.route('/expenses/add', methods=['POST'])
@login_required
def add_expense():
    """Admin/Owner can add expenses directly."""
    if get_user_role() not in ['Admin', 'Owner']:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.json
    expense = Expense(
        amount=float(data.get('amount')),
        category=data.get('category'),
        description=data.get('description'),
        type=data.get('type', 'debit'),
        user_id=current_user.id,
        status='approved'  # Admin-added expenses are auto-approved
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify({'success': True, 'id': expense.id})

@admin_bp.route('/expenses/submit', methods=['POST'])
@login_required
def submit_expense():
    """Members submit expenses for approval."""
    from datetime import datetime as dt
    data = request.json
    bill_date = dt.strptime(data.get('bill_date', dt.utcnow().strftime('%Y-%m-%d')), '%Y-%m-%d')
    expense = Expense(
        amount=float(data.get('amount')),
        category=data.get('category', 'Misc'),
        description=data.get('description'),
        type='debit',
        status='pending',
        is_paid=False,
        bill_date=bill_date,
        user_id=current_user.id
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify({'success': True, 'id': expense.id})

@admin_bp.route('/expenses/<int:expense_id>/approve', methods=['POST'])
@login_required
@admin_or_owner_required
def approve_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    expense.status = 'approved'
    expense.approved_by = current_user.id
    db.session.commit()
    return jsonify({'success': True})

@admin_bp.route('/expenses/<int:expense_id>/reject', methods=['POST'])
@login_required
@admin_or_owner_required
def reject_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    expense.status = 'rejected'
    db.session.commit()
    return jsonify({'success': True})

@admin_bp.route('/expenses/<int:expense_id>/mark_paid', methods=['POST'])
@login_required
@admin_or_owner_required
def mark_expense_paid(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    expense.is_paid = not expense.is_paid
    expense.status = 'paid' if expense.is_paid else 'approved'
    db.session.commit()
    return jsonify({'success': True, 'is_paid': expense.is_paid})

@admin_bp.route('/expenses/<int:expense_id>/delete', methods=['POST'])
@login_required
def delete_expense(expense_id):
    expense = Expense.query.get_or_404(expense_id)
    if expense.user_id == current_user.id or get_user_role() in ['Admin', 'Owner']:
        db.session.delete(expense)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'error': 'Unauthorized'}), 403

@admin_bp.route('/expenses/clear', methods=['POST'])
@login_required
@admin_required
def clear_expenses():
    Expense.query.delete()
    db.session.commit()
    return jsonify({'success': True})

@admin_bp.route('/expenses/export/csv')
@login_required
@admin_or_owner_required
def export_expenses_csv():
    import csv, io
    from flask import Response
    expenses = Expense.query.order_by(Expense.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Bill Name', 'Category', 'Amount', 'Type', 'Status', 'Paid', 'Submitted By'])
    for e in expenses:
        writer.writerow([
            e.created_at.strftime('%d %b %Y'),
            e.description or '',
            e.category or '',
            e.amount,
            e.type,
            e.status,
            'Yes' if e.is_paid else 'No',
            e.user.username if e.user else 'Unknown'
        ])
    output.seek(0)
    return Response(output, mimetype='text/csv',
                    headers={"Content-Disposition": "attachment;filename=expenses.csv"})
