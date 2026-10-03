import bcrypt, hashlib, secrets
from datetime import timedelta, datetime, timezone
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, delete
from .db import get_db
from .models import User, LoginSession, now
from .config import SESSION_HOURS


def hash_password(password):
    raw = password.encode("utf8")
    if len(raw) > 72:
        raise HTTPException(422, "Password must be at most 72 UTF-8 bytes.")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode()


def verify_password(password, hashed):
    raw = password.encode("utf8")
    return len(raw) <= 72 and bcrypt.checkpw(raw, hashed.encode())


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db, user):
    token = secrets.token_urlsafe(32)
    db.add(
        LoginSession(
            token_hash=token_hash(token),
            user_id=user.id,
            expires_at=now() + timedelta(hours=SESSION_HOURS),
        )
    )
    return token


def current_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get("casa_session", "")
    s = db.get(LoginSession, token_hash(token)) if token else None
    if not s or s.expires_at.replace(tzinfo=timezone.utc) <= now():
        raise HTTPException(401, "Please log in.")
    u = db.get(User, s.user_id)
    if not u or not u.active:
        raise HTTPException(401, "Account is inactive.")
    return u


def admin(user=Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin access required.")
    return user
