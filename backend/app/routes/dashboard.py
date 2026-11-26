"""One call per dashboard: everything the page needs, in the shape the front end uses.
Also the public overview for visitors (no sign-in)."""
from flask import Blueprint, current_app, g, jsonify

from ..auth import login_required
from ..db import jload, query
from ..services import (ACTIVE, OPEN, area_index, full_name, me_payload, supervisor_load, team_of)
from .notifications import for_user

bp = Blueprint("dashboard", __name__, url_prefix="/api")


def _funded(ch):
    return {"yes": True, "no": False}.get(ch["funded"], "none")


def _name(uid):
    u = query("SELECT * FROM users WHERE id = ?", (uid,), one=True) if uid else None
    return full_name(u) if u else None


def _row(ch):
    team = team_of(ch["id"])
    return {"id": ch["code"], "title": ch["title"], "status": ch["status"], "funded": _funded(ch),
            "by": _name(ch["submitted_by"]), "due": ch["due_date"], "desc": ch["description"],
            "supervisor": _name(ch["supervisor_id"]), "pct": ch["progress"],
            "team": [full_name(s) for s in team], "to": full_name(team[0]) if team else None,
            "request": ch["info_request"], "created": ch["created_at"], "completed": ch["completed_at"]}


@bp.get("/dashboard/student")
@login_required("student")
def student():
    me = g.user
    mine = []
    for ch in query("SELECT c.*, cs.assigned_at FROM challenges c JOIN challenge_students cs ON cs.challenge_id = c.id WHERE cs.student_id = ?", (me["id"],)):
        hist = query("SELECT * FROM progress_updates WHERE challenge_id = ? ORDER BY id", (ch["id"],))
        item = _row(ch)
        item.update({"assigned": ch["assigned_at"],
                     "history": [{"at": h["created_at"], "pct": h["pct"], "note": h["note"]} for h in hist]})
        mine.append(item)
    opened = [_row(ch) for ch in query("SELECT * FROM challenges WHERE status IN (%s) ORDER BY due_date" % ",".join("?" * len(OPEN)), OPEN)]
    events = [{"date": m["assigned"], "kind": "asg", "title": m["title"]} for m in mine] + \
             [{"date": m["completed"], "kind": "done", "title": m["title"]} for m in mine if m["completed"]]
    return jsonify({"me": me_payload(me), "mine": mine, "open": opened,
                    "events": events, "notes": for_user(me["id"])})


@bp.get("/dashboard/supervisor")
@login_required("supervisor")
def supervisor():
    me = g.user
    chs = [_row(ch) for ch in query("SELECT * FROM challenges WHERE supervisor_id = ? ORDER BY due_date", (me["id"],))]
    # Member accounts and the activity history are in the Audit log (routes/audit.py), not here.
    events = [{"date": ch["created"], "kind": "sub", "title": ch["title"]} for ch in chs] + \
             [{"date": ch["completed"], "kind": "done", "title": ch["title"]} for ch in chs if ch["completed"]]
    return jsonify({"me": me_payload(me), "challenges": chs, "cap": current_app.config["SUPERVISOR_CAP"],
                    "load": supervisor_load(me["id"]), "events": events, "notes": for_user(me["id"])})


@bp.get("/dashboard/representative")
@login_required("representative")
def representative():
    me = g.user
    subs = [_row(ch) for ch in query("SELECT * FROM challenges WHERE submitted_by = ? ORDER BY id DESC", (me["id"],))]
    events = [{"date": ch["created"], "kind": "sub", "title": ch["title"]} for ch in subs] + \
             [{"date": ch["completed"], "kind": "done", "title": ch["title"]} for ch in subs if ch["completed"]]
    return jsonify({"me": me_payload(me), "subs": subs, "events": events, "notes": for_user(me["id"])})


@bp.get("/public/overview")
def public_overview():
    """Visitors' dashboard: no personal details beyond names already public on completed work."""
    out = []
    for ch in query("SELECT * FROM challenges WHERE status NOT IN ('Rejected', 'Interest Review') ORDER BY created_at"):
        areas = jload(ch["areas"])
        by = query("SELECT organisation FROM users WHERE id = ?", (ch["submitted_by"],), one=True)
        item = {"title": ch["title"], "area": area_index(areas[0]["area"]) if areas else 9,
                "status": ch["status"], "sub": ch["created_at"], "org": by["organisation"] if by else ""}
        if ch["status"] == "Completed":
            item.update({"done": ch["completed_at"], "supervisor": _name(ch["supervisor_id"]),
                         "team": len(team_of(ch["id"])), "summary": ch["summary"] or ch["description"][:240]})
        elif ch["status"] in ACTIVE:
            item["team"] = len(team_of(ch["id"]))
        out.append(item)
    return jsonify({"challenges": out, "open_statuses": list(OPEN)})


@bp.get("/health")
def health():
    return jsonify({"status": "ok"})
