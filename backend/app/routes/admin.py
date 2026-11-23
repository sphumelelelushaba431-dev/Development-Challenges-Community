"""Administrator: account approvals, locked accounts, members and activity."""
from flask import Blueprint, g, jsonify, request

from ..auth import login_required
from ..db import execute, now, query
from ..errors import fail
from ..services import days_ago, full_name, log, notify

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _user(member_no):
    u = query("SELECT * FROM users WHERE upper(member_no) = upper(?)", (member_no,), one=True)
    if not u:
        fail("Member not found.", 404)
    return u


def member_row(u):
    return {"id": u["member_no"], "name": full_name(u), "role": u["role"].title(), "org": u["organisation"], "email": u["email"],
            "status": u["status"], "when": u["joined_at"]}


@bp.get("/users")
@login_required("admin")
def users():
    role, status = request.args.get("role"), request.args.get("status")
    rows = query("SELECT * FROM users ORDER BY id DESC")
    return jsonify([member_row(u) for u in rows if (not role or u["role"] == role) and (not status or u["status"] == status)])


@bp.post("/users/<member_no>/approve")
@login_required("admin")
def approve(member_no):
    u = _user(member_no)
    if u["status"] != "pending":
        fail("This account is not waiting for approval.", 409)
    execute("UPDATE users SET status = 'active' WHERE id = ?", (u["id"],))
    notify(u["id"], "update", full_name(g.user), "Welcome! Your account has been approved.")
    log(full_name(g.user), "approved %s account %s." % (u["role"].title(), u["member_no"]), "ok")
    return jsonify({"message": "%s approved — they can log in now." % full_name(u)})


@bp.post("/users/<member_no>/reject")
@login_required("admin")
def reject(member_no):
    u = _user(member_no)
    reason = ((request.get_json(silent=True) or {}).get("reason") or "").strip()
    if len(reason) < 3:
        fail("Give a reason.", 422, reason="Give a reason.")
    execute("UPDATE users SET status = 'rejected' WHERE id = ?", (u["id"],))
    log(full_name(g.user), "rejected %s account %s: %s" % (u["role"].title(), u["member_no"], reason), "bad")
    return jsonify({"message": "%s's registration was rejected." % full_name(u)})


@bp.post("/users/<member_no>/unlock")
@login_required("admin")
def unlock(member_no):
    u = _user(member_no)
    if u["status"] != "locked":
        fail("This account is not locked.", 409)
    execute("UPDATE users SET status = 'active', failed_logins = 0, locked_at = NULL WHERE id = ?", (u["id"],))
    log(full_name(g.user), "unlocked %s." % u["member_no"], "ok")
    return jsonify({"message": "%s unlocked." % full_name(u)})


@bp.get("/activity")
@login_required("admin")
def activity():
    return jsonify([{"who": a["who"], "text": a["text"], "kind": a["kind"], "ago": days_ago(a["created_at"]), "at": a["created_at"]}
                    for a in query("SELECT * FROM activity ORDER BY id DESC LIMIT 100")])


@bp.get("/locked")
@login_required("admin")
def locked():
    return jsonify([{"id": u["member_no"], "name": full_name(u), "why": "%d failed login attempts" % u["failed_logins"], "ago": days_ago(u["locked_at"] or now())}
                    for u in query("SELECT * FROM users WHERE status = 'locked'")])


@bp.get("/mcda")
@login_required("admin")
def mcda_settings():
    """The MCDA set-up in use: criterion weights (from AHP), consistency ratio, threshold and ranking method."""
    from flask import current_app
    c = current_app.config
    return jsonify({"weights": c["MCDA_WEIGHTS"], "ahp_consistency_ratio": c.get("MCDA_AHP_CR"), "threshold": c["MCDA_THRESHOLD"],
                    "ranking": c["MCDA_RANKING"], "supervisor_cap": c["SUPERVISOR_CAP"], "student_cap": c["STUDENT_CAP"]})
