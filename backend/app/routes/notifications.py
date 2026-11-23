"""Notifications (messages are notifications too) and replies."""
from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..db import execute, query
from ..errors import fail
from ..services import days_ago, full_name, notify, user_by_name_or_no

bp = Blueprint("notifications", __name__, url_prefix="/api")


def serialize(n):
    return {"id": n["id"], "kind": n["kind"], "from": n["sender"], "about": n["about"], "text": n["text"], "ref": n["ref"],
            "ago": days_ago(n["created_at"]), "unread": not n["is_read"], "at": n["created_at"]}


def for_user(uid, limit=50):
    return [serialize(n) for n in query("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?", (uid, limit))]


@bp.get("/notifications")
@login_required()
def list_notifications():
    return jsonify(for_user(g.user["id"]))


@bp.post("/notifications/read-all")
@login_required()
def read_all():
    execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (g.user["id"],))
    return jsonify({"message": "All notifications marked as read."})


@bp.post("/notifications/<int:nid>/read")
@login_required()
def read_one(nid):
    execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", (nid, g.user["id"]))
    return jsonify({"ok": True})


@bp.post("/messages")
@login_required()
def send_message():
    d = request.get_json(silent=True) or {}
    to = user_by_name_or_no(d.get("to"))
    text = (d.get("text") or "").strip()
    if not to:
        fail("Recipient not found.", 404)
    if len(text) < 2:
        fail("Write a message.", 422, text="Write a message.")
    notify(to["id"], "message", full_name(g.user), text[:1000], d.get("about") or "")
    return jsonify({"message": "Message sent to %s." % full_name(to)}), 201
