from datetime import date, timedelta
from io import BytesIO
import sqlite3

from app import create_app
from app.config import TestConfig


def future(days=40):
    return (date.today() + timedelta(days=days)).isoformat()


def next_weekday(n=3):
    d = date.today()
    while n:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d.isoformat()


def supervisor_headers(client, login, name):
    for no in ("DCC00001", "DCC00011", "DCC00012", "DCC00013", "DCC00014", "DCC00015", "DCC00016"):
        headers = login(no)
        if client.get("/api/me", headers=headers).json["name"] == name:
            return headers
    raise AssertionError("Supervisor not found: " + name)


def assigned_student(client, login, code):
    for no in ("DCC00002", "DCC00004", "DCC00005"):
        headers = login(no)
        mine = client.get("/api/dashboard/student", headers=headers).json["mine"]
        if any(c["id"] == code for c in mine):
            return headers
    raise AssertionError("No student assigned to " + code)


def test_health_and_cors(client):
    r = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert r.json == {"status": "ok"} and r.headers["Access-Control-Allow-Origin"]


def test_frontend_is_served_and_unknown_api_paths_stay_404(client):
    assert b"Development Challenges" in client.get("/").data
    assert b"apiBase" in client.get("/js/config.js").data
    assert client.get("/api/not-a-route").status_code == 404


def test_auth_required(client):
    assert client.get("/api/dashboard/student").status_code == 401


REGISTRATION = dict(role="student", title="Ms", gender="Female", first_name="Lerato", surname="Dlamini", id_number="9001015009086",
                    phone="0712223333", phone_country="ZA", email="Lerato@Example.com", organisation="University of Zululand", area_of_interest="Research",
                    address="1 Main Road, Empangeni, 3880", password="Strong@123", confirm_password="Strong@123", terms_accepted="yes", popia_consent="yes")


def test_register_then_login_with_own_credentials_and_email(app, client):
    app.config["REQUIRE_APPROVAL"] = False
    body = REGISTRATION
    bad = client.post("/api/auth/register", json={**body, "terms_accepted": "", "id_number": "123"})
    assert bad.status_code == 422 and "id_number" in bad.json["fields"] and "terms" in bad.json["fields"]
    bad_phone = client.post("/api/auth/register", json={**body, "phone_country": "ZZ"})
    assert bad_phone.status_code == 422 and "phone" in bad_phone.json["fields"]
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201 and r.json["status"] == "active" and r.json["email_sent"] is True
    no = r.json["member_no"]
    assert no in r.json["message"]

    # confirmation e-mail with the member's ID and details — never the password
    mail = app.extensions["outbox"][-1]
    assert mail["To"] == "lerato@example.com" and no in mail["Subject"]
    text = mail.get_body(("plain",)).get_content()
    assert no in text and "Ms Lerato Dlamini" in text and "Student" in text and "Strong@123" not in text

    # the credentials chosen at registration work straight away — by Member ID or by e-mail
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Strong@123"}).status_code == 200
    assert client.post("/api/auth/login", json={"member_id": no.lower(), "password": "Strong@123"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "LERATO@example.com", "password": "Strong@123"}).status_code == 200
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Wrong@123"}).status_code == 401
    assert client.post("/api/auth/register", json=body).json["fields"]["email"]          # e-mail already registered


def test_existing_database_applies_both_audit_and_admin_migrations(tmp_path):
    database = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(database) as legacy:
        legacy.executescript("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_no TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL CHECK (role IN ('student','supervisor','representative')),
                first_name TEXT NOT NULL,
                surname TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT NOT NULL DEFAULT '',
                organisation TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                failed_logins INTEGER NOT NULL DEFAULT 0,
                available INTEGER NOT NULL DEFAULT 1,
                record REAL NOT NULL DEFAULT 0.8,
                terms_at TEXT,
                joined_at TEXT NOT NULL DEFAULT (datetime('now')),
                locked_at TEXT
            );
            CREATE TABLE challenges (id INTEGER PRIMARY KEY AUTOINCREMENT);
            CREATE TABLE activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                who TEXT NOT NULL,
                text TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'info',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO users (member_no, role, first_name, surname, email, password_hash)
            VALUES ('DCC00001', 'supervisor', 'Legacy', 'Supervisor', 'legacy@example.com', 'hash');
        """)

    create_app(TestConfig, DATABASE=str(database), UPLOAD_FOLDER=str(tmp_path / "uploads"))

    with sqlite3.connect(database) as migrated:
        role_check = migrated.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").fetchone()[0]
        activity_columns = {row[1] for row in migrated.execute("PRAGMA table_info(activity)")}
        challenge_columns = {row[1] for row in migrated.execute("PRAGMA table_info(challenges)")}
        assert "'admin'" in role_check
        assert {"action", "actor_id", "session_id", "duration", "ip"} <= activity_columns
        assert "budget" in challenge_columns
        assert migrated.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
        assert migrated.execute("SELECT role FROM users WHERE member_no = 'DCC00000'").fetchone()[0] == "admin"
        assert migrated.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 2
        assert migrated.execute("PRAGMA foreign_key_check").fetchall() == []


def test_register_with_approval_required(app, client, login):
    app.config["REQUIRE_APPROVAL"] = True
    r = client.post("/api/auth/register", json=REGISTRATION)
    assert r.status_code == 201 and r.json["status"] == "pending"
    no = r.json["member_no"]
    registration_mail = app.extensions["outbox"][-1]
    assert "administrator has approved" in registration_mail.get_body(("plain",)).get_content()
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Strong@123"}).status_code == 403
    sup, rep = login("DCC00001"), login("DCC00003")
    assert client.post("/api/approvals/users/%s/approve" % no, headers=sup).status_code == 403   # supervisors cannot manage accounts
    assert client.post("/api/approvals/users/%s/approve" % no, headers=rep).status_code == 403   # nor can representatives
    assert client.post("/api/approvals/users/%s/approve" % no, headers=login("DCC00000", "Admin@2026")).status_code == 200
    assert "approved" in app.extensions["outbox"][-1]["Subject"]
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Strong@123"}).status_code == 200


def test_audit_log_tracks_who_what_when_and_how_long(client, login):
    stu = login("DCC00002")
    assert client.get("/api/me", headers=stu).status_code == 200
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "nope"}).status_code == 401
    assert client.post("/api/auth/logout", headers=stu).status_code == 200
    assert client.get("/api/me", headers=stu).status_code == 401                     # a logged-out token stops working

    sup = login("DCC00001")
    admin = login("DCC00000", "Admin@2026")
    for h in (stu, login("DCC00003"), sup):
        assert client.get("/api/audit/log", headers=h).status_code in (401, 403)
    entries = client.get("/api/audit/log?member=DCC00002", headers=admin).json["entries"]
    actions = [e["action"] for e in entries]
    assert "auth.login" in actions and "auth.logout" in actions
    e = next(e for e in entries if e["action"] == "auth.logout")
    assert e["who"] == "Ms Amahle Mthembu" and e["role"] == "Student" and e["at"] and e["duration"] is not None
    assert next(e for e in entries if e["action"] == "auth.login")["session"] in ("ended", "active", "idle")
    failed = client.get("/api/audit/log?area=auth&q=wrong password", headers=admin).json["entries"]
    assert any(e["member"] == "DCC00004" for e in failed)

    users = client.get("/api/audit/users", headers=admin).json["users"]
    amahle = next(u for u in users if u["id"] == "DCC00002")
    assert amahle["sessions"] >= 1 and amahle["last_login"] and amahle["time_online"] >= 0

    # Only the administrator can lock an account; locking ends existing sessions.
    stu2 = login("DCC00005")
    assert client.post("/api/approvals/users/DCC00005/lock", json={"reason": "Shared account"}, headers=sup).status_code == 403
    assert client.post("/api/approvals/users/DCC00005/lock", json={"reason": "Shared account"}, headers=admin).status_code == 200
    assert client.get("/api/me", headers=stu2).status_code in (401, 403)
    assert client.post("/api/auth/login", json={"member_id": "DCC00005", "password": "Demo@1234"}).status_code == 403
    assert client.post("/api/approvals/users/DCC00000/lock", json={"reason": "self"}, headers=admin).status_code == 403
    assert client.post("/api/approvals/users/DCC00005/unlock", headers=admin).status_code == 200
    assert client.post("/api/auth/login", json={"member_id": "DCC00005", "password": "Demo@1234"}).status_code == 200
    log = client.get("/api/audit/log?area=account", headers=admin).json["entries"]
    assert {"account.lock", "account.unlock"} <= {e["action"] for e in log}


def test_member_can_upload_profile_photo(client, login):
    headers = login("DCC00002")
    current = client.get("/api/me", headers=headers).json["profile"]
    response = client.put("/api/me", headers=headers, data={
        "email": current["email"], "phone": current["phone"], "phone_country": "ZA",
        "org": current["org"], "address": current["address"],
        "photo": (BytesIO(b"test image"), "profile.png", "image/png"),
    }, content_type="multipart/form-data")
    assert response.status_code == 200
    photo = response.json["profile"]["photo"]
    assert photo.startswith("photo-") and photo.endswith(".png")
    image = client.get("/api/photos/" + photo)
    assert image.status_code == 200 and image.data == b"test image"


def test_lockout_and_unlock(client, login):
    for _ in range(2):
        assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "wrong"}).status_code == 403
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "Demo@1234"}).status_code == 403
    assert client.post("/api/approvals/users/DCC00004/unlock", headers=login("DCC00001")).status_code == 403
    assert client.post("/api/approvals/users/DCC00004/unlock", headers=login("DCC00000", "Admin@2026")).status_code == 200
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "Demo@1234"}).status_code == 200


def test_submit_auto_supervisor_auto_team_and_completion(client, login):
    rep = login("DCC00008")
    body = {"title": "Water leaks in council flats", "description": "Residents report water leaks; we need sensors that detect a water leak and alert plumbing teams.",
            "detail": "Place sensors at every riser and send an SMS to the plumbing team.", "due_date": future(),
            "priority": "Critical", "files": "ignored"}
    assert client.post("/api/challenges", json=body, headers=rep).status_code == 422          # funding answer required
    r = client.post("/api/challenges", json={**body, "funded": "yes", "budget": 10000}, headers=rep)
    assert r.status_code == 201
    ch = r.json["challenge"]
    code = ch["id"]
    assert ch["status"] == "Submitted" and ch["team"] == []
    assert "More detail: Place sensors" in ch["desc"]
    assert "priority" not in ch and "documents" not in ch
    assert ch["supervisor"]                                                               # auto-assigned at submit

    sup = supervisor_headers(client, login, ch["supervisor"])
    review = client.post("/api/challenges/%s/review" % code, json={"action": "approve"}, headers=sup)
    assert review.status_code == 200
    approved = review.json["challenge"]
    assert approved["status"] == "Allocated"
    assert 1 <= len(approved["team"]) <= 3                                               # small team auto-allocated

    stu = assigned_student(client, login, code)
    assert client.post("/api/challenges/%s/progress" % code, json={"pct": 50, "note": "Sensors ordered"}, headers=stu).status_code == 200
    done = client.post("/api/challenges/%s/progress" % code, json={"pct": 100, "note": "Sensors live and alerts tested"}, headers=stu)
    assert done.status_code == 200 and "complete" in done.json["message"].lower()
    assert client.get("/api/challenges/%s" % code, headers=rep).json["status"] == "Completed"
    notes = client.get("/api/notifications", headers=rep).json
    assert any("complete" in n["text"].lower() for n in notes)

    assert client.post("/api/challenges/%s/verify" % code, json={"action": "approve"}, headers=sup).status_code == 404
    assert client.post("/api/challenges/%s/submit-work" % code, headers=stu).status_code == 404
    assert client.post("/api/challenges/%s/documents" % code, headers=stu).status_code == 404


def test_supervisor_submit_waits_for_review(client, login):
    sup = login("DCC00011")
    r = client.post("/api/challenges", json={"title": "Lab equipment booking tool",
                                             "description": "Students need a simple online booking system for lab equipment.",
                                             "due_date": future(), "funded": "no"}, headers=sup)
    assert r.status_code == 201
    ch = r.json["challenge"]
    assert ch["funded"] is False and ch["status"] == "Submitted" and ch["team"] == []
    assert ch["supervisor"]


def test_info_request_cycle(client, login):
    rep, sup = login("DCC00003"), login("DCC00012")
    code = next(c["id"] for c in client.get("/api/challenges", headers=rep).json if c["status"] == "Pending Information")
    assert client.post("/api/challenges/%s/respond" % code, json={"response": "Letters attached; 120 people expected."}, headers=rep).status_code == 200
    assert client.get("/api/challenges/%s" % code, headers=sup).json["status"] == "Submitted"


def test_students_work_only_on_allocated_challenges(client, login):
    stu = login("DCC00002")
    data = client.get("/api/dashboard/student", headers=stu).json
    assert "mine" in data and "open" in data
    assert "available" not in data and "requests" not in data and "documents" not in data
    mine = {c["id"] for c in data["mine"]}
    open_code = next(c["id"] for c in data["open"] if c["id"] not in mine)
    assert client.post("/api/challenges/%s/progress" % open_code, json={"pct": 40, "note": "Started without permission"}, headers=stu).status_code == 403
    assert client.get("/api/requests", headers=stu).status_code == 404
    assert client.post("/api/requests", json={"challenge": open_code}, headers=stu).status_code == 404


def test_meeting_invites_everyone_and_uses_venue(client, login):
    sup = login("DCC00011")
    code = next(c["id"] for c in client.get("/api/dashboard/supervisor", headers=sup).json["challenges"] if c["status"] == "In Progress")
    base = {"challenge": code, "title": "Check-in", "people": ["Not an invitee"], "date": next_weekday(3), "start": "11:00", "mins": 60, "venue": "Lab DC-002"}
    r = client.post("/api/meetings", json=base, headers=sup)
    assert r.status_code == 201
    m = r.json["meeting"]
    assert m["venue"] == "Lab DC-002" and len(m["people"]) >= 3
    assert "Dr Sipho Ndlovu" in m["people"] and "Not an invitee" not in m["people"]
    bad = client.post("/api/meetings", json={**base, "venue": ""}, headers=sup)                       # venue is required
    assert bad.status_code == 422 and "venue" in bad.json["fields"]
    clash = client.post("/api/meetings", json={**base, "venue": "lab dc-002", "start": "11:30"}, headers=sup)   # double booking
    assert clash.status_code == 422 and "venue" in clash.json["fields"]
    assert client.post("/api/meetings", json={**base, "venue": "Lab DC-002", "start": "12:00"}, headers=sup).status_code == 201
    student_nos = {"Ms Amahle Mthembu": "DCC00002", "Mr Lwazi Dube": "DCC00004", "Mr Thando Khumalo": "DCC00005"}
    rep_nos = {"Ms Sbongokuhle Msomi": "DCC00003", "Mr Sizwe Mthethwa": "DCC00008", "Ms Palesa Molefe": "DCC00009", "Mr Kagiso Nkosi": "DCC00010"}
    stu = login(next(student_nos[p] for p in m["people"] if p in student_nos))
    rep = login(next(rep_nos[p] for p in m["people"] if p in rep_nos))
    assert any(x["id"] == m["id"] for x in client.get("/api/meetings", headers=stu).json["meetings"])
    assert any(x["id"] == m["id"] for x in client.get("/api/meetings", headers=rep).json["meetings"])
    assert any(n["kind"] == "meeting" for n in client.get("/api/notifications", headers=stu).json)


def test_roles_are_enforced(client, login):
    stu, rep, sup = login("DCC00002"), login("DCC00003"), login("DCC00001")

    for headers in (stu, rep, sup):
        assert client.get("/api/me", headers=headers).json["role"] in ("student", "representative", "supervisor")

    assert client.get("/api/dashboard/student", headers=stu).status_code == 200
    assert client.get("/api/dashboard/representative", headers=rep).status_code == 200
    assert client.get("/api/dashboard/supervisor", headers=sup).status_code == 200
    assert client.get("/api/dashboard/student", headers=rep).status_code == 403
    assert client.get("/api/dashboard/representative", headers=stu).status_code == 403
    assert client.get("/api/dashboard/supervisor", headers=stu).status_code == 403
    adm = login("DCC00000", "Admin@2026")
    assert client.get("/api/me", headers=adm).json["role"] == "admin"
    assert client.get("/api/dashboard/admin", headers=adm).status_code == 200
    for headers in (stu, rep, sup):
        assert client.get("/api/dashboard/admin", headers=headers).status_code == 403
        assert client.get("/api/approvals/audit", headers=headers).status_code == 403
        assert client.get("/api/approvals/users", headers=headers).status_code == 403
    audit = client.get("/api/approvals/audit?q=locked", headers=adm)
    assert audit.status_code == 200 and all("locked" in (a["who"] + a["text"]).lower() for a in audit.json)

    body = {"title": "A role test challenge for the community", "description": "A detailed description of this challenge for testing.",
            "due_date": future(), "funded": "yes", "budget": 10000}
    assert client.post("/api/challenges", json=body, headers=stu).status_code == 403
    assert client.post("/api/challenges", json=body, headers=rep).status_code == 201
    assert client.post("/api/challenges", json={**body, "funded": "no"}, headers=sup).status_code == 201

    assert client.post("/api/challenges/DCC-000001/progress", json={"pct": 10, "note": "Started"}, headers=rep).status_code == 403
    assert client.post("/api/challenges/DCC-000001/review", json={"action": "approve"}, headers=stu).status_code == 403
    assert client.get("/api/approvals/users", headers=stu).status_code == 403
    assert client.get("/api/approvals/users", headers=rep).status_code == 403
    assert client.get("/api/approvals/users", headers=sup).status_code == 403     # only the administrator manages accounts

    assert client.get("/api/meetings", headers=stu).status_code == 200
    assert client.get("/api/meetings", headers=rep).status_code == 200
    assert client.get("/api/meetings", headers=sup).status_code == 200
    meeting = {"challenge": "DCC-000001", "title": "Role check", "date": next_weekday(5), "start": "11:00", "mins": 60, "venue": "Online (Teams)"}
    assert client.post("/api/meetings", json=meeting, headers=stu).status_code == 403
    assert client.post("/api/meetings", json=meeting, headers=rep).status_code == 403
    assert client.post("/api/meetings", json=meeting, headers=sup).status_code == 422   # not this supervisor's challenge


def test_public_overview_has_no_personal_contact_details(client):
    data = client.get("/api/public/overview").json["challenges"]
    assert data and all("email" not in c and "phone" not in c for c in data)


def test_funding_and_budget_rules(client, login):
    rep, sup = login("DCC00003"), login("DCC00011")
    base = {"title": "Funding rules test challenge", "description": "A detailed description of this challenge for testing.", "due_date": future()}
    # representatives must answer the funding question
    r = client.post("/api/challenges", json=base, headers=rep)
    assert r.status_code == 422 and "funded" in r.json["fields"]
    # "yes" needs a budget amount
    r = client.post("/api/challenges", json={**base, "funded": "yes"}, headers=rep)
    assert r.status_code == 422 and "budget" in r.json["fields"]
    r = client.post("/api/challenges", json={**base, "funded": "yes", "budget": "-5"}, headers=rep)
    assert r.status_code == 422 and "budget" in r.json["fields"]
    r = client.post("/api/challenges", json={**base, "funded": "yes", "budget": "R 25 000"}, headers=rep)
    assert r.status_code == 201 and r.json["challenge"]["budget"] == 25000
    assert client.post("/api/challenges", json={**base, "funded": "no"}, headers=rep).status_code == 201
    # supervisors: funding is required too, and "yes" needs a budget
    r = client.post("/api/challenges", json=base, headers=sup)
    assert r.status_code == 422 and "funded" in r.json["fields"]
    assert client.post("/api/challenges", json={**base, "funded": "no"}, headers=sup).status_code == 201
    r = client.post("/api/challenges", json={**base, "funded": "yes"}, headers=sup)
    assert r.status_code == 422 and "budget" in r.json["fields"]
    r = client.post("/api/challenges", json={**base, "funded": "yes", "budget": 1500.5}, headers=sup)
    assert r.status_code == 201 and r.json["challenge"]["budget"] == 1500.5
