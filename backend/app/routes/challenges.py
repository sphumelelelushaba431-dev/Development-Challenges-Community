"""Challenge life-cycle.

  Representative submits (funding Yes/No required) → keywords → Area of Interest → supervisor (MCDA)  [Submitted]
  Supervisor reviews: approve [Unallocated] · request information [Pending Information] · reject [Rejected]
  Representative answers an information request → [Submitted]
  Unallocated → students ranked with MCDA → supervisor allocates [Allocated], or decides when no match is found
  Student updates progress [In Progress] → submits work [Pending Verification]
  Supervisor verifies → [Completed] or returns for rework [In Progress]
  Supervisors can submit challenges too (funding not required).
"""
import os
import uuid

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory

from ..auth import login_required
from ..db import execute, jload, now, query
from ..errors import fail
from ..services import (assign_supervisor, challenge_by_code, classify_text, full_name, log, match_students, notify, notify_admins,
                        set_code, store_areas, student_load, supervisor_load, team_of, user_by_name_or_no)
from ..validators import PRIORITIES, parse_date

bp = Blueprint("challenges", __name__, url_prefix="/api/challenges")
ALLOWED_DOCS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".png", ".jpg", ".jpeg", ".ppt", ".pptx", ".zip"}


def _data():
    return request.get_json(silent=True) or request.form.to_dict()


def _get(code):
    ch = challenge_by_code(code)
    if not ch:
        fail("Challenge not found.", 404)
    return ch


def _involved(user, ch):
    if user["role"] == "admin":
        return True
    if user["id"] in (ch["submitted_by"], ch["supervisor_id"]):
        return True
    return bool(query("SELECT 1 FROM challenge_students WHERE challenge_id = ? AND student_id = ?", (ch["id"], user["id"]), one=True))


def _supervisor_only(ch):
    if g.user["role"] != "admin" and ch["supervisor_id"] != g.user["id"]:
        fail("Only the challenge's supervisor can do this.", 403)


def _status(ch, *allowed):
    if ch["status"] not in allowed:
        fail("This cannot be done while the challenge is '%s'." % ch["status"], 409)


def _save_files(ch):
    saved = []
    for f in request.files.getlist("files") + request.files.getlist("file"):
        if not f or not f.filename:
            continue
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_DOCS:
            fail("File type %s is not allowed." % ext, 422)
        folder = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(folder, exist_ok=True)
        stored = uuid.uuid4().hex + ext
        f.save(os.path.join(folder, stored))
        execute("INSERT INTO documents (challenge_id, user_id, filename, stored_as) VALUES (?,?,?,?)", (ch["id"], g.user["id"], os.path.basename(f.filename), stored))
        saved.append(f.filename)
    return saved


def serialize(ch, detail=False):
    sup = query("SELECT * FROM users WHERE id = ?", (ch["supervisor_id"],), one=True) if ch["supervisor_id"] else None
    by = query("SELECT * FROM users WHERE id = ?", (ch["submitted_by"],), one=True)
    out = {"id": ch["code"], "title": ch["title"], "status": ch["status"], "priority": ch["priority"], "due": ch["due_date"],
           "funded": {"yes": True, "no": False}.get(ch["funded"], "none"), "pct": ch["progress"],
           "supervisor": full_name(sup) if sup else None, "by": full_name(by) if by else None, "org": by["organisation"] if by else None,
           "team": [full_name(s) for s in team_of(ch["id"])], "request": ch["info_request"], "created": ch["created_at"],
           "completed": ch["completed_at"]}
    if detail:
        out.update({"desc": ch["description"], "areas": jload(ch["areas"]), "keywords": jload(ch["keywords"]), "summary": ch["summary"],
                    "documents": [dict(id=d["id"], name=d["filename"], at=d["uploaded_at"]) for d in
                                  query("SELECT * FROM documents WHERE challenge_id = ? ORDER BY id", (ch["id"],))],
                    "history": [dict(at=p["created_at"], pct=p["pct"], note=p["note"]) for p in
                                query("SELECT * FROM progress_updates WHERE challenge_id = ? ORDER BY id", (ch["id"],))]})
    return out


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
    due = parse_date(d.get("due_date") or d.get("due"))
    if not due:
        errors["due_date"] = "Choose a deadline."
    elif due.isoformat() <= now()[:10]:
        errors["due_date"] = "The deadline must be in the future."
    priority = d.get("priority") or "Medium"
    if priority not in PRIORITIES:
        errors["priority"] = "Choose a priority."
    rep = g.user["role"] == "representative"
    funded = "none"
    if rep:                                             # representatives must answer the funding question
        funded = {"yes": "yes", "true": "yes", "no": "no", "false": "no"}.get(str(d.get("funded", "")).lower())
        if not funded:
            errors["funded"] = "Choose whether your organisation will fund this project."
    if errors:
        fail("Please correct the highlighted fields.", 422, **errors)

    classification = classify_text(title, desc)          # keywords → Area(s) of Interest
    cap = current_app.config["SUPERVISOR_CAP"]
    own_room = not rep and supervisor_load(g.user["id"]) < cap
    if own_room:
        supervisor_id, status, approved = g.user["id"], "Unallocated", now()
    else:
        best, _ranked = assign_supervisor(classification, exclude=None if rep else g.user["id"])
        supervisor_id, status, approved = (best["id"] if best else None), "Submitted", None
    cid = execute("""INSERT INTO challenges (title, description, priority, due_date, status, funded, submitted_by, supervisor_id, approved_at)
                     VALUES (?,?,?,?,?,?,?,?,?)""", (title, desc, priority, due.isoformat(), status, funded, g.user["id"], supervisor_id, approved))
    code = set_code(cid)
    store_areas(cid, classification)
    _save_files(challenge_by_code(code))
    me = full_name(g.user)
    log(me, "submitted %s “%s”." % (code, title), "info")
    if own_room:
        match_students(challenge_by_code(code))
        msg = "%s added to your challenges — students are being matched." % code
    elif supervisor_id:
        notify(supervisor_id, "alert", me, "New challenge submitted for review: “%s”." % title, code, code)
        sup = query("SELECT * FROM users WHERE id = ?", (supervisor_id,), one=True)
        msg = "%s submitted for review." % code if rep else "%s submitted. You have %d open challenges, so %s will take it." % (code, cap, full_name(sup))
    else:
        notify_admins("alert", me, "No supervisor could be matched to “%s”. Please assign one." % title, code)
        msg = "%s submitted. A coordinator will assign a supervisor." % code
    ch = challenge_by_code(code)
    return jsonify({"message": msg, "challenge": serialize(ch, detail=True)}), 201


@bp.get("")
@login_required()
def list_challenges():
    u = g.user
    if u["role"] == "admin":
        rows = query("SELECT * FROM challenges ORDER BY id DESC")
    elif u["role"] == "supervisor":
        rows = query("SELECT * FROM challenges WHERE supervisor_id = ? ORDER BY id DESC", (u["id"],))
    elif u["role"] == "representative":
        rows = query("SELECT * FROM challenges WHERE submitted_by = ? ORDER BY id DESC", (u["id"],))
    else:
        rows = query("SELECT c.* FROM challenges c JOIN challenge_students cs ON cs.challenge_id = c.id WHERE cs.student_id = ? ORDER BY c.id DESC", (u["id"],))
    status = request.args.get("status")
    return jsonify([serialize(r) for r in rows if not status or r["status"] == status])


@bp.get("/<code>")
@login_required()
def detail(code):
    ch = _get(code)
    if not _involved(g.user, ch) and ch["status"] not in ("Unallocated", "Approved", "Completed"):
        fail("You do not have access to this challenge.", 403)
    return jsonify(serialize(ch, detail=True))


# ---------- supervisor review ----------
@bp.post("/<code>/open")
@login_required("supervisor", "admin")
def open_review(code):
    ch = _get(code)
    _supervisor_only(ch)
    if ch["status"] == "Submitted":
        execute("UPDATE challenges SET status = 'Under Review' WHERE id = ?", (ch["id"],))
    return jsonify(serialize(_get(code)))


@bp.post("/<code>/review")
@login_required("supervisor", "admin")
def review(code):
    ch, d = _get(code), _data()
    _supervisor_only(ch)
    _status(ch, "Submitted", "Under Review")
    action, comment = d.get("action"), (d.get("comment") or "").strip()
    me = full_name(g.user)
    if action == "approve":
        cap = current_app.config["SUPERVISOR_CAP"]
        status = "Unallocated" if supervisor_load(ch["supervisor_id"]) < cap else "Approved"
        execute("UPDATE challenges SET status = ?, approved_at = ? WHERE id = ?", (status, now(), ch["id"]))
        if status == "Unallocated":
            match_students(_get(code))
        notify(ch["submitted_by"], "update", me, "“%s” has been approved." % ch["title"], code, code)
        msg = "%s approved." % code
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
    files = _save_files(ch)
    execute("UPDATE challenges SET status = 'Submitted', info_request = NULL, description = description || ? WHERE id = ?",
            ("\n\nAdditional information: " + text, ch["id"]))
    if ch["supervisor_id"]:
        notify(ch["supervisor_id"], "alert", full_name(g.user), "Information added to “%s”%s." % (ch["title"], " with %d file(s)" % len(files) if files else ""), code, code)
    return jsonify({"message": "Information sent — %s is back with the supervisor." % code})


# ---------- matching & allocation ----------
@bp.get("/<code>/matches")
@login_required("supervisor", "admin")
def matches(code):
    ch = _get(code)
    _supervisor_only(ch)
    r = match_students(ch)
    return jsonify({"outcome": r["outcome"], "stage": r["stage"],
                    "ranked": [{"id": x["id"], "name": x["name"], "score": x["wsm"], "topsis": x["topsis"], "eligible": x["eligible"],
                                "recommended": x["recommended"], "load": x["load"], "cap": x["cap"], "available": x["available"], "via": x["via"]}
                               for x in r["ranked"]]})


def allocate_student(ch, student, by_name):
    cap = current_app.config["STUDENT_CAP"]
    if student_load(student["id"]) >= cap:
        fail("%s already has %d active challenges." % (full_name(student), cap), 409)
    execute("INSERT OR IGNORE INTO challenge_students (challenge_id, student_id) VALUES (?,?)", (ch["id"], student["id"]))
    execute("UPDATE challenges SET status = 'Allocated', allocated_at = ?, match_outcome = NULL WHERE id = ?", (now(), ch["id"]))
    notify(student["id"], "assign", by_name, "You have been added to “%s”." % ch["title"], ch["code"], ch["code"])
    if ch["submitted_by"] != g.user["id"]:
        notify(ch["submitted_by"], "update", by_name, "A student team has been allocated to “%s”." % ch["title"], ch["code"], ch["code"])
    # any other pending requests for this challenge are declined
    for r in query("SELECT * FROM requests WHERE challenge_id = ? AND status = 'pending' AND student_id <> ?", (ch["id"], student["id"])):
        execute("UPDATE requests SET status = 'declined', note = 'Another student was allocated.', decided_at = ? WHERE id = ?", (now(), r["id"]))
        notify(r["student_id"], "update", by_name, "Your request for “%s” was declined: another student was allocated." % ch["title"], ch["code"], ch["code"])


@bp.post("/<code>/allocate")
@login_required("supervisor", "admin")
def allocate(code):
    ch, d = _get(code), _data()
    _supervisor_only(ch)
    _status(ch, "Unallocated", "Approved")
    student = user_by_name_or_no(d.get("student"))
    if not student or student["role"] != "student":
        fail("Choose a student.", 422, student="Choose a student.")
    ranked = match_students(ch)["ranked"]
    recommended = {x["id"] for x in ranked if x["recommended"]}
    if student["id"] not in recommended and len((d.get("reason") or "").strip()) < 3:
        fail("Give a reason for choosing a student who was not recommended.", 422, reason="Give a reason.")
    allocate_student(ch, student, full_name(g.user))
    log(full_name(g.user), "allocated %s to %s." % (code, full_name(student)), "ok")
    return jsonify({"message": "%s assigned to %s. They have been notified." % (code, full_name(student))})


@bp.post("/<code>/decide")
@login_required("supervisor", "admin")
def decide(code):
    """No suitable student found: reject · keep unallocated · approve for further review."""
    ch, d = _get(code), _data()
    _supervisor_only(ch)
    _status(ch, "Unallocated")
    action, note = d.get("action"), (d.get("note") or "").strip()
    if action == "reject":
        if len(note) < 3:
            fail("Give a reason for rejecting.", 422, note="Give a reason for rejecting.")
        execute("UPDATE challenges SET status = 'Rejected', decision_note = ? WHERE id = ?", (note, ch["id"]))
        notify(ch["submitted_by"], "update", full_name(g.user), "“%s” was not approved: %s" % (ch["title"], note), code, code)
        msg = "%s rejected." % code
    elif action == "keep":
        msg = "%s stays unallocated." % code
    elif action == "further_review":
        execute("UPDATE challenges SET status = 'Interest Review', decision_note = ? WHERE id = ?", (note, ch["id"]))
        notify_admins("alert", full_name(g.user), "“%s” needs its interest categories reviewed." % ch["title"], code)
        msg = "%s sent for further review." % code
    else:
        fail("Unknown action.", 422)
    return jsonify({"message": msg})


# ---------- work ----------
@bp.post("/<code>/progress")
@login_required("student", "representative")
def progress(code):
    ch, d = _get(code), _data()
    if not _involved(g.user, ch):
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
    execute("INSERT INTO progress_updates (challenge_id, user_id, pct, note) VALUES (?,?,?,?)", (ch["id"], g.user["id"], pct, note))
    execute("UPDATE challenges SET progress = ?, status = 'In Progress' WHERE id = ?", (pct, ch["id"]))
    if ch["supervisor_id"]:
        notify(ch["supervisor_id"], "update", full_name(g.user), "Progress updated to %d%%." % pct, code, code)
    return jsonify({"message": "Progress updated to %d%%." % pct})


@bp.post("/<code>/submit-work")
@login_required("student")
def submit_work(code):
    ch = _get(code)
    if not _involved(g.user, ch):
        fail("You are not working on this challenge.", 403)
    _status(ch, "In Progress", "Allocated")
    _save_files(ch)
    execute("UPDATE challenges SET status = 'Pending Verification', progress = 100 WHERE id = ?", (ch["id"],))
    if ch["supervisor_id"]:
        notify(ch["supervisor_id"], "alert", full_name(g.user), "Final work submitted for “%s” — waiting for your verification." % ch["title"], code, code)
    return jsonify({"message": "Submitted — your supervisor will verify it."})


@bp.post("/<code>/verify")
@login_required("supervisor", "admin")
def verify(code):
    ch, d = _get(code), _data()
    _supervisor_only(ch)
    _status(ch, "Pending Verification")
    action, feedback = d.get("action"), (d.get("feedback") or "").strip()
    me = full_name(g.user)
    team = team_of(ch["id"])
    if action == "approve":
        execute("UPDATE challenges SET status = 'Completed', completed_at = ?, progress = 100, summary = COALESCE(NULLIF(?, ''), summary) WHERE id = ?",
                (now(), feedback, ch["id"]))
        for s in team:
            notify(s["id"], "update", me, "“%s” verified and completed.%s" % (ch["title"], " " + feedback if feedback else ""), code, code)
        notify(ch["submitted_by"], "update", me, "“%s” has been completed and verified." % ch["title"], code, code)
        log(me, "verified %s as completed." % code, "ok")
        msg = "%s marked as completed." % code
    elif action == "return":
        if len(feedback) < 3:
            fail("Add feedback for the student.", 422, feedback="Add feedback for the student.")
        execute("UPDATE challenges SET status = 'In Progress' WHERE id = ?", (ch["id"],))
        for s in team:
            notify(s["id"], "message", me, "Returned for rework: %s" % feedback, code, code)
        msg = "%s returned with feedback." % code
    else:
        fail("Unknown action.", 422)
    return jsonify({"message": msg})


# ---------- documents ----------
@bp.post("/<code>/documents")
@login_required()
def upload(code):
    ch = _get(code)
    if not _involved(g.user, ch):
        fail("You are not part of this challenge.", 403)
    saved = _save_files(ch)
    if not saved:
        fail("Choose at least one file.", 422)
    return jsonify({"message": "%d document(s) uploaded." % len(saved)}), 201


@bp.get("/<code>/documents/<int:doc_id>")
@login_required()
def download(code, doc_id):
    ch = _get(code)
    if not _involved(g.user, ch):
        fail("You are not part of this challenge.", 403)
    doc = query("SELECT * FROM documents WHERE id = ? AND challenge_id = ?", (doc_id, ch["id"]), one=True)
    if not doc:
        fail("Document not found.", 404)
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], doc["stored_as"], as_attachment=True, download_name=doc["filename"])
