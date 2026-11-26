"""Audit log — supervisors only.

GET /api/audit/log     every recorded activity: what was done, by whom, when and how long
                       ?q=text  &member=DCC00002  &area=auth|account|challenge|meeting|profile|email  &limit=  &offset=
GET /api/audit/users   every member with their status, last sign-in and total time signed in
"""
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request

from ..auth import login_required
from ..db import query
from ..services import full_name, session_seconds

bp = Blueprint("audit", __name__, url_prefix="/api/audit")

AREAS = ("auth", "account", "challenge", "meeting", "profile", "email")
ROLE_LABEL = {"student": "Student", "supervisor": "Supervisor", "representative": "Representative"}


def _idle_cutoff():
    idle = timedelta(minutes=current_app.config["SESSION_IDLE_MINUTES"])
    return (datetime.now(timezone.utc) - idle).strftime("%Y-%m-%d %H:%M:%S")


def _session_state(s, cutoff):
    if s["ended_at"]:
        return "ended"
    return "active" if s["last_seen"] >= cutoff else "idle"


@bp.get("/log")
@login_required("supervisor")
def audit_log():
    args = request.args
    try:
        limit = max(1, min(500, int(args.get("limit", 200))))
        offset = max(0, int(args.get("offset", 0)))
    except ValueError:
        limit, offset = 200, 0
    where, params = [], []
    if args.get("member"):
        where.append("upper(a.actor_no) = upper(?)")
        params.append(args["member"].strip())
    if args.get("area") in AREAS:
        where.append("a.action LIKE ?")
        params.append(args["area"] + ".%")
    if args.get("q"):
        where.append("(a.who LIKE ? OR a.text LIKE ? OR a.actor_no LIKE ?)")
        params += ["%" + args["q"].strip() + "%"] * 3
    sql = ("SELECT a.*, s.started_at s_start, s.last_seen s_seen, s.ended_at s_end FROM activity a "
           "LEFT JOIN sessions s ON s.id = a.session_id")
    if where:
        sql += " WHERE " + " AND ".join(where)
    total = query("SELECT COUNT(*) n FROM activity a" + (" WHERE " + " AND ".join(where) if where else ""), params, one=True)["n"]
    rows = query(sql + " ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?", params + [limit, offset])
    cutoff = _idle_cutoff()
    out = []
    for a in rows:
        duration, state = a["duration"], None
        if a["action"] == "auth.login" and a["s_start"]:
            # how long this sign-in lasted (still counting while it is open)
            s = {"started_at": a["s_start"], "last_seen": a["s_seen"], "ended_at": a["s_end"]}
            duration, state = session_seconds(s), _session_state(s, cutoff)
        out.append({"id": a["id"], "at": a["created_at"], "who": a["who"], "member": a["actor_no"],
                    "role": ROLE_LABEL.get(a["actor_role"], a["actor_role"].title()), "action": a["action"] or "other",
                    "text": a["text"], "kind": a["kind"], "duration": duration, "session": state, "ip": a["ip"]})
    return jsonify({"entries": out, "total": total, "limit": limit, "offset": offset})


@bp.get("/users")
@login_required("supervisor")
def audit_users():
    cutoff = _idle_cutoff()
    stats = {}
    for s in query("SELECT * FROM sessions ORDER BY id"):
        st = stats.setdefault(s["user_id"], {"sessions": 0, "seconds": 0, "last": None, "online": False})
        st["sessions"] += 1
        st["seconds"] += session_seconds(s)
        st["last"] = s["started_at"]
        if _session_state(s, cutoff) == "active":
            st["online"] = True
    actions = {r["actor_id"]: r["n"] for r in query("SELECT actor_id, COUNT(*) n FROM activity WHERE actor_id IS NOT NULL GROUP BY actor_id")}
    out = []
    for u in query("SELECT * FROM users ORDER BY id DESC"):
        st = stats.get(u["id"], {})
        why = None
        if u["status"] == "locked":
            why = "%d failed login attempts" % u["failed_logins"] if u["failed_logins"] >= current_app.config["MAX_FAILED_LOGINS"] else "Locked by a supervisor"
        out.append({"id": u["member_no"], "name": full_name(u), "role": ROLE_LABEL.get(u["role"], u["role"].title()),
                    "org": u["organisation"], "email": u["email"], "phone": u["phone"], "status": u["status"], "why": why,
                    "joined": u["joined_at"], "last_login": st.get("last"), "sessions": st.get("sessions", 0),
                    "time_online": st.get("seconds", 0), "online": st.get("online", False), "actions": actions.get(u["id"], 0)})
    return jsonify({"users": out, "require_approval": bool(current_app.config["REQUIRE_APPROVAL"])})
