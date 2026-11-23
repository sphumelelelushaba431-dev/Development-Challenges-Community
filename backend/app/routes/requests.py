"""Students ask to work on a challenge; the challenge's supervisor accepts or declines."""
from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..db import execute, now, query
from ..errors import fail
from ..services import challenge_by_code, days_ago, full_name, notify, student_load, supervisor_load
from .challenges import allocate_student

bp = Blueprint("requests", __name__, url_prefix="/api/requests")
OPEN_FOR_REQUESTS = ("Unallocated", "Approved")


def _row(r):
    ch = query("SELECT * FROM challenges WHERE id = ?", (r["challenge_id"],), one=True)
    st = query("SELECT * FROM users WHERE id = ?", (r["student_id"],), one=True)
    return {"rid": r["id"], "id": ch["code"], "title": ch["title"], "student": full_name(st), "student_no": st["member_no"],
            "msg": r["message"], "status": r["status"], "note": r["note"], "ago": days_ago(r["created_at"])}


@bp.post("")
@login_required("student")
def create():
    d = request.get_json(silent=True) or {}
    ch = challenge_by_code(d.get("challenge"))
    if not ch or ch["status"] not in OPEN_FOR_REQUESTS:
        fail("This challenge is not open for requests.", 409)
    if query("SELECT 1 FROM requests WHERE challenge_id = ? AND student_id = ?", (ch["id"], g.user["id"]), one=True):
        fail("You have already requested this challenge.", 409)
    if student_load(g.user["id"]) >= current_app.config["STUDENT_CAP"]:
        fail("You already have %d active challenges." % current_app.config["STUDENT_CAP"], 409)
    execute("INSERT INTO requests (challenge_id, student_id, message) VALUES (?,?,?)", (ch["id"], g.user["id"], (d.get("message") or "").strip()[:500]))
    sup = query("SELECT * FROM users WHERE id = ?", (ch["supervisor_id"],), one=True) if ch["supervisor_id"] else None
    if sup:
        notify(sup["id"], "alert", full_name(g.user), "Requested to work on “%s”. Respond in the Action queue." % ch["title"], ch["code"], ch["code"])
    return jsonify({"message": "Request sent to %s. You will be notified of the decision." % (full_name(sup) if sup else "the supervisor")}), 201


@bp.get("")
@login_required("student", "supervisor", "admin")
def list_requests():
    if g.user["role"] == "student":
        rows = query("SELECT * FROM requests WHERE student_id = ? ORDER BY id DESC", (g.user["id"],))
    elif g.user["role"] == "supervisor":
        rows = query("SELECT r.* FROM requests r JOIN challenges c ON c.id = r.challenge_id WHERE c.supervisor_id = ? ORDER BY r.id DESC", (g.user["id"],))
    else:
        rows = query("SELECT * FROM requests ORDER BY id DESC")
    return jsonify([_row(r) for r in rows])


def _mine(rid):
    r = query("SELECT * FROM requests WHERE id = ?", (rid,), one=True)
    if not r:
        fail("Request not found.", 404)
    ch = query("SELECT * FROM challenges WHERE id = ?", (r["challenge_id"],), one=True)
    if g.user["role"] != "admin" and ch["supervisor_id"] != g.user["id"]:
        fail("Only the challenge's supervisor can decide.", 403)
    if r["status"] != "pending":
        fail("This request has already been decided.", 409)
    return r, ch


@bp.post("/<int:rid>/accept")
@login_required("supervisor", "admin")
def accept(rid):
    r, ch = _mine(rid)
    if ch["status"] not in OPEN_FOR_REQUESTS:
        fail("The challenge is no longer open.", 409)
    if ch["status"] == "Approved" and supervisor_load(ch["supervisor_id"]) >= current_app.config["SUPERVISOR_CAP"]:
        fail("You already have %d open challenges." % current_app.config["SUPERVISOR_CAP"], 409)
    student = query("SELECT * FROM users WHERE id = ?", (r["student_id"],), one=True)
    allocate_student(ch, student, full_name(g.user))
    execute("UPDATE requests SET status = 'accepted', decided_at = ? WHERE id = ?", (now(), rid))
    return jsonify({"message": "%s allocated to %s and notified." % (full_name(student), ch["code"])})


@bp.post("/<int:rid>/decline")
@login_required("supervisor", "admin")
def decline(rid):
    r, ch = _mine(rid)
    note = ((request.get_json(silent=True) or {}).get("note") or "").strip()
    if len(note) < 3:
        fail("Give the student a reason.", 422, note="Give the student a reason.")
    execute("UPDATE requests SET status = 'declined', note = ?, decided_at = ? WHERE id = ?", (note, now(), rid))
    student = query("SELECT * FROM users WHERE id = ?", (r["student_id"],), one=True)
    notify(student["id"], "update", full_name(g.user), "Your request for “%s” was declined: %s" % (ch["title"], note), ch["code"], ch["code"])
    return jsonify({"message": "Request declined — %s has been notified." % full_name(student)})
