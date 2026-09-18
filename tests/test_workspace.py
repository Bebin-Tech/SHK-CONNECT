"""Conversation integration tests using isolated users and an in-memory database."""
from flask import g
import test_application as support
from models import db, User, Role, Message, ConversationRead

app = support.app

def third_user(test):
    user = User(username='third', email='third@test.local', role=Role.query.filter_by(name='Member').one())
    user.set_password(' password ')
    db.session.add(user)
    db.session.commit()
    client = app.test_client()
    test.login(client, user)
    return user, client



class WorkspaceTests(support.ApplicationFixture):
    def test_dm_privacy(self):
        third, third_client = third_user(self)
        sender = self.socket(self.client)
        receiver = self.socket(self.member_client)
        outsider = self.socket(third_client)
        sender.get_received(); receiver.get_received(); outsider.get_received()
        ack = sender.emit('send_message', {'recipient_id': self.member.id, 'content': 'Private hello'}, callback=True)
        self.assertTrue(ack['ok'])
        self.assertEqual(Message.query.count(), 1)
        self.assertTrue(any(event['name'] == 'receive_message' for event in receiver.get_received()))
        self.assertFalse(any(event['name'] in ['receive_message', 'new_notification'] for event in outsider.get_received()))
        response = self.member_client.get(f'/api/conversations/dm/{self.admin.id}/messages')
        self.assertEqual(response.json['messages'][0]['content'], 'Private hello')
        response = third_client.get(f'/api/conversations/dm/{self.admin.id}/messages')
        self.assertEqual(response.json['messages'], [])
        root = Message.query.one()
        self.assertEqual(third_client.get(f'/api/threads/{root.id}').status_code, 403)
        self.assertEqual(third_client.get(f'/api/conversations/dm/{self.admin.id}/search?q=Private').json, [])
        self.assertEqual(self.client.get(f'/dm/{self.member.id}').status_code, 200)


    def test_unread_cursors(self):
        sender = self.socket(self.client)
        for text in ['One', 'Two']:
            sender.emit('send_message', {'recipient_id': self.member.id, 'content': text})
        ids = [row.id for row in Message.query.order_by(Message.id)]
        def unread():
            return next(person['unread'] for person in self.member_client.get('/api/workspace').json['people'] if person['id'] == self.admin.id)
        self.assertEqual(unread(), 2)
        path = f'/api/conversations/dm/{self.admin.id}/read'
        self.assertEqual(self.member_client.post(path, json={'last_message_id': ids[0]}).status_code, 200)
        self.assertEqual(unread(), 1)
        self.member_client.post(path, json={'last_message_id': ids[1]})
        self.member_client.post(path, json={'last_message_id': ids[0]})
        self.assertEqual(unread(), 0)
        g.pop('_login_user', None)
        self.assertEqual(db.session.get(ConversationRead, (self.member.id, f'dm:{self.admin.id}')).last_message_id, ids[1])
        sender.emit('send_message', {'recipient_id': self.member.id, 'content': 'Three'})
        self.assertEqual(unread(), 1)
        self.assertEqual(self.member_client.post(path, json={'last_message_id': 'bad'}).status_code, 400)
        self.assertEqual(next(person['unread'] for person in self.client.get('/api/workspace').json['people'] if person['id'] == self.member.id), 0)


    def test_thread_scope(self):
        third, _ = third_user(self)
        sender = self.socket(self.client)
        receiver = self.socket(self.member_client)
        sender.emit('send_message', {'recipient_id': self.member.id, 'content': 'Root'})
        root = Message.query.one()
        ack = receiver.emit('send_message', {'recipient_id': self.admin.id, 'content': 'Reply', 'parent_id': root.id}, callback=True)
        self.assertTrue(ack['ok'])
        response = self.member_client.get(f'/api/threads/{root.id}')
        self.assertEqual(response.json['replies'][0]['content'], 'Reply')
        ack = sender.emit('send_message', {'recipient_id': third.id, 'content': 'Leak', 'parent_id': root.id}, callback=True)
        self.assertFalse(ack['ok'])
        self.assertEqual(Message.query.count(), 2)
        group = self.channel()
        self.assertFalse(sender.emit('send_message', {'group_id': group.id, 'content': 'Leak', 'parent_id': root.id}, callback=True)['ok'])
        self.assertFalse(sender.emit('send_message', {'recipient_id': self.member.id, 'group_id': group.id, 'content': 'Ambiguous'}, callback=True)['ok'])


    def test_history_pagination_and_search(self):
        for index in range(55):
            db.session.add(Message(content=f'Transcript {index}', user_id=self.admin.id, recipient_id=self.member.id))
        db.session.commit()
        path = f'/api/conversations/dm/{self.admin.id}/messages'
        first = self.member_client.get(path).json
        self.assertEqual(len(first['messages']), 50)
        self.assertTrue(first['has_more'])
        second = self.member_client.get(path + '?before=' + str(first['messages'][0]['id'])).json
        self.assertEqual(len(second['messages']), 5)
        self.assertFalse(second['has_more'])
        self.assertTrue(set(m['id'] for m in first['messages']).isdisjoint(m['id'] for m in second['messages']))
        matches = self.member_client.get(f'/api/conversations/dm/{self.admin.id}/search?q=Transcript%2054').json
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]['content'], 'Transcript 54')


    def test_group_privacy_and_unread(self):
        group = self.channel()
        sender = self.socket(self.client)
        sender.emit('send_message', {'group_id': group.id, 'content': 'Group message'})
        self.assertEqual(self.member_client.get(f'/api/conversations/group/{group.id}/messages').status_code, 403)
        self.assertEqual(self.member_client.get('/api/workspace').json['channels'], [])
        self.assertEqual(self.member_client.post(f'/api/conversations/group/{group.id}/read', json={'last_message_id': 999}).status_code, 403)
        self.client.post(f'/chat/connect_users/{group.id}', data={'user_ids': str(self.member.id)})
        self.assertEqual(self.member_client.get('/api/workspace').json['channels'][0]['unread'], 1)
        group.is_archived = True; db.session.commit()
        self.assertEqual(self.member_client.get(f'/api/conversations/group/{group.id}/messages').status_code, 403)
        self.assertEqual(self.member_client.get('/api/workspace').json['channels'], [])


    def test_dm_typing_and_invalid_recipients(self):
        third, third_client = third_user(self)
        sender, receiver, outsider = self.socket(self.client), self.socket(self.member_client), self.socket(third_client)
        receiver.get_received(); outsider.get_received()
        sender.emit('typing', {'recipient_id': self.member.id})
        events = [event for event in receiver.get_received() if event['name'] == 'user_typing']
        self.assertEqual(events[0]['args'][0]['user_id'], self.admin.id)
        self.assertFalse(any(event['name'] == 'user_typing' for event in outsider.get_received()))
        self.assertFalse(sender.emit('send_message', {'recipient_id': self.admin.id, 'content': 'Self'}, callback=True)['ok'])
        self.member.is_active = False; db.session.commit()
        self.assertFalse(sender.emit('send_message', {'recipient_id': self.member.id, 'content': 'Disabled'}, callback=True)['ok'])
        self.assertEqual(Message.query.count(), 0)

    def test_private_attachment_delivery(self):
        import io
        import tempfile
        third, third_client = third_user(self)
        old_folder = app.config['UPLOAD_FOLDER']
        try:
            with tempfile.TemporaryDirectory() as folder:
                app.config['UPLOAD_FOLDER'] = folder
                response = self.client.post('/chat/upload', data={'file': (io.BytesIO(b'Private document'), 'test.txt')})
                self.assertEqual(response.status_code, 200)
                url = response.json['url']
                self.assertEqual(third_client.get(url).status_code, 403)
                outsider = self.socket(third_client)
                self.assertFalse(outsider.emit('send_message', {'recipient_id': self.member.id, 'file_url': url}, callback=True)['ok'])
                sender = self.socket(self.client)
                ack = sender.emit('send_message', {'recipient_id': self.member.id, 'file_url': url, 'file_name': 'test.txt'}, callback=True)
                self.assertTrue(ack['ok'])
                with self.member_client.get(url) as downloaded:
                    self.assertEqual(downloaded.status_code, 200)
                    self.assertEqual(downloaded.data, b'Private document')
                self.assertEqual(third_client.get(url).status_code, 403)
        finally:
            app.config['UPLOAD_FOLDER'] = old_folder
