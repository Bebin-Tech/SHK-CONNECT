from flask import Blueprint, jsonify, abort, request
from flask_login import current_user
from models import User, Group, Role, Expense, ActivityLog, db

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
        'member_count': g.members.count()
    } for g in groups])

@api_bp.route('/users')
@json_login_required
def get_users():
    all_users = User.query.join(Role).order_by(Role.name, User.first_name, User.username).all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'first_name': u.first_name,
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
        'bill_date': e.bill_date.strftime('%Y-%m-%d'),
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
        'id': l.id,
        'action': l.action,
        'details': l.details,
        'username': l.user.username if l.user else 'System',
        'timestamp': l.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
        'ip_address': l.ip_address
    } for l in logs])
