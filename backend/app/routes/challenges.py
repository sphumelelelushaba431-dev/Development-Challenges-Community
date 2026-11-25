"""Challenge life-cycle.

Representative or supervisor submits a title, description, optional more detail and a deadline.
A supervisor is assigned automatically. Once the supervisor approves, a student team is
auto-allocated from the MCDA ranking. Students update progress; 100% progress completes the
challenge automatically. No file uploads, priority, manual allocation or verification step.
"""
from flask import Blueprint, current_app, g, jsonify, request

from ..auth import login_required
from ..db import execute, jload, now, query
from ..errors import fail
from ..services import (OPEN, assign_supervisor, challenge_by_code, classify_text, full_name, log,
                        match_students, notify, notify_supervisors, set_code, store_areas,
                        student_load, team_of)

bp = Blueprint("challenges", __name__, url_prefix="/api/challenges")


def _data():
    return request.get_json(silent=True) or request.form.to_dict()


def _get(code):
    ch = challenge_by_code(code)
    if not ch:
        fail("Challenge not found.", 404)
    return ch


def _involved(user, ch):
    if user["id"] in (ch["submitted_by"], ch["supervisor_id"]):
        return True
    return bool(query("SELECT 1 FROM challenge_students WHERE challenge_id = ? AND student_id = ?", (ch["id"], user["id"]), one=True))


def _working_on(user, ch):
    """Students work only on challenges they were allocated to."""
    return bool(query("SELECT 1 FROM challenge_students WHERE challenge_id = ? AND student_id = ?", (ch["id"], user["id"]), one=True))


def _supervisor_only(ch):
    if ch["supervisor_id"] != g.user["id"]:
        fail("Only the challenge's supervisor can do this.", 403)


def _status(ch, *allowed):
    if ch["status"] not in allowed:
        fail("This cannot be done while the challenge is '%s'." % ch["status"], 409)


def _with_detail(desc, d):
    extra = (d.get("detail") or d.get("details") or "").strip()
    return desc + ("\n\nMore detail: " + extra if extra else "")


def serialize(ch, detail=False):
    sup = query("SELECT * FROM users WHERE id = ?", (ch["supervisor_id"],), one=True) if ch["supervisor_id"] else None
    by = query("SELECT * FROM users WHERE id = ?", (ch["submitted_by"],), one=True)
    out = {"id": ch["code"], "title": ch["title"], "status": ch["status"], "due": ch["due_date"],
           "funded": {"yes": True, "no": False}.get(ch["funded"], "none"), "pct": ch["progress"],
           "supervisor": full_name(sup) if sup else None, "by": full_name(by) if by else None, "org": by["organisation"] if by else None,
           "team": [full_name(s) for s in team_of(ch["id"])], "request": ch["info_request"], "created": ch["created_at"],
           "completed": ch["completed_at"]}
    if detail:
        out.update({"desc": ch["description"], "areas": jload(ch["areas"]), "keywords": jload(ch["keywords"]), "summary": ch["summary"],
                    "history": [dict(at=p["created_at"], pct=p["pct"], note=p["note"]) for p in
                                query("SELECT * FROM progress_updates WHERE challenge_id = ? ORDER BY id", (ch["id"],))]})
    return out


def auto_allocate_team(ch, by_name=None):
    """Assign the top eligible recommended students as a team. Returns the assigned users."""
    by = by_name or "System"
    picked = []
    for r in match_students(ch)["ranked"]:
        if len(picked) >= current_app.config["AUTO_TEAM_SIZE"]:
            break
        if not r.get("recommended"):
            continue
        s = query("SELECT * FROM users WHERE id = ?", (r["id"],), one=True)
        if not s or s["role"] != "student" or s["status"] != "active" or not s["available"]:
            continue
        if student_load(s["id"]) >= current_app.config["STUDENT_CAP"]:
            continue
        execute("INSERT OR IGNORE INTO challenge_students (challenge_id, student_id) VALUES (?,?)", (ch["id"], s["id"]))
        picked.append(s)
    if not picked:
        return []
    execute("UPDATE challenges SET status = 'Allocated', allocated_at = ?, match_outcome = NULL WHERE id = ?", (now(), ch["id"]))
    names = ", ".join(full_name(s) for s in picked)
    for s in picked:
        notify(s["id"], "assign", by, "You have been added to “%s”." % ch["title"], ch["code"], ch["code"])
    notify(ch["submitted_by"], "update", by, "A student team has been allocated to “%s”." % ch["title"], ch["code"], ch["code"])
    log(by, "auto-allocated %s to %s." % (ch["code"], names), "ok")
    return picked


# ---------- submit ----------
@bp.post("")
@login_required("representative", "supervisor")
def submit():
    d = _data()
    title, desc = (d.get("title") or "").strip(), (d.get("description") or d.get("desc") or "").strip()
    errors = {}
    if len(title) < 5:
        errors["title"] = "Enter a title (5+ characters)."
    if len(desc) < 20:
        errors["description"] = "Describe the challenge (20+ characters)."
    from ..validators import parse_date
    due = None
    due = parse_date(d.get("due_date") or d.get("due"))
    if not due:
        errors["due_date"] = "Choose a deadline."
    elif due.isoformat() <= now()[:10]:
        errors["due_date"] = "The deadline must be in the future."
    rep = g.user["role"] == "representative"
    funded = "none"
    if rep:                                             # representatives must answer the funding question
        funded = {"yes": "yes", "true": "yes", "no": "no", "false": "no"}.get(str(d.get("funded", "")).lower())
        if not funded:
            errors["funded"] = "Choose whether your organisation will fund this project."
    if errors:
        fail("Please correct the highlighted fields.", 422, **errors)

    description = _with_detail(desc, d)
    classification = classify_text(title, description)
    best, _ranked = assign_supervisor(classification)
    supervisor_id = best["id"] if best else None
    cid = execute("""INSERT INTO challenges (title, description, priority, due_date, status, funded, submitted_by, supervisor_id)
                     VALUES (?,?,?,?,?,?,?,?)""", (title, description, "Medium", due.isoformat(), "Submitted", funded, g.user["id"], supervisor_id))
    code = set_code(cid)
    store_areas(cid, classification)
    me = full_name(g.user)
    log(me, "submitted %s “%s”." % (code, title), "info")
    if supervisor_id:
        notify(supervisor_id, "alert", me, "New challenge submitted for review: “%s”." % title, code, code)
        sup = query("SELECT * FROM users WHERE id = ?", (supervisor_id,), one=True)
        msg = "%s submitted. %s will review it." % (code, full_name(sup))
    else:
        notify_supervisors("alert", me, "New challenge submitted for review: “%s”." % title, code)
        msg = "%s submitted. A supervisor will review it." % code
    return jsonify({"message": msg, "challenge": serialize(challenge_by_code(code), detail=True)}), 201


@bp.get("")
@login_required()
def list_challenges():
    u = g.user
    if u["role"] == "supervisor":
        rows = query("SELECT * FROM challenges WHERE supervisor_id = ? ORDER BY id DESC", (u["id"],))
    elif u["role"] == "representative":
        rows = query("SELECT * FROM challenges WHERE submitted_by = ? ORDER BY id DESC", (u["id"],))
    elif u["role"] == "student":
        rows = query("SELECT * FROM challenges WHERE status IN (%s) ORDER BY due_date" % ",".join("?" * len(OPEN)), OPEN)
    else:
        fail("You do not have access to this.", 403)
    status = request.args.get("status")
    return jsonify([serialize(r) for r in rows if not status or r["status"] == status])


@bp.get("/<code>")
@login_required()
def detail(code):
    ch = _get(code)
    u = g.user
    if u["role"] == "student":
        if ch["status"] not in OPEN + ("Completed",) and not _working_on(u, ch):
            fail("You do not have access to this challenge.", 403)
    elif not _involved(u, ch) and u["role"] != "supervisor":
        fail("You do not have access to this challenge.", 403)
    return jsonify(serialize(ch, detail=True))


@bp.post("/<code>/open")
@login_required("supervisor")
def open_review(code):
    ch = _get(code)
    _supervisor_only(ch)
    if ch["status"] == "Submitted":
        execute("UPDATE challenges SET status = 'Under Review' WHERE id = ?", (ch["id"],))
    return jsonify(serialize(_get(code)))


# ---------- supervisor review ----------
@bp.post("/<code>/review")
@login_required("supervisor")
def review(code):
    ch, d = _get(code), _data()
    _supervisor_only(ch)
    _status(ch, "Submitted", "Under Review")
    action, comment = d.get("action"), (d.get("comment") or "").strip()
    me = full_name(g.user)
    if action == "approve":
        execute("UPDATE challenges SET status = 'Unallocated', approved_at = ? WHERE id = ?", (now(), ch["id"]))
        picked = auto_allocate_team(_get(code), me)
        if not picked:
            notify(ch["submitted_by"], "update", me, "“%s” has been approved; a team is being matched." % ch["title"], code, code)
        msg = "%s approved — %d student(s) assigned." % (code, len(picked)) if picked else "%s approved; matching a team." % code
    elif action == "request_info":
        if len(comment) < 3:
            fail("Say what information is needed.", 422, comment="Say what information is needed.")
        execute("UPDATE challenges SET status = 'Pending Information', info_request = ? WHERE id = ?", (comment, ch["id"]))
        notify(ch["submitted_by"], "alert", me, "More details needed for “%s”: %s" % (ch["title"], comment), code, code)
        msg = "Information requested from the representative."
    elif action == "reject":
        if len(comment) < 3:
            fail("Give a reason for rejecting.", 422, comment="Give a reason for rejecting.")
        execute("UPDATE challenges SET status = 'Rejected', decision_note = ? WHERE id = ?", (comment, ch["id"]))
        notify(ch["submitted_by"], "update", me, "“%s” was not approved: %s" % (ch["title"], comment), code, code)
        log(me, "rejected %s." % code, "bad")
        msg = "%s rejected." % code
    else:
        fail("Unknown action.", 422)
    return jsonify({"message": msg, "challenge": serialize(_get(code))})


@bp.post("/<code>/respond")
@login_required("representative")
def respond(code):
    ch, d = _get(code), _data()
    if ch["submitted_by"] != g.user["id"]:
        fail("Only the representative who submitted this challenge can respond.", 403)
    _status(ch, "Pending Information")
    text = (d.get("response") or "").strip()
    if len(text) < 5:
        fail("Write a short response (5+ characters).", 422, response="Write a short response (5+ characters).")
    execute("UPDATE challenges SET status = 'Submitted', info_request = NULL, description = description || ? WHERE id = ?",
            ("\n\nAdditional information: " + text, ch["id"]))
    if ch["supervisor_id"]:
        notify(ch["supervisor_id"], "alert", full_name(g.user), "Information added to “%s”." % ch["title"], code, code)
    return jsonify({"message": "Information sent — %s is back with the supervisor." % code})


# ---------- student work ----------
@bp.post("/<code>/progress")
@login_required("student")
def progress(code):
    ch, d = _get(code), _data()
    if not _working_on(g.user, ch):
        fail("You are not working on this challenge.", 403)
    _status(ch, "Allocated", "In Progress")
    try:
        pct = int(d.get("pct"))
    except (TypeError, ValueError):
        pct = -1
    note = (d.get("note") or "").strip()
    if not 0 <= pct <= 100:
        fail("Progress must be between 0 and 100.", 422, pct="Progress must be between 0 and 100.")
    if len(note) < 5:
        fail("Describe your progress (5+ characters).", 422, note="Describe your progress (5+ characters).")
    me = full_name(g.user)
    execute("INSERT INTO progress_updates (challenge_id, user_id, pct, note) VALUES (?,?,?,?)", (ch["id"], g.user["id"], pct, note))
    if pct >= 100:
        execute("UPDATE challenges SET status = 'Completed', progress = 100, completed_at = ?, summary = COALESCE(NULLIF(?, ''), summary) WHERE id = ?",
                (now(), note, ch["id"]))
        for s in team_of(ch["id"]):
            notify(s["id"], "update", me, "“%s” is complete." % ch["title"], code, code)
        if ch["supervisor_id"]:
            notify(ch["supervisor_id"], "update", me, "“%s” reached 100%% and is complete." % ch["title"], code, code)
        notify(ch["submitted_by"], "update", me, "“%s” has been completed." % ch["title"], code, code)
        log(me, "completed %s at 100%%." % code, "ok")
        return jsonify({"message": "Work completed — %s is now complete." % code})
    execute("UPDATE challenges SET progress = ?, status = 'In Progress' WHERE id = ?", (pct, ch["id"]))
    if ch["supervisor_id"]:
        notify(ch["supervisor_id"], "update", me, "Progress updated to %d%%." % pct, code, code)
    return jsonify({"message": "Progress updated to %d%%." % pct})
