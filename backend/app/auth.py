"""Bearer-token authentication and role checks.

Tokens are signed with SECRET_KEY (itsdangerous, installed with Flask) and expire after TOKEN_MAX_AGE.
Each token belongs to one sign-in session (sessions table), so the audit log can show how long every
member used the system, and logging out ends that token for good.
The front end sends:  Authorization: Bearer <token>
"""
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import current_app, g, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .db import execute, now, query
from .errors import fail

TOUCH_EVERY = timedelta(seconds=60)      # how often a session's last_seen is refreshed


def _serializer(salt="auth"):
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=salt)


def make_token(user, salt="auth", sid=None):
    data = {"uid": user["id"], "pw": user["password_hash"][-12:]}
    if sid:
        data["sid"] = sid
    return _serializer(salt).dumps(data)


def _decode(token, salt, max_age):
    try:
        return _serializer(salt).loads(token, max_age=max_age or current_app.config["TOKEN_MAX_AGE"])
    except SignatureExpired:
        fail("Your session has expired. Please log in again.", 401)
    except BadSignature:
        fail("Please log in.", 401)


def read_token(token, salt="auth", max_age=None):
    data = _decode(token, salt, max_age)
    user = query("SELECT * FROM users WHERE id = ?", (data.get("uid"),), one=True)
    # a password change invalidates older tokens
    if not user or user["password_hash"][-12:] != data.get("pw"):
        fail("Please log in.", 401)
    g.session_id = data.get("sid")
    return user


def _parse(ts):
    return datetime.strptime(ts[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)


def _touch_session(user):
    sid = g.get("session_id")
    if not sid:
        return
    s = query("SELECT * FROM sessions WHERE id = ? AND user_id = ?", (sid, user["id"]), one=True)
    if not s or s["ended_at"]:
        fail("You have been logged out. Please log in again.", 401)
    if datetime.now(timezone.utc) - _parse(s["last_seen"]) >= TOUCH_EVERY:
        execute("UPDATE sessions SET last_seen = ? WHERE id = ?", (now(), sid))


def current_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        fail("Please log in.", 401)
    user = read_token(header[7:].strip())
    if user["status"] != "active":
        fail("Your account is not active.", 403)
    _touch_session(user)
    return user


def login_required(*roles):
    """@login_required() for any signed-in member, or @login_required('supervisor', 'representative')."""
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            g.user = current_user()
            if roles and g.user["role"] not in roles:
                fail("You do not have access to this.", 403)
            return fn(*a, **kw)
        return wrapper
    return deco
