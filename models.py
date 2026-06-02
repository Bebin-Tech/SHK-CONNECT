from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# Association table for Group Members
group_members = db.Table('group_members',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow)
)

# Association table for Role-based Group Access
group_roles = db.Table('group_roles',
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id'), primary_key=True)
)

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200))

    def __repr__(self):
        return f'<Role {self.name}>'

class User(db.Model, UserMixin):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    role = db.relationship('Role', backref=db.backref('users', lazy=True))
    messages_sent = db.relationship('Message', foreign_keys='Message.user_id', backref='author', lazy=True)
    messages_received = db.relationship('Message', foreign_keys='Message.recipient_id', backref='recipient', lazy=True)
    groups = db.relationship('Group', secondary=group_members, backref=db.backref('members', lazy='dynamic'))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255))
    avatar_url = db.Column(db.String(255))
    invite_code = db.Column(db.String(10), unique=True)
    is_archived = db.Column(db.Boolean, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    creator = db.relationship('User', foreign_keys=[created_by], backref='groups_created')
    messages = db.relationship('Message', backref='group', lazy=True, cascade="all, delete-orphan")
    roles = db.relationship('Role', secondary=group_roles, backref=db.backref('groups', lazy='dynamic'))

    @staticmethod
    def apply_default_access(group, user):
        """Helper to set default individual access for a new group."""
        # By default, only the creator is added.
        # Admins/Owners can see all channels due to logic in chat_routes.py
        if user not in group.members:
            group.members.append(user)

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True, index=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=True)
    is_pinned = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    message_type = db.Column(db.String(20), default='text') # text, file
    file_url = db.Column(db.String(255))
    
    # Self-referential relationship for replies
    replies = db.relationship('Message', backref=db.backref('parent', remote_side=[id]), lazy=True, cascade="all, delete-orphan")

class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(100))
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending') # pending, approved, rejected, paid
    type = db.Column(db.String(10), default='debit') # credit, debit
    is_paid = db.Column(db.Boolean, default=False)
    bill_date = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    bill_url = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='expenses')
    approver = db.relationship('User', foreign_keys=[approved_by], backref='approved_expenses')

class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(255), nullable=False)
    details = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(45))

    user = db.relationship('User', backref='activity_logs')

class SupportTicket(db.Model):
    __tablename__ = 'support_tickets'
    id = db.Column(db.Integer, primary_key=True)
    subject = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='open') # open, in_progress, closed
    priority = db.Column(db.String(20), default='medium') # low, medium, high
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref='tickets')
