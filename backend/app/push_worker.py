"""Leased PostgreSQL outbox: retries survive restarts and multiple API replicas."""
import asyncio
import json
from datetime import timedelta
from sqlalchemy import or_, select
from .core.config import get_settings
from .db import SessionLocal
from .models import AuthSession, Notification, PushDelivery, PushDevice, User, now
from .notifications import fcm_message, preferences

_firebase = None


def send_fcm(message):
    global _firebase
    import firebase_admin
    from firebase_admin import credentials, messaging
    if _firebase is None:
        raw = get_settings().firebase_service_account_json.get_secret_value()
        _firebase = firebase_admin.initialize_app(credentials.Certificate(json.loads(raw)), name='shk-notifications')
    return messaging.send(message, app=_firebase)


def process_one(sender=send_fcm):
    with SessionLocal() as db:
        delivery = db.scalar(select(PushDelivery).where(PushDelivery.next_attempt_at <= now(),
            or_(PushDelivery.status == 'pending', (PushDelivery.status == 'sending') & (PushDelivery.lease_until < now())))
            .order_by(PushDelivery.id).with_for_update(skip_locked=True).limit(1))
        if not delivery:
            return False
        delivery.status, delivery.lease_until = 'sending', now() + timedelta(minutes=2)
        delivery.attempts += 1
        identifier = delivery.id
        db.commit()
    with SessionLocal() as db:
        delivery = db.get(PushDelivery, identifier)
        device = db.get(PushDevice, delivery.device_id)
        row = db.get(Notification, delivery.notification_id)
        session = db.get(AuthSession, device.session_id) if device else None
        user = db.get(User, row.user_id) if row else None
        pref = preferences(db, row.user_id) if row else None
        if (not device or not device.enabled or not row or device.user_id != row.user_id or not session or session.revoked
            or session.expires_at <= now() or not user or not user.is_active or not pref['enabled'] or not pref['categories'][row.category]
            or row.created_at < now() - timedelta(days=1)):
            delivery.status = 'skipped'
        else:
            try:
                sender(fcm_message(row, device, pref))
                delivery.status, delivery.error_code = 'delivered', ''
            except Exception as error:
                code = getattr(error, 'code', '') or type(error).__name__
                delivery.error_code = str(code)[:100]
                if code in {'NOT_FOUND', 'UNREGISTERED', 'registration-token-not-registered', 'messaging/registration-token-not-registered'}:
                    device.enabled = False
                    delivery.status = 'failed'
                else:
                    delivery.status = 'failed' if delivery.attempts >= 5 else 'pending'
                    delivery.next_attempt_at = now() + timedelta(seconds=min(900, 5 * 2 ** delivery.attempts))
        delivery.lease_until = None
        db.commit()
    return True


async def run_worker():
    if not get_settings().firebase_service_account_json:
        return
    while True:
        try:
            worked = await asyncio.to_thread(process_one)
        except Exception:
            # No tokens, credentials, payloads or personal content enter runtime logs.
            worked = False
        await asyncio.sleep(.1 if worked else 2)
