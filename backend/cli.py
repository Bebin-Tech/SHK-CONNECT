"""Administrative commands. Never run schema creation inside API workers."""
import argparse
import getpass
from sqlalchemy import select
from .app.core.security import hash_password
from .app.db import SessionLocal
from .app.models import User
from .app.schemas import Register


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['create-admin'])
    parser.parse_args()
    email = input('Administrator email: ').strip()
    password = getpass.getpass('Password (at least 12 characters): ')
    data = Register(username=email.split('@')[0], email=email, password=password)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == str(data.email))):
            raise SystemExit('Account already exists; no password was changed.')
        db.add(User(username=data.username, email=str(data.email), password_hash=hash_password(data.password), role='Admin'))
        db.commit()
    print('Administrator created.')


if __name__ == '__main__':
    main()
