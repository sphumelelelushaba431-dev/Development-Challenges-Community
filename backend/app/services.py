"""Business logic shared by the routes: people, capacity, keyword classification, MCDA matching,
notifications and activity."""
from datetime import datetime, timezone

from flask import current_app

from . import mcda
from .db import execute, jdump, jload, now, query
from .nlp.classify import classify
from .nlp.keywords import build_idf
from .nlp.taxonomy import AREA_VOCAB, AREAS

OPEN = ("Unallocated", "Allocated", "In Progress")      # count toward the supervisor cap
ACTIVE = ("Allocated", "In Progress")                   # count toward the student cap


# ---------- people ----------
def full_name(u):
    return (u["title"] + " " if u["title"] else "") + u["first_name"] + " " + u["surname"]


def initials(u):
    return (u["first_name"][:1] + u["surname"][:1]).upper()


def areas_of(u):
    areas = jload(u["expertise"])
    if u["interest"] and u["interest"] not in areas:
        areas = [u["interest"]] + areas
    return areas


def profile(u):
    return {"id": u["member_no"], "title": u["title"], "email": u["email"], "phone": u["phone"], "org": u["organisation"],
            "interest": u["interest"] if u["role"] in ("student", "supervisor") else None, "address": u["address"],
            "joined": u["joined_at"][:10], "photo": u["photo"]}


def me_payload(u):
    label = {"student": "Student", "supervisor": "Supervisor", "representative": "Representative", "admin": "Administrator"}.get(u["role"], u["role"].title())
    return {"name": full_name(u), "initials": initials(u), "role": u["role"], "roleLabel": label, "meta": label + " · " + u["member_no"],
            "org": u["organisation"], "interests": areas_of(u), "profile": profile(u)}


def user_by_name_or_no(value):
    value = (value or "").strip()
    u = query("SELECT * FROM users WHERE upper(member_no) = upper(?)", (value,), one=True)
    if u:
        return u
    for row in query("SELECT * FROM users WHERE status = 'active'"):
        if full_name(row).lower() == value.lower() or (row["first_name"] + " " + row["surname"]).lower() == value.lower():
            return row
    return None


def supervisor_load(uid):
    return query("SELECT COUNT(*) n FROM challenges WHERE supervisor_id = ? AND status IN (%s)" % ",".join("?" * len(OPEN)), (uid, *OPEN), one=True)["n"]


def student_load(uid):
    return query("SELECT COUNT(*) n FROM challenge_students cs JOIN challenges c ON c.id = cs.challenge_id WHERE cs.student_id = ? AND c.status IN (%s)" % ",".join("?" * len(ACTIVE)),
                 (uid, *ACTIVE), one=True)["n"]


# ---------- keyword classification (IDF learned from all challenges in the database) ----------
_IDF = {"n": -1, "idf": None, "docs": 0}


def idf():
    count = query("SELECT COUNT(*) n FROM challenges", one=True)["n"]
    if count != _IDF["n"]:
        docs = [r["title"] + ". " + r["description"] for r in query("SELECT title, description FROM challenges")]
        docs += [v["profile"] for v in AREA_VOCAB.values()]
        _IDF["idf"], _IDF["docs"] = build_idf(docs)
        _IDF["n"] = count
    return _IDF["idf"], _IDF["docs"]


def classify_text(title, description):
    table, n = idf()
    return classify(description, title, table, n)


def classification_of(ch):
    """Re-use the stored areas when present, otherwise classify again."""
    areas = jload(ch["areas"])
    if areas:
        return {"stage": areas[0].get("stage", "exact"), "areas": areas}
    return classify_text(ch["title"], ch["description"])


# ---------- MCDA ----------
def _cfg():
    c = current_app.config
    return {"MCDA_WEIGHTS": c["MCDA_WEIGHTS"], "MCDA_THRESHOLD": c["MCDA_THRESHOLD"], "MCDA_RANKING": c["MCDA_RANKING"]}


def supervisor_candidates(exclude=None):
    cap = current_app.config["SUPERVISOR_CAP"]
    out = []
    for u in query("SELECT * FROM users WHERE role = 'supervisor' AND status = 'active'"):
        if exclude and u["id"] == exclude:
            continue
        out.append({"id": u["id"], "name": full_name(u), "areas": areas_of(u), "load": supervisor_load(u["id"]), "cap": cap,
                    "available": bool(u["available"]), "record": u["record"]})
    return out


def student_candidates():
    cap = current_app.config["STUDENT_CAP"]
    return [{"id": u["id"], "name": full_name(u), "areas": areas_of(u), "load": student_load(u["id"]), "cap": cap,
             "available": bool(u["available"]), "record": u["record"]}
            for u in query("SELECT * FROM users WHERE role = 'student' AND status = 'active'")]


def assign_supervisor(classification, exclude=None):
    candidates = supervisor_candidates(exclude)
    if not candidates:
        return None, []
    ranked = [] if classification["stage"] == "none" else mcda.rank(classification, candidates, _cfg(), supervisor=True)
    best = next((r for r in ranked if r["recommended"]), None)
    if not best:                                       # always auto-assign, even with no keyword match
        pick = min(candidates, key=lambda x: (x["load"], x["record"]))
        best = next((r for r in ranked if r["id"] == pick["id"]), None)
        if not best:
            best = dict(pick, recommended=True)
    return best, ranked


def match_students(ch):
    """Rank students for an Unallocated challenge; sets match_outcome (recommended | flagged)."""
    cl = classification_of(ch)
    ranked = [] if cl["stage"] == "none" else mcda.rank(cl, student_candidates(), _cfg())
    outcome = "recommended" if any(r["recommended"] for r in ranked) else "flagged"
    if ch["match_outcome"] != outcome:
        execute("UPDATE challenges SET match_outcome = ? WHERE id = ?", (outcome, ch["id"]))
    return {"outcome": outcome, "stage": cl["stage"], "ranked": ranked}


# ---------- notifications & activity ----------
def notify(user_id, kind, sender, text, about="", ref=""):
    execute("INSERT INTO notifications (user_id, kind, sender, about, text, ref) VALUES (?,?,?,?,?,?)", (user_id, kind, sender, about, text, ref))


def notify_admins(kind, sender, text, about=""):
    """Account approvals are handled by the administrator only."""
    for a in query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'"):
        notify(a["id"], kind, sender, text, about)


def notify_supervisors(kind, sender, text, about=""):
    """Challenge reviews and unmatched challenges are handled by supervisors."""
    for s in query("SELECT id FROM users WHERE role = 'supervisor' AND status = 'active'"):
        notify(s["id"], kind, sender, text, about)


def log(who, text, kind="info"):
    execute("INSERT INTO activity (who, text, kind) VALUES (?,?,?)", (who, text, kind))


# ---------- misc ----------
def days_ago(ts):
    try:
        t = datetime.strptime(ts[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return 0
    return max(0, (datetime.now(timezone.utc) - t).days)


def challenge_by_code(code):
    return query("SELECT * FROM challenges WHERE code = ?", (code,), one=True)


def set_code(cid):
    code = "DCC-%06d" % cid
    execute("UPDATE challenges SET code = ? WHERE id = ?", (code, cid))
    return code


def team_of(cid):
    return query("SELECT u.* FROM challenge_students cs JOIN users u ON u.id = cs.student_id WHERE cs.challenge_id = ? ORDER BY cs.assigned_at", (cid,))


def area_index(name):
    return AREAS.index(name) if name in AREAS else len(AREAS) - 1


def store_areas(cid, classification):
    execute("UPDATE challenges SET areas = ?, keywords = ? WHERE id = ?",
            (jdump([{k: a[k] for k in ("area", "score", "stage", "alignment", "via")} for a in classification["areas"]]),
             jdump(classification.get("keywords", [])[:15]), cid))


def stamp():
    return now()
