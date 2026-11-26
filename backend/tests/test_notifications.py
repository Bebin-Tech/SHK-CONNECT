from sqlalchemy import func, select
from backend.app.db import SessionLocal
from backend.app.models import Notification, PushDelivery, PushDevice, now
from backend.app.api.notifications import event_batch
from backend.app.push_worker import process_one

BASE = '/api/v1/notifications'


def publish(client, headers, **changes):
    data = {'category': 'assignments', 'title': 'Assignment ready', 'body': 'Review your assignment.',
            'recipient_ids': [2], 'event_key': 'assignment-1'}
    return client.post(f'{BASE}/publish', headers=headers, json={**data, **changes})


def test_private_inbox_categories_read_and_publisher_permissions(client, auth):
    admin, _ = auth()
    alice, _ = auth('alice')
    bob, _ = auth('bob')
    assert client.get(BASE).status_code == 401
    assert publish(client, alice).status_code == 403
    assert publish(client, admin, category='invalid').status_code == 422
    assert publish(client, admin).status_code == 201
    assert publish(client, admin).status_code == 201
    page = client.get(BASE, headers=alice).json()
    assert page['unread_count'] == 1 and len(page['items']) == 1
    item = page['items'][0]
    assert item['category'] == 'assignments'
    assert client.get(BASE, headers=bob).json()['items'] == []
    assert client.get(f'{BASE}/item/{item["id"]}', headers=bob).status_code == 404
    assert client.post(f'{BASE}/{item["id"]}/read', headers=bob).status_code == 404
    assert client.post(f'{BASE}/{item["id"]}/read', headers=alice).status_code == 204
    assert client.get(BASE, headers=alice).json()['unread_count'] == 0
    assert client.put(f'{BASE}/preferences', headers=alice, json={'categories': {'unknown': False}}).status_code == 422


def test_message_notifications_and_device_session_privacy(client, auth):
    alice, _ = auth('alice')
    bob, pair = auth('bob')
    admin, _ = auth()
    token = 'fake-push-address-with-at-least-20-characters'
    device = client.post(f'{BASE}/devices', headers=bob, json={'token': token, 'platform': 'android'}).json()
    assert client.delete(f'{BASE}/devices/{device["id"]}', headers=alice).status_code == 404
    message = {'content': 'Private update', 'client_id': 'notify-dm'}
    for _ in range(2):
        assert client.post('/api/v1/conversations/dm/3/messages', headers=alice, json=message).status_code == 201
    assert client.get(BASE, headers=alice).json()['items'] == []
    assert client.get(BASE, headers=admin).json()['items'] == []
    item = client.get(BASE, headers=bob).json()['items'][0]
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(PushDelivery)) == 1
        sid = db.get(PushDevice, device['id']).session_id
    assert event_batch(3, sid, 0)[0]['id'] == item['id']
    assert client.post('/api/v1/auth/logout', headers=bob).status_code == 204
    assert event_batch(3, sid, 0) is None
    assert process_one(lambda message: (_ for _ in ()).throw(AssertionError('Must not deliver after logout')))
    with SessionLocal() as db:
        assert not db.get(PushDevice, device['id']).enabled
        assert db.scalar(select(PushDelivery)).status == 'skipped'


def test_outbox_retries_and_private_sound_payload(client, auth):
    admin, _ = auth()
    alice, _ = auth('alice')
    client.post(f'{BASE}/devices', headers=alice, json={'token': 'another-fake-token-with-20-characters', 'platform': 'ios'})
    publish(client, admin)
    captured = []

    def fail(message):
        raise RuntimeError('temporary network error')

    assert process_one(fail)
    with SessionLocal() as db:
        row = db.scalar(select(PushDelivery))
        assert row.status == 'pending' and row.attempts == 1 and row.error_code == 'RuntimeError'
        row.next_attempt_at = now()
        db.commit()
    assert process_one(captured.append)
    assert captured[0].notification.title == 'SHK Connect'
    assert 'Assignment' not in captured[0].notification.body
    assert captured[0].apns.payload.aps.sound == 'default'
    with SessionLocal() as db:
        row = db.scalar(select(PushDelivery))
        assert row.status == 'delivered' and row.attempts == 2
    assert not process_one(captured.append)


def test_muted_preferences_stop_pending_delivery_and_preserve_inbox(client, auth):
    admin, _ = auth()
    alice, _ = auth('alice')
    client.post(f'{BASE}/devices', headers=alice, json={'token': 'muted-device-address-at-least-20-chars', 'platform': 'android'})
    publish(client, admin)
    assert client.put(f'{BASE}/preferences', headers=alice,
                      json={'enabled': True, 'sound': False, 'categories': {'assignments': False}}).status_code == 200
    assert process_one(lambda message: (_ for _ in ()).throw(AssertionError('Muted category must not send')))
    assert len(client.get(BASE, headers=alice).json()['items']) == 1
    publish(client, admin, event_key='assignment-2')
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Notification)) == 2
        assert db.scalar(select(func.count()).select_from(PushDelivery)) == 1


def test_device_token_reassignment_does_not_leak_previous_account_updates(client, auth):
    admin, _ = auth()
    alice, _ = auth('alice')
    bob, _ = auth('bob')
    data = {'token': 'shared-device-push-address-at-least-20-chars', 'platform': 'android'}
    old = client.post(f'{BASE}/devices', headers=alice, json=data).json()['id']
    publish(client, admin)
    new = client.post(f'{BASE}/devices', headers=bob, json=data).json()['id']
    assert old == new
    assert process_one(lambda message: (_ for _ in ()).throw(AssertionError('Must not send old user content to a reassigned device')))
    with SessionLocal() as db:
        assert db.scalar(select(PushDelivery)).status == 'skipped'
