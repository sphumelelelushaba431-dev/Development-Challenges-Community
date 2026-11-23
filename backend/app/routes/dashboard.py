"""One call per dashboard: everything the page needs, in the shape the front end uses.
Also the public overview for visitors (no sign-in)."""
from flask import Blueprint, current_app, g, jsonify

from .. import mcda
from ..auth import login_required
from ..db import jload, query
from ..services import (ACTIVE, OPEN, area_index, classification_of, days_ago, full_name, match_students, me_payload,
                        student_load, supervisor_load, team_of, _cfg)
from .meetings import serialize as meeting_json
from .notifications import for_user
from .requests import _row as request_row

bp = Blueprint("dashboard", __name__, url_prefix="/api")


def _funded(ch):
    return {"yes": True, "no": False}.get(ch["funded"], "none")


def _name(uid):
    u = query("SELECT * FROM users WHERE id = ?", (uid,), one=True) if uid else None
    return full_name(u) if u else None


@bp.get("/dashboard/student")
@login_required("student")
def student():
    me = g.user
    mine = []
    for ch in query("SELECT c.*, cs.assigned_at FROM challenges c JOIN challenge_students cs ON cs.challenge_id = c.id WHERE cs.student_id = ?", (me["id"],)):
        hist = query("SELECT * FROM progress_updates WHERE challenge_id = ? ORDER BY id", (ch["id"],))
        mine.append({"id": ch["code"], "title": ch["title"], "status": ch["status"], "supervisor": _name(ch["supervisor_id"]) or "—",
                     "due": ch["due_date"], "pct": ch["progress"], "history": [{"at": h["created_at"], "pct": h["pct"]} for h in hist],
                     "last": hist[-1]["note"] if hist else None, "assigned": ch["assigned_at"], "desc": ch["description"],
                     "team": [full_name(s) for s in team_of(ch["id"])], "completed": ch["completed_at"]})
    mine_ids = {m["id"] for m in mine}
    my_req = {r["challenge_id"]: r["status"] for r in query("SELECT * FROM requests WHERE student_id = ?", (me["id"],))}
    me_cand = [{"id": me["id"], "name": full_name(me), "areas": me_payload(me)["interests"], "load": student_load(me["id"]),
                "cap": current_app.config["STUDENT_CAP"], "available": bool(me["available"]), "record": me["record"]}]
    available = []
    for ch in query("SELECT * FROM challenges WHERE status IN ('Unallocated', 'Approved') ORDER BY due_date"):
        if ch["code"] in mine_ids:
            continue
        r = mcda.rank(classification_of(ch), me_cand, _cfg())[0]
        if r["criteria"]["alignment"] <= 0:
            continue
        available.append({"id": ch["code"], "title": ch["title"], "desc": ch["description"], "due": ch["due_date"], "supervisor": _name(ch["supervisor_id"]) or "—",
                          "fit": round(r["criteria"]["alignment"] * 100), "request": my_req.get(ch["id"])})
    events = [{"date": m["assigned"], "kind": "asg", "title": m["title"]} for m in mine] + \
             [{"date": m["completed"], "kind": "done", "title": m["title"]} for m in mine if m["completed"]]
    return jsonify({"me": me_payload(me), "mine": mine, "available": available, "events": events, "notes": for_user(me["id"])})


@bp.get("/dashboard/supervisor")
@login_required("supervisor")
def supervisor():
    me = g.user
    rows = query("SELECT * FROM challenges WHERE supervisor_id = ? ORDER BY due_date", (me["id"],))
    chs, results = [], {}
    for ch in rows:
        team = team_of(ch["id"])
        chs.append({"id": ch["code"], "title": ch["title"], "status": ch["status"], "funded": _funded(ch), "by": _name(ch["submitted_by"]),
                    "due": ch["due_date"], "desc": ch["description"], "to": full_name(team[0]) if team else None, "pct": ch["progress"]})
        if ch["status"] == "Unallocated":
            m = match_students(ch)
            results[ch["code"]] = {"outcome": m["outcome"], "ranked": [{"name": x["name"], "score": x["wsm"], "topsis": x["topsis"], "recommended": x["recommended"],
                                                                          "available": x["available"], "load": x["load"], "cap": x["cap"]} for x in m["ranked"]]}
    students = [{"name": full_name(u), "interests": jload(u["expertise"]) or [u["interest"]], "load": student_load(u["id"]), "cap": current_app.config["STUDENT_CAP"],
                 "available": bool(u["available"]), "record": u["record"]} for u in query("SELECT * FROM users WHERE role = 'student' AND status = 'active' ORDER BY first_name")]
    reqs = [request_row(r) for r in query("SELECT r.* FROM requests r JOIN challenges c ON c.id = r.challenge_id WHERE c.supervisor_id = ? ORDER BY r.id DESC", (me["id"],))]
    meetings = query("SELECT * FROM meetings WHERE date >= date('now') ORDER BY date, start")
    events = [{"date": ch["created_at"], "kind": "sub", "title": ch["title"]} for ch in rows] + \
             [{"date": ch["completed_at"], "kind": "done", "title": ch["title"]} for ch in rows if ch["completed_at"]]
    return jsonify({"me": me_payload(me), "challenges": chs, "results": results, "students": students, "requests": reqs,
                    "meetings": [meeting_json(m) for m in meetings if m["supervisor_id"] == me["id"]],
                    "booked": [meeting_json(m, False) for m in meetings if m["supervisor_id"] != me["id"]],
                    "cap": current_app.config["SUPERVISOR_CAP"], "load": supervisor_load(me["id"]), "events": events, "notes": for_user(me["id"])})


@bp.get("/dashboard/representative")
@login_required("representative")
def representative():
    me = g.user
    rows = query("SELECT * FROM challenges WHERE submitted_by = ? ORDER BY id DESC", (me["id"],))
    subs = [{"id": ch["code"], "title": ch["title"], "status": ch["status"], "funded": _funded(ch), "due": ch["due_date"], "pct": ch["progress"],
             "team": ", ".join(full_name(s) for s in team_of(ch["id"])) or None, "request": ch["info_request"], "supervisor": _name(ch["supervisor_id"])}
            for ch in rows]
    events = [{"date": ch["created_at"], "kind": "sub", "title": ch["title"]} for ch in rows] + \
             [{"date": ch["completed_at"], "kind": "done", "title": ch["title"]} for ch in rows if ch["completed_at"]]
    return jsonify({"me": me_payload(me), "subs": subs, "assigned": [], "events": events, "notes": for_user(me["id"])})


@bp.get("/dashboard/admin")
@login_required("admin")
def admin():
    users = query("SELECT * FROM users")
    members = {r: sum(1 for u in users if u["role"] == r.lower() and u["status"] == "active") for r in ("Student", "Supervisor", "Representative")}
    pending = [{"id": u["member_no"], "name": full_name(u), "role": u["role"].title(), "org": u["organisation"], "email": u["email"], "when": u["joined_at"]}
               for u in sorted(users, key=lambda u: u["joined_at"], reverse=True) if u["status"] == "pending"]
    orgs = {}
    for u in users:
        if u["status"] == "active" and u["role"] != "admin":
            orgs[u["organisation"]] = orgs.get(u["organisation"], 0) + 1
    top = sorted(orgs.items(), key=lambda x: -x[1])
    org_rows = [list(x) for x in top[:5]] + ([["Other", sum(n for _o, n in top[5:])]] if len(top) > 5 else [])
    statuses = {}
    for ch in query("SELECT status FROM challenges"):
        statuses[ch["status"]] = statuses.get(ch["status"], 0) + 1
    locked = [{"id": u["member_no"], "name": full_name(u), "why": "%d failed login attempts" % u["failed_logins"], "ago": days_ago(u["locked_at"] or u["joined_at"])}
              for u in users if u["status"] == "locked"]
    activity = [{"who": a["who"], "text": a["text"], "kind": a["kind"], "ago": days_ago(a["created_at"])} for a in query("SELECT * FROM activity ORDER BY id DESC LIMIT 30")]
    events = [{"date": u["joined_at"], "kind": u["role"].title(), "title": "New " + u["role"]} for u in users if u["role"] != "admin" and u["status"] != "rejected"]
    return jsonify({"me": me_payload(g.user), "members": members, "pending": pending, "orgs": org_rows, "org_total": len(orgs), "challenges": statuses,
                    "locked": locked, "activity": activity, "events": events, "notes": for_user(g.user["id"])})


@bp.get("/public/overview")
def public_overview():
    """Visitors' dashboard: no personal details beyond names already public on completed work."""
    out = []
    for ch in query("SELECT * FROM challenges WHERE status NOT IN ('Rejected', 'Interest Review') ORDER BY created_at"):
        areas = jload(ch["areas"])
        by = query("SELECT organisation FROM users WHERE id = ?", (ch["submitted_by"],), one=True)
        item = {"title": ch["title"], "area": area_index(areas[0]["area"]) if areas else 9, "status": ch["status"], "sub": ch["created_at"], "org": by["organisation"] if by else ""}
        if ch["status"] == "Completed":
            item.update({"done": ch["completed_at"], "supervisor": _name(ch["supervisor_id"]), "team": len(team_of(ch["id"])), "summary": ch["summary"] or ch["description"][:240]})
        elif ch["status"] in ACTIVE:
            item["team"] = len(team_of(ch["id"]))
        out.append(item)
    return jsonify({"challenges": out, "open_statuses": list(OPEN)})


@bp.get("/health")
def health():
    return jsonify({"status": "ok"})
