"""Explicit administrator creation; never resets an existing account."""
import os
from getpass import getpass


def create_admin():
    email = input('Administrator email: ').strip()
    if not email or '@' not in email:
        raise SystemExit('A valid email is required.')
    password = getpass('New administrator password: ')
    if not password:
        raise SystemExit('Password cannot be empty.')
    os.environ['ADMIN_EMAIL'] = email
    os.environ['ADMIN_PASSWORD'] = password
    os.environ['AUTO_CREATE_DB'] = '1'
    from app import app, initialize_database
    initialize_database()
    print('Administrator initialization complete; existing credentials were preserved.')


if __name__ == '__main__':
    create_admin()
