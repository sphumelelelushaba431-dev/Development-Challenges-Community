from datetime import date, timedelta
from io import BytesIO


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


def test_auth_required(client):
    assert client.get("/api/dashboard/student").status_code == 401


def test_register_approve_login(client, login):
    body = dict(role="student", title="Ms", gender="Female", first_name="Lerato", surname="Dlamini", id_number="9001015009086",
                phone="0712223333", phone_country="ZA", email="lerato@example.com", organisation="University of Zululand", area_of_interest="Research",
                address="1 Main Road, Empangeni, 3880", password="Strong@123", confirm_password="Strong@123", terms_accepted="yes", popia_consent="yes")
    bad = client.post("/api/auth/register", json={**body, "terms_accepted": "", "id_number": "123"})
    assert bad.status_code == 422 and "id_number" in bad.json["fields"] and "terms" in bad.json["fields"]
    bad_phone = client.post("/api/auth/register", json={**body, "phone_country": "ZZ"})
    assert bad_phone.status_code == 422 and "phone" in bad_phone.json["fields"]
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201
    no = r.json["member_no"]
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Strong@123"}).status_code == 403
    sup = login("DCC00001")
    assert client.post("/api/approvals/users/%s/approve" % no, headers=sup).status_code == 200
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Strong@123"}).status_code == 200


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
    client.post("/api/approvals/users/DCC00004/unlock", headers=login("DCC00001"))
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "Demo@1234"}).status_code == 200


def test_submit_auto_supervisor_auto_team_and_completion(client, login):
    rep = login("DCC00008")
    body = {"title": "Water leaks in council flats", "description": "Residents report water leaks; we need sensors that detect a water leak and alert plumbing teams.",
            "detail": "Place sensors at every riser and send an SMS to the plumbing team.", "due_date": future(),
            "priority": "Critical", "files": "ignored"}
    assert client.post("/api/challenges", json=body, headers=rep).status_code == 422          # funding answer required
    r = client.post("/api/challenges", json={**body, "funded": "yes"}, headers=rep)
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
                                             "due_date": future()}, headers=sup)
    assert r.status_code == 201
    ch = r.json["challenge"]
    assert ch["funded"] == "none" and ch["status"] == "Submitted" and ch["team"] == []
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


def test_meeting_invites_everyone_and_uses_modes(client, login):
    sup = login("DCC00011")
    code = next(c["id"] for c in client.get("/api/dashboard/supervisor", headers=sup).json["challenges"] if c["status"] == "In Progress")
    base = {"challenge": code, "title": "Check-in", "people": ["Not an invitee"], "date": next_weekday(3), "start": "11:00", "mins": 60, "mode": "Online"}
    r = client.post("/api/meetings", json=base, headers=sup)
    assert r.status_code == 201
    m = r.json["meeting"]
    assert m["mode"] == "Online" and len(m["people"]) >= 3
    assert "Dr Sipho Ndlovu" in m["people"] and "Not an invitee" not in m["people"]
    bad = client.post("/api/meetings", json={**base, "mode": "Lab DC-003"}, headers=sup)
    assert bad.status_code == 422 and "mode" in bad.json["fields"]
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
    assert client.get("/api/dashboard/admin", headers=sup).status_code == 404

    body = {"title": "A role test challenge for the community", "description": "A detailed description of this challenge for testing.",
            "due_date": future(), "funded": "yes"}
    assert client.post("/api/challenges", json=body, headers=stu).status_code == 403
    assert client.post("/api/challenges", json=body, headers=rep).status_code == 201
    assert client.post("/api/challenges", json={**body, "funded": "no"}, headers=sup).status_code == 201

    assert client.post("/api/challenges/DCC-000001/progress", json={"pct": 10, "note": "Started"}, headers=rep).status_code == 403
    assert client.post("/api/challenges/DCC-000001/review", json={"action": "approve"}, headers=stu).status_code == 403
    assert client.get("/api/approvals/users", headers=stu).status_code == 403
    assert client.get("/api/approvals/users", headers=rep).status_code == 403
    assert client.get("/api/approvals/users", headers=sup).status_code == 200

    assert client.get("/api/meetings", headers=stu).status_code == 200
    assert client.get("/api/meetings", headers=rep).status_code == 200
    assert client.get("/api/meetings", headers=sup).status_code == 200
    meeting = {"challenge": "DCC-000001", "title": "Role check", "date": next_weekday(5), "start": "11:00", "mins": 60, "mode": "Online"}
    assert client.post("/api/meetings", json=meeting, headers=stu).status_code == 403
    assert client.post("/api/meetings", json=meeting, headers=rep).status_code == 403
    assert client.post("/api/meetings", json=meeting, headers=sup).status_code == 422   # not this supervisor's challenge


def test_public_overview_has_no_personal_contact_details(client):
    data = client.get("/api/public/overview").json["challenges"]
    assert data and all("email" not in c and "phone" not in c for c in data)
