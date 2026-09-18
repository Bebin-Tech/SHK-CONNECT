from flask import Blueprint, jsonify
from flask_login import current_user
from models import User, Group, Role, Expense, ActivityLog

api_bp = Blueprint('api', __name__)


def json_login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_view(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_view

@api_bp.route('/me')
@json_login_required
def get_me():
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'email': current_user.email,
        'first_name': current_user.first_name,
        'last_name': current_user.last_name,
        'role': current_user.role.name if current_user.role else 'Member',
        'is_authenticated': True
    })

@api_bp.route('/channels')
@json_login_required
def get_channels():
    role_name = current_user.role.name if current_user.role else 'Member'
    if role_name in ['Admin', 'Owner', 'ED']:
        groups = Group.query.filter_by(is_archived=False).order_by(Group.created_at.asc()).all()
    else:
        groups = Group.query.filter(Group.is_archived == False).filter(
            Group.members.any(id=current_user.id)
        ).order_by(Group.created_at.asc()).all()
    
    return jsonify([{
        'id': g.id,
        'name': g.name,
        'description': g.description,
        'avatar_url': g.avatar_url,
        'member_count': g.members.count(),
        'members': [{'id': u.id} for u in g.members]
    } for g in groups])

@api_bp.route('/users')
@json_login_required
def get_users():
    all_users = User.query.outerjoin(Role).order_by(Role.name, User.first_name, User.username).all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'first_name': u.first_name,
        'email': u.email if current_user.role and current_user.role.name == 'Admin' else None,
        'is_active': u.is_active,
        'role': u.role.name if u.role else 'Member'
    } for u in all_users])

@api_bp.route('/expenses')
@json_login_required
def get_expenses():
    role_name = current_user.role.name if current_user.role else 'Member'
    if role_name in ['Admin', 'Owner', 'Accounts']:
        expenses = Expense.query.order_by(Expense.bill_date.desc()).all()
    else:
        expenses = Expense.query.filter_by(user_id=current_user.id).order_by(Expense.bill_date.desc()).all()
    
    return jsonify([{
        'id': e.id,
        'amount': e.amount,
        'category': e.category,
        'description': e.description,
        'status': e.status,
        'type': e.type,
        'bill_date': e.bill_date.strftime('%Y-%m-%d') if e.bill_date else None,
        'username': e.user.username if e.user else 'Unknown',
        'is_paid': e.is_paid
    } for e in expenses])

@api_bp.route('/activity_logs')
@json_login_required
def get_activity_logs():
    if not current_user.role or current_user.role.name not in ['Admin', 'Owner']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(100).all()
    return jsonify([{
        'id': log.id,
        'action': log.action,
        'details': log.details,
        'username': log.user.username if log.user else 'System',
        'timestamp': log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
        'ip_address': log.ip_address
    } for log in logs])

@api_bp.route('/profile', methods=['POST'])
@json_login_required
def update_profile():
    from flask import request
    from models import db
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Expected a JSON object'}), 400
    for field in ['email', 'first_name', 'last_name', 'new_password', 'current_password']:
        if field in data and not isinstance(data[field], str):
            return jsonify({'error': f'{field} must be text'}), 400
    email = data.get('email', current_user.email).strip()
    if not email or '@' not in email or len(email) > 120:
        return jsonify({'error': 'A valid email is required'}), 400
    if User.query.filter(User.id != current_user.id, (db.func.lower(User.email) == email.lower()) | (db.func.lower(User.username) == email.lower())).first():
        return jsonify({'error': 'Email already in use'}), 400
    if data.get('new_password'):
        if not current_user.check_password(data.get('current_password', '')):
            return jsonify({'error': 'Current password is incorrect'}), 400
        current_user.set_password(data['new_password'])
    current_user.email = email
    current_user.first_name = str(data.get('first_name', current_user.first_name or ''))[:100]
    current_user.last_name = str(data.get('last_name', current_user.last_name or ''))[:100]
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/expenses', methods=['POST'])
@json_login_required
def create_expense():
    import math
    from datetime import datetime
    from flask import request
    from models import db
    if not current_user.role or current_user.role.name not in ['Admin', 'Owner', 'Accounts']:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Expected a JSON object'}), 400
    try:
        amount = float(data.get('amount', 0))
        if isinstance(data.get('amount'), bool) or not math.isfinite(amount) or amount <= 0:
            raise ValueError()
        bill_date = datetime.strptime(data['bill_date'], '%Y-%m-%d')
    except (ValueError, TypeError, KeyError):
        return jsonify({'error': 'Enter a positive amount and valid bill date'}), 400
    if data.get('type') not in ['credit', 'debit']:
        return jsonify({'error': 'Invalid transaction type'}), 400
    expense = Expense(amount=amount, category=str(data.get('category', ''))[:100],
                      description=str(data.get('description', '')), bill_date=bill_date,
                      type=data['type'], user_id=current_user.id)
    db.session.add(expense)
    db.session.commit()
    return jsonify({'success': True, 'id': expense.id}), 201
