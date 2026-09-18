"""Regression coverage for request validation, account changes and reporting."""
from datetime import datetime, timezone
import test_application as support
ApplicationFixture, app, db, User, Role = support.ApplicationFixture, support.app, support.db, support.User, support.Role
from models import Expense
from socket_handlers import user_connections, online_users


class RegressionTests(ApplicationFixture):
    def test_admin_edit_email_and_preserve_password_spaces(self):
        response = self.client.post(f'/admin/users/{self.member.id}/edit', data={
            'username': self.member.username, 'email': 'changed@test.local', 'password': ' new password '})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.member.email, 'changed@test.local')
        self.assertTrue(self.member.check_password(' new password '))

    def test_rejected_edit_is_atomic(self):
        original = self.member.first_name
        self.client.post(f'/admin/users/{self.member.id}/edit', data={
            'name': 'Must not persist', 'username': self.admin.username.upper()})
        db.session.expire_all()
        self.assertEqual(self.member.first_name, original)
        self.assertEqual(self.member.username, 'member')

    def test_json_endpoints_reject_non_objects(self):
        for path in ['/api/profile', '/api/expenses', '/admin/tickets']:
            for data in [[1], 'string', 23, None]:
                with self.subTest(path=path, data=data):
                    response = self.client.post(path, json=data)
                    self.assertEqual(response.status_code, 400)

    def test_profile_and_ticket_reject_invalid_field_types(self):
        for data in [{'email': None}, {'new_password': 123}, {'first_name': []}]:
            self.assertEqual(self.client.post('/api/profile', json=data).status_code, 400)
        self.assertEqual(self.client.post('/admin/tickets', json={'subject': 'Help', 'description': None}).status_code, 400)
        self.assertEqual(self.client.post('/api/expenses', json={'amount': True, 'bill_date': '2026-01-01', 'type': 'credit'}).status_code, 400)

    def test_monthly_stats_exclude_next_month(self):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        future = datetime(now.year + (now.month == 12), now.month % 12 + 1, 1)
        for date, amount in [(now, 10), (future, 90)]:
            db.session.add(Expense(user_id=self.admin.id, amount=amount, type='credit', bill_date=date))
        db.session.commit()
        self.assertEqual(self.client.get('/admin/stats').json['monthly_credit'], 10)

    def test_logout_disconnects_live_sessions(self):
        socket = self.socket(self.member_client)
        self.assertTrue(socket.is_connected())
        self.member_client.get('/logout')
        self.assertFalse(socket.is_connected())
        self.assertNotIn(self.member.id, user_connections)

    def test_deactivation_disconnects_and_cleans_presence(self):
        socket = self.socket(self.member_client)
        self.client.post(f'/admin/users/{self.member.id}/toggle')
        self.assertFalse(socket.is_connected())
        self.assertNotIn(self.member.id, online_users)
        self.assertEqual(self.member_client.get('/api/me').status_code, 401)

    def test_role_edit_disconnects_old_privileged_socket(self):
        socket = self.socket(self.member_client)
        self.client.post(f'/admin/users/{self.member.id}/edit', data={'role_id': self.admin.role_id})
        self.assertFalse(socket.is_connected())

    def test_ed_can_list_archived_channels(self):
        group = self.channel()
        group.is_archived = True
        role = Role(name='ED')
        db.session.add(role)
        self.member.role = role
        db.session.commit()
        self.assertIn(group.id, [g['id'] for g in self.member_client.get('/admin/history_groups').json])

    def test_management_mutations_require_post(self):
        group = self.channel()
        for action in ['join', 'archive', 'delete']:
            self.assertEqual(self.client.get(f'/admin/groups/{group.id}/{action}').status_code, 405)
        self.assertFalse(group.is_archived)
        self.assertEqual(self.client.post(f'/admin/groups/{group.id}/archive').status_code, 302)
        self.assertTrue(group.is_archived)

    def test_case_insensitive_and_cross_identifier_collisions(self):
        for username, email in [('ADMIN', 'new@test.local'), (self.admin.email, 'new@test.local'), ('new', 'ADMIN')]:
            self.client.post('/admin/users/create', data={'username': username, 'email': email,
                'password': 'test', 'role_id': self.member.role_id})
            self.assertEqual(User.query.count(), 2)
        self.assertEqual(self.client.post('/api/profile', json={'email': self.member.email}).status_code, 400)

    def test_profile_identity_round_trip_includes_last_name(self):
        response = self.client.post('/api/profile', json={'first_name': 'Review', 'last_name': 'Tester'})
        self.assertEqual(response.status_code, 200)
        identity = self.client.get('/api/me').json
        self.assertEqual(identity['first_name'], 'Review')
        self.assertEqual(identity['last_name'], 'Tester')
