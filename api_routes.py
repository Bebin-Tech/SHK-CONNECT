from flask import Blueprint, jsonify, abort
from flask_login import current_user
from models import User, Group, Role

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
