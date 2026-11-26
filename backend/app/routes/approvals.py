"""Managing member accounts — performed by supervisors from the Audit log.

There is no Administrator role. Supervisors approve/decline registrations (when REQUIRE_APPROVAL is on),
lock and unlock accounts, and see every member's activity (routes/audit.py).
"""
from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..db import execute, now, query
from ..emails import send_approval_email
from ..errors import fail
from ..services import days_ago, end_user_sessions, full_name, log, notify, seconds_between

bp = Blueprint("approvals", __name__, url_prefix="/api/approvals")


def _user(member_no):
    u = query("SELECT * FROM users WHERE upper(member_no) = upper(?)", (member_no,), one=True)
    if not u:
        fail("Member not found.", 404)
    return u


def member_row(u):
    return {"id": u["member_no"], "name": full_name(u), "role": u["role"].title(), "org": u["organisation"], "email": u["email"],
            "status": u["status"], "when": u["joined_at"]}


@bp.get("/users")
@login_required("supervisor")
def users():
    role, status = request.args.get("role"), request.args.get("status")
    rows = query("SELECT * FROM users ORDER BY id DESC")
    return jsonify([member_row(u) for u in rows if (not role or u["role"] == role) and (not status or u["status"] == status)])


@bp.post("/users/<member_no>/approve")
@login_required("supervisor")
def approve(member_no):
    u = _user(member_no)
    if u["status"] != "pending":
        fail("This account is not waiting for approval.", 409)
    execute("UPDATE users SET status = 'active' WHERE id = ?", (u["id"],))
    notify(u["id"], "update", full_name(g.user), "Welcome! Your account has been approved.")
    log(full_name(g.user), "approved %s account %s (%s)." % (u["role"].title(), u["member_no"], full_name(u)), "ok",
        "account.approve", duration=seconds_between(u["joined_at"], now()))
    sent, _detail = send_approval_email(u)
    return jsonify({"message": "%s approved — they can log in now.%s" % (full_name(u), " An e-mail has been sent." if sent else "")})


@bp.post("/users/<member_no>/reject")
@login_required("supervisor")
def reject(member_no):
    u = _user(member_no)
    reason = ((request.get_json(silent=True) or {}).get("reason") or "").strip()
    if len(reason) < 3:
        fail("Give a reason.", 422, reason="Give a reason.")
    execute("UPDATE users SET status = 'rejected' WHERE id = ?", (u["id"],))
    log(full_name(g.user), "declined %s account %s (%s): %s" % (u["role"].title(), u["member_no"], full_name(u), reason), "bad",
        "account.reject", duration=seconds_between(u["joined_at"], now()))
    return jsonify({"message": "%s's registration was declined." % full_name(u)})


@bp.post("/users/<member_no>/lock")
@login_required("supervisor")
def lock(member_no):
    u = _user(member_no)
    if u["id"] == g.user["id"]:
        fail("You cannot lock your own account.", 409)
    if u["status"] != "active":
        fail("Only active accounts can be locked.", 409)
    reason = ((request.get_json(silent=True) or {}).get("reason") or "").strip()
    if len(reason) < 3:
        fail("Give a reason.", 422, reason="Give a reason.")
    execute("UPDATE users SET status = 'locked', locked_at = ?, failed_logins = 0 WHERE id = ?", (now(), u["id"]))
    end_user_sessions(u["id"], "locked")
    log(full_name(g.user), "locked %s (%s): %s" % (u["member_no"], full_name(u), reason), "bad", "account.lock")
    return jsonify({"message": "%s is locked and has been signed out." % full_name(u)})


@bp.post("/users/<member_no>/unlock")
@login_required("supervisor")
def unlock(member_no):
    u = _user(member_no)
    if u["status"] != "locked":
        fail("This account is not locked.", 409)
    execute("UPDATE users SET status = 'active', failed_logins = 0, locked_at = NULL WHERE id = ?", (u["id"],))
    log(full_name(g.user), "unlocked %s (%s)." % (u["member_no"], full_name(u)), "ok", "account.unlock",
        duration=seconds_between(u["locked_at"], now()) if u["locked_at"] else None)
    return jsonify({"message": "%s unlocked." % full_name(u)})


@bp.get("/locked")
@login_required("supervisor")
def locked():
    return jsonify([{"id": u["member_no"], "name": full_name(u), "why": "%d failed login attempts" % u["failed_logins"],
                     "ago": days_ago(u["locked_at"] or now())}
                    for u in query("SELECT * FROM users WHERE status = 'locked'")])


@bp.get("/mcda")
@login_required("supervisor")
def mcda_settings():
    """The MCDA set-up in use: AHP weights, consistency ratio, threshold and ranking method."""
    c = current_app.config
    return jsonify({"weights": c["MCDA_WEIGHTS"], "ahp_consistency_ratio": c.get("MCDA_AHP_CR"), "threshold": c["MCDA_THRESHOLD"],
                    "ranking": c["MCDA_RANKING"], "supervisor_cap": c["SUPERVISOR_CAP"], "student_cap": c["STUDENT_CAP"]})
