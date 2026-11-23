from datetime import date, timedelta


def future(days=40):
    return (date.today() + timedelta(days=days)).isoformat()


def next_weekday(n=3):
    d = date.today()
    while n:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d.isoformat()


def test_health_and_cors(client):
    r = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert r.json == {"status": "ok"} and r.headers["Access-Control-Allow-Origin"]


def test_auth_required(client):
    assert client.get("/api/dashboard/student").status_code == 401


def test_register_approve_login(client, login):
    body = dict(role="student", title="Ms", gender="Female", first_name="Lerato", surname="Dlamini", id_number="9001015009086",
                phone="0712223333", email="lerato@example.com", organisation="University of Zululand", area_of_interest="Research",
                address="1 Main Road, Empangeni, 3880", password="Strong@123", confirm_password="Strong@123", terms_accepted="yes", popia_consent="yes")
    bad = client.post("/api/auth/register", json={**body, "terms_accepted": "", "id_number": "123"})
    assert bad.status_code == 422 and "id_number" in bad.json["fields"] and "terms" in bad.json["fields"]
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 201
    no = r.json["member_no"]
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Strong@123"}).status_code == 403   # pending
    admin = login("DCC00001")
    assert client.post("/api/admin/users/%s/approve" % no, headers=admin).status_code == 200
    assert client.post("/api/auth/login", json={"member_id": no, "password": "Strong@123"}).status_code == 200


def test_lockout_and_unlock(client, login):
    for _ in range(2):
        assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "wrong"}).status_code == 403
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "Demo@1234"}).status_code == 403
    client.post("/api/admin/users/DCC00004/unlock", headers=login("DCC00001"))
    assert client.post("/api/auth/login", json={"member_id": "DCC00004", "password": "Demo@1234"}).status_code == 200


def test_full_challenge_flow(client, login):
    rep, sup = login("DCC00008"), None
    body = {"title": "Water leaks in council flats", "description": "Residents report water leaks; we need sensors that detect a water leak and alert plumbing teams.",
            "due_date": future(), "priority": "High"}
    assert client.post("/api/challenges", json=body, headers=rep).status_code == 422          # funding answer is required
    r = client.post("/api/challenges", json={**body, "funded": "yes"}, headers=rep)
    assert r.status_code == 201
    ch = r.json["challenge"]
    assert ch["status"] == "Submitted" and ch["funded"] is True
    assert ch["areas"][0]["area"] in ("Environmental Systems & Water", "Internet of Things & Embedded Systems")
    assert ch["supervisor"] in ("Prof Kavitha Naidoo", "Mr Themba Shezi")
    sup_no = {"Prof Kavitha Naidoo": "DCC00015", "Mr Themba Shezi": "DCC00014"}[ch["supervisor"]]
    sup = login(sup_no)
    code = ch["id"]
    assert client.post("/api/challenges/%s/review" % code, json={"action": "reject"}, headers=sup).status_code == 422   # reason needed
    assert client.post("/api/challenges/%s/review" % code, json={"action": "approve"}, headers=sup).json["challenge"]["status"] == "Unallocated"
    m = client.get("/api/challenges/%s/matches" % code, headers=sup).json
    pick = next(x for x in m["ranked"] if x["eligible"])
    r = client.post("/api/challenges/%s/allocate" % code, json={"student": pick["name"], "reason": "Best fit"}, headers=sup)
    assert r.status_code == 200, r.json
    stu_no = {"Mr Lwazi Dube": "DCC00004", "Mr Thando Khumalo": "DCC00005", "Ms Amahle Mthembu": "DCC00002"}[pick["name"]]
    stu = login(stu_no)
    assert client.post("/api/challenges/%s/progress" % code, json={"pct": 50, "note": "Sensors ordered"}, headers=stu).status_code == 200
    assert client.post("/api/challenges/%s/submit-work" % code, headers=stu).status_code == 200
    assert client.post("/api/challenges/%s/verify" % code, json={"action": "approve", "feedback": "Well done"}, headers=sup).status_code == 200
    assert client.get("/api/challenges/%s" % code, headers=rep).json["status"] == "Completed"
    notes = client.get("/api/notifications", headers=rep).json
    assert any("completed" in n["text"] for n in notes)


def test_supervisor_submit_without_funding_and_cap(client, login):
    sup = login("DCC00011")                                                     # Dr Ndlovu already has 5 open challenges
    r = client.post("/api/challenges", json={"title": "Lab equipment booking tool", "description": "Students need a simple online booking system for lab equipment.",
                                             "due_date": future()}, headers=sup)
    assert r.status_code == 201
    ch = r.json["challenge"]
    assert ch["funded"] == "none" and ch["status"] == "Submitted" and ch["supervisor"] != "Dr Sipho Ndlovu"


def test_info_request_cycle(client, login):
    rep, sup = login("DCC00003"), login("DCC00012")
    code = next(c["id"] for c in client.get("/api/challenges", headers=rep).json if c["status"] == "Pending Information")
    assert client.post("/api/challenges/%s/respond" % code, json={"response": "Letters attached; 120 people expected."}, headers=rep).status_code == 200
    assert client.get("/api/challenges/%s" % code, headers=sup).json["status"] == "Submitted"


def test_student_request_accept_and_decline(client, login):
    sup = login("DCC00011")
    reqs = client.get("/api/requests", headers=sup).json
    clinic = next(r for r in reqs if r["student"] == "Mr Lwazi Dube")
    other = next(r for r in reqs if r["student"] == "Mr Thando Khumalo")
    assert client.post("/api/requests/%d/decline" % other["rid"], json={}, headers=sup).status_code == 422
    assert client.post("/api/requests/%d/decline" % other["rid"], json={"note": "Team already chosen"}, headers=sup).status_code == 200
    assert client.post("/api/requests/%d/accept" % clinic["rid"], headers=sup).status_code == 200
    assert client.get("/api/challenges/%s" % clinic["id"], headers=sup).json["status"] == "Allocated"
    stu = login("DCC00004")
    assert any(n["kind"] == "assign" for n in client.get("/api/notifications", headers=stu).json)
    # a student can request an open challenge once
    open_code = next(a["id"] for a in client.get("/api/dashboard/student", headers=login("DCC00002")).json["available"])
    amahle = login("DCC00002")
    assert client.post("/api/requests", json={"challenge": open_code, "message": "Keen"}, headers=amahle).status_code == 201
    assert client.post("/api/requests", json={"challenge": open_code}, headers=amahle).status_code == 409


def test_meeting_rules(client, login):
    sup = login("DCC00011")
    code = next(c["id"] for c in client.get("/api/dashboard/supervisor", headers=sup).json["challenges"] if c["status"] == "In Progress")
    base = {"challenge": code, "title": "Check-in", "people": ["Ms Amahle Mthembu"], "date": next_weekday(3), "start": "11:00", "mins": 60, "venue": "Lab DC-003"}
    assert client.post("/api/meetings", json=base, headers=sup).status_code == 201
    clash = client.post("/api/meetings", json={**base, "start": "11:30"}, headers=sup)
    assert clash.status_code == 422 and "venue" in clash.json["fields"]
    late = client.post("/api/meetings", json={**base, "start": "16:30", "venue": "Lab DC-004"}, headers=sup)
    assert late.status_code == 422


def test_roles_are_enforced(client, login):
    stu = login("DCC00002")
    assert client.get("/api/dashboard/admin", headers=stu).status_code == 403
    assert client.post("/api/challenges", json={}, headers=stu).status_code == 403


def test_public_overview_has_no_personal_contact_details(client):
    data = client.get("/api/public/overview").json["challenges"]
    assert data and all("email" not in c and "phone" not in c for c in data)
