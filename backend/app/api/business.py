from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from .. import schemas
from ..core.security import MANAGEMENT, audit, current_user, hash_password, public_user, require
from ..db import get_db
from ..models import AuditLog, AuthSession, Channel, Message, User
from .auth import ensure_unique

router = APIRouter(tags=['Administration'])


@router.get('/users')
def users(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = list(db.scalars(select(User).order_by(User.username)))
    return [public_user(u) if user.role in {'Admin', 'Owner'} else
            {'id': u.id, 'username': u.username, 'first_name': u.first_name, 'role': u.role, 'is_active': u.is_active} for u in rows]


@router.post('/users', status_code=201)
def create_user(data: schemas.CreateUser, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, {'Admin'})
    ensure_unique(db, data.username, str(data.email))
    row = User(**data.model_dump(exclude={'password'}), password_hash=hash_password(data.password))
    db.add(row)
    audit(db, user, 'user.create', data.username)
    db.commit()
    return public_user(row)


@router.patch('/users/{user_id}')
def edit_user(user_id: int, data: schemas.UserEdit, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, {'Admin'})
    row = db.get(User, user_id)
    if not row:
        raise HTTPException(404, 'User not found')
    if row.id == user.id and (not data.is_active or data.role != 'Admin'):
        raise HTTPException(409, 'You cannot remove your own administrator access')
    row.role, row.is_active = data.role, data.is_active
    db.execute(update(AuthSession).where(AuthSession.user_id == row.id).values(revoked=True))
    audit(db, user, 'user.update', str(user_id))
    db.commit()
    return public_user(row)


@router.get('/audit')
def logs(offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100),
         user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, {'Admin', 'Owner'})
    return list(db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).offset(offset).limit(limit)))


@router.get('/dashboard')
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    require(user, MANAGEMENT)
    return {'users': db.scalar(select(func.count()).select_from(User)),
            'channels': db.scalar(select(func.count()).select_from(Channel).where(Channel.is_archived.is_(False))),
            'messages': db.scalar(select(func.count()).select_from(Message))}
