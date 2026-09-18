import io
import os
import unittest
from pathlib import Path

os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['SOCKETIO_ASYNC_MODE'] = 'threading'
os.environ['AUTO_CREATE_DB'] = '0'
os.environ['SESSION_COOKIE_SECURE'] = '0'
from flask import g
from flask.testing import FlaskClient
from app import app, initialize_database

class IsolatedClient(FlaskClient):
    def open(self, *args, **kwargs):
        g.pop('_login_user', None)
        return super().open(*args, **kwargs)

app.test_client_class = IsolatedClient
from extensions import socketio
from models import db, User, Role, Group, Message, SupportTicket
from socket_handlers import online_users, user_connections


class ApplicationFixture(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True, SECRET_KEY='test-only')
        self.context = app.app_context()
        self.context.push()
        db.create_all()
        for name in ['Admin', 'Member']:
            db.session.add(Role(name=name))
        db.session.flush()
        self.admin = User(username='admin', email='admin@test.local', role=Role.query.filter_by(name='Admin').one())
        self.admin.set_password(' password ')
        db.session.add(self.admin)
        self.member = User(username='member', email='member@test.local', role=Role.query.filter_by(name='Member').one())
        for user in [self.admin, self.member]:
            user.set_password(' password ')
            db.session.add(user)
        db.session.commit()
        self.client = app.test_client()
        self.member_client = app.test_client()
        self.login(self.client, self.admin)
        self.login(self.member_client, self.member)
        self.sockets = []

    def tearDown(self):
        for client in self.sockets:
            if client.is_connected():
                client.disconnect()
        db.session.remove()
        db.drop_all()
        online_users.clear()
        user_connections.clear()
        self.context.pop()

    def login(self, client, user):
        response = client.post('/login', data={'email': user.email, 'password': ' password '})
        self.assertEqual(response.status_code, 302)

    def channel(self, name='General'):
        response = self.client.post('/chat/create_group', data={'name': name})
        self.assertEqual(response.status_code, 200)
        return db.session.get(Group, response.json['id'])

    def socket(self, client):
        g.pop('_login_user', None)
        result = socketio.test_client(app, flask_test_client=client)
        original_emit = result.emit
        def emit(*args, **kwargs):
            g.pop('_login_user', None)
            return original_emit(*args, **kwargs)
        result.emit = emit
        self.sockets.append(result)
        return result



class ApplicationTests(ApplicationFixture):
    def test_create_channel_once(self):
        group = self.channel()
        self.assertEqual(group.members.count(), 1)
        self.assertEqual(self.client.post('/admin/groups/create', data={'name': 'Other'}).status_code, 302)
        self.assertEqual(Group.query.count(), 2)

    def test_page_routes_and_built_assets(self):
        for path in ['/chat/', '/chat/1', '/admin/', '/users', '/history', '/tickets', '/expenses', '/logs', '/profile']:
            if path == '/chat/1':
                self.channel()
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertIn(b'/static/dist/assets/main-', response.data, path)
        import json
        manifest = json.loads(Path('static/dist/.vite/manifest.json').read_text())
        for entry in manifest.values():
            with self.client.get('/static/dist/' + entry['file']) as response:
                self.assertEqual(response.status_code, 200)

    def test_validation_and_disabled_account(self):
        guest = app.test_client()
        self.assertEqual(guest.get('/api/me').status_code, 401)
        for data in [{}, {'username': 'admin', 'email': 'new@test.local', 'password': 'x'}]:
            self.assertEqual(guest.post('/signup', data=data).status_code, 302)
        self.assertEqual(User.query.count(), 2)
        self.member.is_active = False
        db.session.commit()
        self.assertEqual(self.member_client.get('/api/me').status_code, 401)
        self.assertEqual(guest.post('/login', data={'email': self.member.email, 'password': ' password '}).status_code, 200)

    def test_socket_authorization_membership_and_typing(self):
        group = self.channel()
        admin_socket = self.socket(self.client)
        member_socket = self.socket(self.member_client)
        member_socket.get_received()
        admin_socket.emit('send_message', {'group_id': group.id, 'content': 'private'})
        self.assertFalse(any(e['name'] == 'receive_message' for e in member_socket.get_received()))
        self.client.post(f'/chat/connect_users/{group.id}', data={'user_ids': [str(self.member.id), str(self.member.id)]})
        self.assertEqual(group.members.count(), 1)
        member_socket.get_received()
        admin_socket.emit('send_message', {'group_id': group.id, 'content': 'shared'})
        self.assertTrue(any(e['name'] == 'receive_message' for e in member_socket.get_received()))
        admin_socket.emit('typing', {'group_id': group.id})
        events = [e for e in member_socket.get_received() if e['name'] == 'user_typing']
        self.assertEqual(events[0]['args'][0]['group_id'], group.id)
        self.client.post(f'/chat/connect_users/{group.id}', data={})
        member_socket.get_received()
        admin_socket.emit('send_message', {'group_id': group.id, 'content': 'private again'})
        self.assertFalse(any(e['name'] == 'receive_message' for e in member_socket.get_received()))

    def test_replies_and_attachments_survive_history(self):
        group = self.channel()
        other = self.channel('Private')
        sock = self.socket(self.client)
        sock.emit('send_message', {'group_id': other.id, 'content': 'secret'})
        parent = Message.query.one()
        sock.emit('send_message', {'group_id': group.id, 'content': 'cross-channel', 'parent_id': parent.id})
        self.assertEqual(Message.query.count(), 1)
        sock.emit('send_message', {'group_id': other.id, 'parent_id': parent.id, 'file_url': '/static/uploads/document/test.pdf', 'file_name': 'test.pdf'})
        history = self.client.get(f'/chat/load_history/{other.id}').json
        self.assertEqual(history[0]['replies'][0]['content'], 'test.pdf')
        self.assertIn('file_url', history[0]['replies'][0])

    def test_upload_validation(self):
        for filename in ['bad.png', 'bad.html', 'bad.svg']:
            response = self.client.post('/chat/upload', data={'file': (io.BytesIO(b'not an image'), filename)})
            self.assertEqual(response.status_code, 400, filename)
        from PIL import Image
        image = io.BytesIO()
        Image.new('RGB', (10, 10), 'red').save(image, format='PNG')
        image.seek(0)
        self.assertEqual(self.client.post('/chat/upload', data={'file': (image, 'valid.png')}).status_code, 200)

    def test_multiple_connections_presence(self):
        first, second = self.socket(self.client), self.socket(self.client)
        first.disconnect()
        self.assertIn(self.admin.id, online_users)
        second.disconnect()
        self.assertNotIn(self.admin.id, online_users)

    def test_delete_user_with_support_ticket(self):
        db.session.add(SupportTicket(subject='Help', description='Issue', user_id=self.member.id))
        db.session.commit()
        self.assertEqual(self.client.delete(f'/admin/users/{self.member.id}/delete').status_code, 200)

    def test_profile_and_password_updates(self):
        response = self.member_client.post('/api/profile', json={'first_name': 'Updated', 'last_name': 'Member', 'email': 'updated@test.local'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.member_client.get('/api/me').json['last_name'], 'Member')
        self.assertEqual(self.member_client.post('/api/profile', json={'email': self.admin.email}).status_code, 400)
        self.assertEqual(self.member_client.post('/api/profile', json={'new_password': 'new', 'current_password': 'wrong'}).status_code, 400)
        self.assertEqual(self.member_client.post('/api/profile', json={'new_password': 'new', 'current_password': ' password '}).status_code, 200)
        self.assertTrue(self.member.check_password('new'))

    def test_transactions_and_permissions(self):
        data = {'amount': 100, 'bill_date': '2026-09-18', 'type': 'debit', 'category': 'Test', 'description': 'Test expense'}
        self.assertEqual(self.member_client.post('/api/expenses', json=data).status_code, 403)
        self.assertEqual(self.client.post('/api/expenses', json=data).status_code, 201)
        self.assertEqual(len(self.client.get('/api/expenses').json), 1)
        for amount in ['NaN', -1, 'invalid']:
            self.assertEqual(self.client.post('/api/expenses', json={**data, 'amount': amount}).status_code, 400)
        self.assertEqual(self.member_client.get('/admin/stats', headers={'Accept': 'application/json'}).status_code, 403)

    def test_ticket_creation_resolution_and_audit(self):
        self.assertEqual(self.member_client.post('/admin/tickets', json={}).status_code, 400)
        response = self.member_client.post('/admin/tickets', json={'subject': 'Issue', 'description': 'Details'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.member_client.post('/admin/tickets/%s/resolve' % response.json['id']).status_code, 200)
        self.assertEqual(self.member_client.get('/admin/tickets').json[0]['status'], 'closed')
        self.assertGreater(len(self.client.get('/api/activity_logs').json), 0)

    def test_initialization_preserves_credentials_and_creates_missing_tables(self):
        original = self.admin.password_hash
        SupportTicket.__table__.drop(db.engine)
        os.environ['AUTO_CREATE_DB'] = '1'
        os.environ['ADMIN_EMAIL'] = self.admin.email
        os.environ['ADMIN_PASSWORD'] = 'must-not-reset'
        try:
            initialize_database()
            self.assertEqual(db.session.get(User, self.admin.id).password_hash, original)
            self.assertEqual(SupportTicket.query.count(), 0)
        finally:
            os.environ['AUTO_CREATE_DB'] = '0'
            os.environ.pop('ADMIN_PASSWORD')


if __name__ == '__main__':
    unittest.main()
