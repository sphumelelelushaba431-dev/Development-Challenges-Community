"""Meetings booked by supervisors. Mode is Online or In person; invitees are derived from the challenge team."""
from datetime import date, datetime

from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..db import execute, jdump, jload, query
from ..errors import fail
from ..services import OPEN, challenge_by_code, full_name, log, notify, team_of, user_by_name_or_no

bp = Blueprint("meetings", __name__, url_prefix="/api/meetings")


def _attendees(ch):
    """Whole team, the submitter and the challenge supervisor — no client-supplied invite list."""
    ids = [s["id"] for s in team_of(ch["id"])]
    ids += [ch["submitted_by"], ch["supervisor_id"]]
    people, seen = [], set()
    for uid in ids:
        if not uid or uid in seen:
            continue
        seen.add(uid)
        u = query("SELECT * FROM users WHERE id = ?", (uid,), one=True)
        if u:
            people.append(u)
    return people


def serialize(m, with_people=True):
    ch = query("SELECT code, title FROM challenges WHERE id = ?", (m["challenge_id"],), one=True)
    sup = query("SELECT * FROM users WHERE id = ?", (m["supervisor_id"],), one=True)
    mode = m["venue"] if m["venue"] in current_app.config["MEETING_MODES"] else "In person"
    out = {"id": "M-%d" % m["id"], "mode": mode, "date": m["date"], "start": m["start"], "mins": m["minutes"]}
    if with_people:
        people = []
        for value in jload(m["people"]):
            u = user_by_name_or_no(value)
            people.append(full_name(u) if u else value)
        out.update({"cid": ch["code"] if ch else "", "title": m["title"],
                    "challenge": "%s (%s)" % (ch["title"], ch["code"]) if ch else "",
                    "organiser": full_name(sup) if sup else "", "people": people, "agenda": m["agenda"]})
    return out


@bp.get("")
@login_required()
def list_meetings():
    today = date.today().isoformat()
    rows = query("SELECT * FROM meetings WHERE date >= ? ORDER BY date, start", (today,))
    me = full_name(g.user)
    if g.user["role"] == "supervisor":
        return jsonify({"meetings": [serialize(m) for m in rows if m["supervisor_id"] == g.user["id"]], "booked": []})
    if g.user["role"] in ("student", "representative"):
        return jsonify({"meetings": [serialize(m) for m in rows if me in serialize(m)["people"]], "booked": []})
    fail("You do not have access to this.", 403)


@bp.post("")
@login_required("supervisor")
def create():
    d = request.get_json(silent=True) or {}
    cfg = current_app.config
    errors = {}
    ch = challenge_by_code(d.get("challenge"))
    if not ch or ch["supervisor_id"] != g.user["id"] or ch["status"] not in OPEN:
        errors["challenge"] = "Choose one of your open challenges."
    title = (d.get("title") or "").strip()
    if len(title) < 3:
        errors["title"] = "Give the meeting a title."
    mode = d.get("mode") or d.get("venue")
    if mode not in cfg["MEETING_MODES"]:
        errors["mode"] = "Choose Online or In person."
    try:
        day = date.fromisoformat(d.get("date", ""))
        start = d.get("start", "")
        mins = int(d.get("mins") or d.get("minutes") or 0)
        when = datetime.fromisoformat(day.isoformat() + "T" + start)
    except (TypeError, ValueError):
        day = None
        errors["date"] = "Choose a date and start time."
    if day:
        if when <= datetime.now():
            errors["date"] = "Choose a time in the future."
        elif mins not in (30, 60, 90, 120):
            errors["date"] = "Choose a length of 30, 60, 90 or 120 minutes."
    if errors:
        fail("Please correct the highlighted fields.", 422, **errors)

    people = _attendees(ch)
    mid = execute("INSERT INTO meetings (supervisor_id, challenge_id, title, venue, date, start, minutes, people, agenda) VALUES (?,?,?,?,?,?,?,?,?)",
                  (g.user["id"], ch["id"], title, mode, day.isoformat(), start, mins,
                   jdump([u["member_no"] for u in people]), (d.get("agenda") or "").strip()))
    me = full_name(g.user)
    where = mode if mode == "Online" else mode + " meeting"
    for u in people:
        notify(u["id"], "meeting", me, "Meeting: %s · %s %s · %s." % (title, day.isoformat(), start, where), ch["code"], "M-%d" % mid)
    log(me, "scheduled “%s” for %s on %s at %s (%s, %d people)." % (title, ch["code"], day.isoformat(), start, mode, len(people)),
        "info", "meeting.schedule", duration=mins * 60)
    return jsonify({"message": "Meeting scheduled. Everyone invited has been notified.",
                    "meeting": serialize(query("SELECT * FROM meetings WHERE id = ?", (mid,), one=True))}), 201


@bp.delete("/<mid>")
@login_required("supervisor")
def cancel(mid):
    m = query("SELECT * FROM meetings WHERE id = ?", (int(str(mid).replace("M-", "")),), one=True)
    if not m or m["supervisor_id"] != g.user["id"]:
        fail("Meeting not found.", 404)
    execute("DELETE FROM meetings WHERE id = ?", (m["id"],))
    log(full_name(g.user), "cancelled the meeting “%s” on %s at %s." % (m["title"], m["date"], m["start"]), "warn", "meeting.cancel",
        duration=m["minutes"] * 60)
    for value in jload(m["people"]):
        u = user_by_name_or_no(value)
        if u:
            notify(u["id"], "meeting", full_name(g.user), "Cancelled: %s on %s at %s." % (m["title"], m["date"], m["start"]))
    return jsonify({"message": "Meeting cancelled. Everyone invited has been notified."})
