"""In-person meetings in the DC labs, booked by supervisors (no double bookings)."""
from datetime import date, datetime

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..db import execute, jdump, jload, query
from ..errors import fail
from ..services import challenge_by_code, full_name, notify, team_of, user_by_name_or_no

bp = Blueprint("meetings", __name__, url_prefix="/api/meetings")


def _mins(hhmm):
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def serialize(m, with_people=True):
    ch = query("SELECT code, title FROM challenges WHERE id = ?", (m["challenge_id"],), one=True)
    sup = query("SELECT * FROM users WHERE id = ?", (m["supervisor_id"],), one=True)
    out = {"id": "M-%d" % m["id"], "venue": m["venue"], "date": m["date"], "start": m["start"], "mins": m["minutes"]}
    if with_people:
        out.update({"cid": ch["code"], "title": m["title"], "challenge": "%s (%s)" % (ch["title"], ch["code"]), "organiser": full_name(sup),
                    "people": jload(m["people"]), "agenda": m["agenda"]})
    return out


def clash(venue, day, start, mins, skip_id=None):
    a, b = _mins(start), _mins(start) + mins
    for m in query("SELECT * FROM meetings WHERE venue = ? AND date = ?", (venue, day)):
        if m["id"] != skip_id and _mins(m["start"]) < b and a < _mins(m["start"]) + m["minutes"]:
            return m
    return None


@bp.get("")
@login_required()
def list_meetings():
    today = date.today().isoformat()
    rows = query("SELECT * FROM meetings WHERE date >= ? ORDER BY date, start", (today,))
    me = full_name(g.user)
    if g.user["role"] == "supervisor":
        mine = [serialize(m) for m in rows if m["supervisor_id"] == g.user["id"]]
        booked = [serialize(m, False) for m in rows if m["supervisor_id"] != g.user["id"]]   # other bookings: time and lab only
        return jsonify({"meetings": mine, "booked": booked})
    if g.user["role"] == "admin":
        return jsonify({"meetings": [serialize(m) for m in rows], "booked": []})
    return jsonify({"meetings": [serialize(m) for m in rows if me in jload(m["people"])], "booked": []})


@bp.post("")
@login_required("supervisor")
def create():
    d = request.get_json(silent=True) or {}
    cfg = current_app.config
    errors = {}
    ch = challenge_by_code(d.get("challenge"))
    if not ch or ch["supervisor_id"] != g.user["id"]:
        errors["challenge"] = "Choose one of your challenges."
    title = (d.get("title") or "").strip()
    if len(title) < 3:
        errors["title"] = "Give the meeting a title."
    venue = d.get("venue")
    if venue not in cfg["LAB_VENUES"]:
        errors["venue"] = "Choose a lab."
    people = [p for p in (d.get("people") or []) if p]
    if not people:
        errors["people"] = "Invite at least one person."
    try:
        day = date.fromisoformat(d.get("date", ""))
        start = d.get("start", "")
        mins = int(d.get("mins") or d.get("minutes") or 0)
        when = datetime.fromisoformat(day.isoformat() + "T" + start)
    except (TypeError, ValueError):
        day = None
        errors["date"] = "Choose a date and start time."
    if day:
        if day.weekday() >= 5:
            errors["date"] = "Choose a weekday — the labs are closed on weekends."
        elif when < datetime.now():
            errors["date"] = "Choose a time in the future."
        elif mins not in (30, 60, 90, 120):
            errors["date"] = "Choose a length of 30, 60, 90 or 120 minutes."
        elif _mins(start) < _mins(cfg["LAB_OPEN"]) or _mins(start) + mins > _mins(cfg["LAB_CLOSE"]):
            errors["date"] = "Meetings must be between %s and %s." % (cfg["LAB_OPEN"], cfg["LAB_CLOSE"])
        elif venue in cfg["LAB_VENUES"]:
            x = clash(venue, day.isoformat(), start, mins)
            if x:
                errors["venue"] = "%s is booked from %s for %d minutes. Choose another lab or time." % (venue, x["start"], x["minutes"])
    if errors:
        fail("Please correct the highlighted fields.", 422, **errors)
    mid = execute("INSERT INTO meetings (supervisor_id, challenge_id, title, venue, date, start, minutes, people, agenda) VALUES (?,?,?,?,?,?,?,?,?)",
                  (g.user["id"], ch["id"], title, venue, day.isoformat(), start, mins, jdump(people), (d.get("agenda") or "").strip()))
    me = full_name(g.user)
    for p in people:
        u = user_by_name_or_no(p)
        if u:
            notify(u["id"], "meeting", me, "Meeting: %s · %s %s · %s (in person)." % (title, day.isoformat(), start, venue), ch["code"], "M-%d" % mid)
    return jsonify({"message": "Meeting booked in %s. %s notified." % (venue, ", ".join(people)),
                    "meeting": serialize(query("SELECT * FROM meetings WHERE id = ?", (mid,), one=True))}), 201


@bp.delete("/<mid>")
@login_required("supervisor", "admin")
def cancel(mid):
    m = query("SELECT * FROM meetings WHERE id = ?", (int(str(mid).replace("M-", "")),), one=True)
    if not m or (g.user["role"] != "admin" and m["supervisor_id"] != g.user["id"]):
        fail("Meeting not found.", 404)
    execute("DELETE FROM meetings WHERE id = ?", (m["id"],))
    for p in jload(m["people"]):
        u = user_by_name_or_no(p)
        if u:
            notify(u["id"], "meeting", full_name(g.user), "Cancelled: %s on %s at %s." % (m["title"], m["date"], m["start"]))
    return jsonify({"message": "Meeting cancelled. %s notified." % ", ".join(jload(m["people"]))})
