from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


members = Table('channel_members', Base.metadata,
    Column('user_id', ForeignKey('users.id'), primary_key=True),
    Column('channel_id', ForeignKey('channels.id'), primary_key=True))


class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    email: Mapped[str] = mapped_column(String(120), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    first_name: Mapped[str] = mapped_column(String(100), default='')
    last_name: Mapped[str] = mapped_column(String(100), default='')
    role: Mapped[str] = mapped_column(String(20), default='Member')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=now)


class AuthSession(Base):
    __tablename__ = 'auth_sessions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[bool] = mapped_column(default=False)


class LoginAttempt(Base):
    __tablename__ = 'login_attempts'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    attempts: Mapped[int] = mapped_column(default=0)
    window_start: Mapped[datetime] = mapped_column(default=now)


class Channel(Base):
    __tablename__ = 'channels'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(255), default='')
    is_archived: Mapped[bool] = mapped_column(default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(default=now)
    members: Mapped[list[User]] = relationship(secondary=members, lazy='selectin')


class Message(Base):
    __tablename__ = 'messages'
    __table_args__ = (Index('ix_messages_channel_cursor', 'channel_id', 'id'),
                     Index('ix_messages_dm_cursor', 'user_id', 'recipient_id', 'id'),
                     UniqueConstraint('user_id', 'client_id'))
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    channel_id: Mapped[int | None] = mapped_column(ForeignKey('channels.id'))
    recipient_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey('messages.id'), index=True)
    content: Mapped[str] = mapped_column(Text)
    client_id: Mapped[str | None] = mapped_column(String(64))
    attachment_id: Mapped[str | None] = mapped_column(ForeignKey('attachments.id'))
    is_pinned: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=now)
    author: Mapped[User] = relationship(foreign_keys=[user_id], lazy='joined')


class Attachment(Base):
    __tablename__ = 'attachments'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)


class ReadCursor(Base):
    __tablename__ = 'read_cursors'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    conversation: Mapped[str] = mapped_column(String(50), primary_key=True)
    last_message_id: Mapped[int] = mapped_column(default=0)


class Presence(Base):
    __tablename__ = 'presence'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    last_seen: Mapped[datetime] = mapped_column(default=now)
    conversation: Mapped[str] = mapped_column(String(50), default='')
    typing_at: Mapped[datetime | None] = mapped_column(DateTime)


class Expense(Base):
    __tablename__ = 'expenses'
    id: Mapped[int] = mapped_column(primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default='')
    status: Mapped[str] = mapped_column(String(20), default='pending')
    type: Mapped[str] = mapped_column(String(10), default='debit')
    bill_date: Mapped[datetime] = mapped_column(default=now)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    created_at: Mapped[datetime] = mapped_column(default=now)


class Ticket(Base):
    __tablename__ = 'tickets'
    id: Mapped[int] = mapped_column(primary_key=True)
    subject: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='open')
    priority: Mapped[str] = mapped_column(String(20), default='medium')
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    created_at: Mapped[datetime] = mapped_column(default=now)


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    action: Mapped[str] = mapped_column(String(255))
    details: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(default=now, index=True)


class NotificationPreference(Base):
    __tablename__ = 'notification_preferences'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=True)
    sound: Mapped[bool] = mapped_column(default=True)
    show_preview: Mapped[bool] = mapped_column(default=False)
    categories: Mapped[dict] = mapped_column(JSON, default=dict)


class Notification(Base):
    __tablename__ = 'notifications'
    __table_args__ = (UniqueConstraint('user_id', 'event_key'), Index('ix_notifications_user_cursor', 'user_id', 'id'))
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    category: Mapped[str] = mapped_column(String(24))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(String(2000))
    event_key: Mapped[str] = mapped_column(String(100))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=now)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)


class PushDevice(Base):
    __tablename__ = 'push_devices'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    session_id: Mapped[str] = mapped_column(ForeignKey('auth_sessions.id'))
    token: Mapped[str] = mapped_column(Text)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    platform: Mapped[str] = mapped_column(String(10))
    enabled: Mapped[bool] = mapped_column(default=True)
    updated_at: Mapped[datetime] = mapped_column(default=now)


class PushDelivery(Base):
    __tablename__ = 'push_deliveries'
    __table_args__ = (UniqueConstraint('notification_id', 'device_id'), Index('ix_push_delivery_due', 'status', 'next_attempt_at'))
    id: Mapped[int] = mapped_column(primary_key=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey('notifications.id'))
    device_id: Mapped[str] = mapped_column(ForeignKey('push_devices.id'))
    status: Mapped[str] = mapped_column(String(12), default='pending')
    attempts: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime)
    error_code: Mapped[str] = mapped_column(String(100), default='')
