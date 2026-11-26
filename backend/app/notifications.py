"""Private inbox and transactional push outbox shared by every activity module."""
from datetime import timedelta
from uuid import uuid4
from sqlalchemy import select
from .models import Notification, NotificationPreference, PushDelivery, PushDevice, User

CATEGORIES = ('messages', 'attendance', 'assignments', 'seminars', 'approvals', 'announcements')


def preferences(db, user_id):
    row = db.get(NotificationPreference, user_id)
    return {'enabled': row.enabled if row else True, 'sound': row.sound if row else True,
            'show_preview': row.show_preview if row else False,
            'categories': {key: (row.categories or {}).get(key, True) if row else True for key in CATEGORIES}}


def serialize(row):
    return {'id': row.id, 'category': row.category, 'title': row.title, 'body': row.body,
            'data': row.data, 'created_at': row.created_at.isoformat() + 'Z',
            'read_at': row.read_at.isoformat() + 'Z' if row.read_at else None}


def notify(db, recipients, category, title, body, event_key=None, data=None):
    """Caller commits this in the same transaction as the activity it describes."""
    if category not in CATEGORIES:
        raise ValueError('Unknown notification category')
    key = event_key or str(uuid4())
    result = []
    for uid in set(recipients):
        user = db.get(User, uid)
        if not user or not user.is_active:
            continue
        existing = db.scalar(select(Notification).where(Notification.user_id == uid, Notification.event_key == key))
        if existing:
            result.append(existing)
            continue
        row = Notification(user_id=uid, category=category, title=title[:160], body=body[:2000], event_key=key, data=data or {})
        db.add(row)
        db.flush()
        pref = preferences(db, uid)
        if pref['enabled'] and pref['categories'][category]:
            for device in db.scalars(select(PushDevice).where(PushDevice.user_id == uid, PushDevice.enabled.is_(True))):
                db.add(PushDelivery(notification_id=row.id, device_id=device.id))
        result.append(row)
    return result


def fcm_message(row, device, pref):
    from firebase_admin import messaging
    title = row.title if pref['show_preview'] else 'SHK Connect'
    body = row.body if pref['show_preview'] else 'You have a new update. Open the app to view it.'
    sound = pref['sound']
    return messaging.Message(fid=device.token,
        notification=messaging.Notification(title=title, body=body),
        data={'notification_id': str(row.id)},
        android=messaging.AndroidConfig(priority='high', ttl=timedelta(days=1),
            notification=messaging.AndroidNotification(channel_id='shk_alerts' if sound else 'shk_silent',
                sound='default' if sound else None, tag=f'shk-{row.id}', visibility='private')),
        apns=messaging.APNSConfig(headers={'apns-priority': '10', 'apns-push-type': 'alert'},
            payload=messaging.APNSPayload(messaging.Aps(sound='default' if sound else None))))
