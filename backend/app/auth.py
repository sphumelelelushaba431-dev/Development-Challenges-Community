"""Bearer-token authentication and role checks.

Tokens are signed with SECRET_KEY (itsdangerous, installed with Flask) and expire after TOKEN_MAX_AGE.
The front end sends:  Authorization: Bearer <token>
"""
from functools import wraps

from flask import current_app, g, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .db import query
from .errors import fail


def _serializer(salt="auth"):
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=salt)


def make_token(user, salt="auth"):
    return _serializer(salt).dumps({"uid": user["id"], "pw": user["password_hash"][-12:]})


def read_token(token, salt="auth", max_age=None):
    try:
        data = _serializer(salt).loads(token, max_age=max_age or current_app.config["TOKEN_MAX_AGE"])
    except SignatureExpired:
        fail("Your session has expired. Please log in again.", 401)
    except BadSignature:
        fail("Please log in.", 401)
    user = query("SELECT * FROM users WHERE id = ?", (data.get("uid"),), one=True)
    # a password change invalidates older tokens
    if not user or user["password_hash"][-12:] != data.get("pw"):
        fail("Please log in.", 401)
    return user


def current_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        fail("Please log in.", 401)
    user = read_token(header[7:].strip())
    if user["status"] != "active":
        fail("Your account is not active.", 403)
    return user


def login_required(*roles):
    """@login_required() for any signed-in member, or @login_required('supervisor', 'admin')."""
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            g.user = current_user()
            if roles and g.user["role"] not in roles:
                fail("You do not have access to this.", 403)
            return fn(*a, **kw)
        return wrapper
    return deco
