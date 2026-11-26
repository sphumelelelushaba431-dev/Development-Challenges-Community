"""Demo data that matches the front-end screens. Every demo account's password is Demo@1234."""
from datetime import date, datetime, timedelta, timezone

from werkzeug.security import generate_password_hash

from .db import execute, jdump, query
from .services import classify_text, set_code, store_areas

PASSWORD = "Demo@1234"


def ts(days):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


def day(days):
    return (date.today() + timedelta(days=days)).isoformat()


def workday(n):
    d, left = date.today(), n
    while left:
        d += timedelta(days=1)
        if d.weekday() < 5:
            left -= 1
    return d.isoformat()


USERS = [
    # member_no, role, title, first, surname, gender, email, phone, org, areas, status, available, record, joined (days ago)
    ("DCC00001", "supervisor", "Ms", "Nokuthula", "Mkhize", "Female", "admin@devchallenges.community", "0359026000", "Development Challenges Community", ["Research", "Health & Community Wellbeing"], "active", 1, 0.9, 540),
    ("DCC00002", "student", "Ms", "Amahle", "Mthembu", "Female", "amahle.mthembu@unizulu.ac.za", "0712345678", "University of Zululand", ["Design, Media & Communication", "Data Science & Machine Learning"], "active", 1, 0.9, 280),
    ("DCC00003", "representative", "Ms", "Sbongokuhle", "Msomi", "Female", "sbongokuhle@betmedia.co.za", "0731112233", "BET Media", [], "active", 1, 0.8, 300),
    ("DCC00004", "student", "Mr", "Lwazi", "Dube", "Male", "lwazi.dube@unizulu.ac.za", "0724445566", "University of Zululand", ["Software & Web Development", "Internet of Things & Embedded Systems"], "active", 1, 0.7, 250),
    ("DCC00005", "student", "Mr", "Thando", "Khumalo", "Male", "thando.khumalo@unizulu.ac.za", "0765557788", "University of Zululand", ["Environmental Systems & Water", "Renewable Energy & Sustainability", "Research"], "active", 1, 0.8, 240),
    ("DCC00006", "student", "Mr", "Ayanda", "Zulu", "Male", "ayanda.zulu@mut.ac.za", "0789990011", "Mangosuthu University of Technology", ["Software & Web Development", "Education & Skills Development"], "active", 0, 0.6, 200),
    ("DCC00007", "student", "Ms", "Nosipho", "Cele", "Female", "nosipho.cele@unizulu.ac.za", "0612223344", "University of Zululand", ["Health & Community Wellbeing", "Research"], "active", 0, 0.85, 190),
    ("DCC00008", "representative", "Mr", "Sizwe", "Mthethwa", "Male", "sizwe@umhlathuze.gov.za", "0823334455", "uMhlathuze Municipality", [], "active", 1, 0.8, 330),
    ("DCC00009", "representative", "Ms", "Palesa", "Molefe", "Female", "palesa@rbct.org.za", "0834445566", "Richards Bay Clinic Trust", [], "active", 1, 0.8, 320),
    ("DCC00010", "representative", "Mr", "Kagiso", "Nkosi", "Male", "kagiso@unizulu.ac.za", "0845556677", "University of Zululand", [], "active", 1, 0.8, 330),
    ("DCC00011", "supervisor", "Dr", "Sipho", "Ndlovu", "Male", "s.ndlovu@unizulu.ac.za", "0823456789", "University of Zululand", ["Data Science & Machine Learning", "Software & Web Development"], "active", 1, 0.9, 470),
    ("DCC00012", "supervisor", "Prof", "Anika", "Pillay", "Female", "a.pillay@unizulu.ac.za", "0826667788", "University of Zululand", ["Health & Community Wellbeing", "Research"], "active", 1, 0.85, 460),
    ("DCC00013", "supervisor", "Dr", "Lindiwe", "Mabaso", "Female", "l.mabaso@unizulu.ac.za", "0827778899", "University of Zululand", ["Design, Media & Communication", "Education & Skills Development"], "active", 1, 0.8, 400),
    ("DCC00014", "supervisor", "Mr", "Themba", "Shezi", "Male", "t.shezi@mut.ac.za", "0828889900", "Mangosuthu University of Technology", ["Software & Web Development", "Internet of Things & Embedded Systems"], "active", 1, 0.75, 380),
    ("DCC00015", "supervisor", "Prof", "Kavitha", "Naidoo", "Female", "k.naidoo@unizulu.ac.za", "0829990011", "University of Zululand", ["Environmental Systems & Water", "Renewable Energy & Sustainability"], "active", 1, 0.8, 420),
    ("DCC00016", "supervisor", "Mr", "Bongani", "Sithole", "Male", "bongani@betmedia.co.za", "0820001122", "BET Media", ["Entrepreneurship & Small Business Support", "Research"], "active", 1, 0.8, 410),
    ("DCC00020", "representative", "Ms", "Zanele", "Ngcobo", "Female", "z.ngcobo@umhlathuze.gov.za", "0831230000", "uMhlathuze Municipality", [], "pending", 1, 0.8, 2),
    ("DCC00021", "supervisor", "Dr", "Mandla", "Zungu", "Male", "m.zungu@unizulu.ac.za", "0831231111", "University of Zululand", ["Research"], "pending", 1, 0.8, 0),
    ("DCC00022", "student", "Mr", "Sifiso", "Gumede", "Male", "sifiso.gumede@unizulu.ac.za", "0711239999", "University of Zululand", ["Research"], "locked", 1, 0.7, 120),
]

# title, description, submitted_by, supervisor, status, funded, due (days from now), created (days ago), team, progress, completed (days ago), summary
CHALLENGES = [
    ("Expansion of knowledge through communication", "Design a media campaign with podcasts and posters that grows awareness of community programmes among young people.", "DCC00003", "DCC00011", "In Progress", "yes", 24, 70, ["DCC00002"], 45, None, None),
    ("Cafeteria food-waste reduction study", "Measure plate waste in the cafeteria and test portion and menu changes that reduce food waste.", "DCC00010", "DCC00011", "In Progress", "yes", 3, 60, ["DCC00005"], 85, None, None),
    ("Student dropout early-warning dashboard", "First-year attrition is high. Combine LMS activity, attendance and assessment data into a dashboard that flags students at risk using machine learning.", "DCC00010", "DCC00011", "Unallocated", "yes", 50, 40, [], 0, None, None),
    ("Township storytelling and publicity drive", "Local artists want help with storytelling, social media content and publicity for a township heritage festival.", "DCC00003", "DCC00011", "Unallocated", "yes", 62, 35, [], 0, None, None),
    ("Reduce queues at the campus clinic", "Patients wait hours at the campus clinic without updates; nurses want a calmer waiting room.", "DCC00009", "DCC00011", "Unallocated", "no", 29, 30, [], 0, None, None),
    ("Automated timetable clash detection", "Timetable clashes are found too late. Build a software tool that detects lecture and venue clashes automatically.", "DCC00010", "DCC00011", "Submitted", "yes", 60, 2, [], 0, None, None),
    ("Phishing awareness training portal", "Design a self-paced awareness portal with simulated phishing examples for staff.", "DCC00003", "DCC00011", "Under Review", "no", 45, 6, [], 0, None, None),
    ("Alumni mentorship matching app", "Build a mobile app that matches final-year students with alumni mentors by career interest.", "DCC00010", "DCC00011", "Approved", "yes", 70, 12, [], 0, None, None),
    ("Solar-powered phone charging kiosk", "Traders at the taxi rank need to charge phones during load shedding. Build a kiosk powered by solar panels.", "DCC00008", "DCC00011", "Completed", "yes", -20, 250, ["DCC00005"], 100, 140,
     "A kiosk with four charging bays powered by a 200 W panel, now running at the taxi rank."),
    ("Postgraduate research data repository", "Create a searchable repository with consistent metadata for postgraduate research datasets.", "DCC00010", "DCC00012", "Completed", "no", -45, 260, ["DCC00002"], 100, 160,
     "A searchable repository with consistent metadata for 320 postgraduate datasets."),
    ("Campus recycling initiative", "Set up recycling sorting stations and a weekly collection route for the residences to reduce waste.", "DCC00010", "DCC00015", "Completed", "yes", -10, 120, ["DCC00005"], 100, 12,
     "Sorting stations and a weekly collection route for four residences. Recycled volume rose from 0.4 to 1.6 tonnes a month."),
    ("Exam venue capacity optimiser", "Build a scheduling model that optimises exam venue use without clashes.", "DCC00010", "DCC00014", "Completed", "no", -60, 300, ["DCC00004"], 100, 175,
     "A scheduling model that fits exam sessions into 18% fewer venues without clashes."),
    ("Small-business bookkeeping workshops", "Informal traders and spaza shops struggle to track money; run bookkeeping and cash flow workshops.", "DCC00003", "DCC00016", "Completed", "yes", -40, 280, ["DCC00006"], 100, 170,
     "Six workshops for 48 informal traders, with a simple cash-book template in isiZulu and English."),
    ("Community radio podcast series", "Produce a podcast series with the local community radio station about youth opportunities.", "DCC00003", "DCC00013", "Unallocated", "yes", 70, 20, [], 0, None, None),
    ("Water-leak detection for residences", "Prototype flow sensors that alert maintenance teams to water leaks in residences.", "DCC00010", "DCC00015", "In Progress", "no", 55, 90, ["DCC00004"], 30, None, None),
    ("Campus Wi-Fi dead-zone mapping", "Survey Wi-Fi signal strength across campus and recommend access-point placement.", "DCC00010", "DCC00014", "Unallocated", "yes", 35, 25, [], 0, None, None),
    ("Community health-literacy workshops", "Run health literacy workshops with the clinic for community members.", "DCC00003", "DCC00012", "Pending Information", "no", 30, 8, [], 0, None, None),
    ("Rooftop solar feasibility study", "Assess the feasibility of rooftop solar power for the library building.", "DCC00008", "DCC00015", "Submitted", "yes", 80, 1, [], 0, None, None),
]


def seed():
    ids = {}
    for (no, role, title, first, last, gender, email, phone, org, areas, status, avail, rec, joined) in USERS:
        ids[no] = execute("""INSERT INTO users (member_no, role, title, first_name, surname, gender, id_number, phone, email, organisation, interest, expertise,
                             address, password_hash, status, available, record, joined_at, failed_logins, locked_at, terms_at)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                          (no, role, title, first, last, gender, "9001015009086", phone, email, org, areas[0] if areas else "", jdump(areas),
                           "University Road, KwaDlangezwa, 3886", generate_password_hash(PASSWORD), status, avail, rec, ts(-joined),
                           3 if status == "locked" else 0, ts(-1) if status == "locked" else None, ts(-joined)))
    codes = {}
    for (title, desc, by, sup, status, funded, due, created, team, pct, done, summary) in CHALLENGES:
        cid = execute("""INSERT INTO challenges (title, description, due_date, status, funded, submitted_by, supervisor_id, progress, created_at,
                         approved_at, allocated_at, completed_at, summary, info_request) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                      (title, desc, day(due), status, funded, ids[by], ids[sup], pct, ts(-created),
                       ts(-created + 2) if status not in ("Submitted", "Under Review", "Pending Information") else None,
                       ts(-created + 5) if team else None, ts(-done) if done is not None else None, summary,
                       "Please attach the partner clinic letters and expected attendance numbers." if status == "Pending Information" else None))
        codes[title] = set_code(cid)
        store_areas(cid, classify_text(title, desc))
        for s in team:
            execute("INSERT INTO challenge_students (challenge_id, student_id, assigned_at) VALUES (?,?,?)", (cid, ids[s], ts(-created + 5)))
        if pct and status == "In Progress":
            for i, p in enumerate(range(10, pct + 1, 15)):
                execute("INSERT INTO progress_updates (challenge_id, user_id, pct, note, created_at) VALUES (?,?,?,?,?)",
                        (cid, ids[team[0]], p, "Work update %d." % (i + 1), ts(-created + 10 + 7 * i)))

    c = lambda t: query("SELECT id FROM challenges WHERE title = ?", (t,), one=True)["id"]

    def meeting(title, challenge, mode, day, start, mins, agenda=""):
        cid = c(challenge)
        ch = query("SELECT * FROM challenges WHERE id = ?", (cid,), one=True)
        people, seen = [], set()
        for uid in [x["student_id"] for x in query("SELECT student_id FROM challenge_students WHERE challenge_id = ?", (cid,))] + [ch["submitted_by"], ch["supervisor_id"]]:
            if uid and uid not in seen:
                seen.add(uid)
                people.append(query("SELECT member_no FROM users WHERE id = ?", (uid,), one=True)["member_no"])
        execute("INSERT INTO meetings (supervisor_id, challenge_id, title, venue, date, start, minutes, people, agenda) VALUES (?,?,?,?,?,?,?,?,?)",
                (ch["supervisor_id"], cid, title, mode, day, start, mins, jdump(people), agenda))

    meeting("Progress review", "Expansion of knowledge through communication", "Online", workday(1), "10:00", 60, "Audience numbers and next milestones.")
    meeting("Final walkthrough", "Cafeteria food-waste reduction study", "In person", workday(2), "14:00", 60, "")

    note = lambda who, kind, sender, text, about="", ago=0, ref="": execute(
        "INSERT INTO notifications (user_id, kind, sender, about, text, ref, created_at) VALUES (?,?,?,?,?,?,?)", (ids[who], kind, sender, text, about, ref or about, ts(-ago)))
    note("DCC00011", "update", "Mr Thando Khumalo", "Progress on “Cafeteria food-waste reduction study” reached 85%.", codes["Cafeteria food-waste reduction study"])
    note("DCC00011", "message", "Ms Sbongokuhle Msomi", "Thank you for the update — the audience numbers will follow next week.", codes["Expansion of knowledge through communication"], 2)
    note("DCC00002", "meeting", "Dr Sipho Ndlovu", "Meeting: Progress review · %s 10:00 · Online." % workday(1), codes["Expansion of knowledge through communication"], ref="M-1")
    note("DCC00002", "message", "Dr Sipho Ndlovu", "Good progress — please include audience numbers in the next update.", codes["Expansion of knowledge through communication"], 2)
    note("DCC00003", "alert", "Prof Anika Pillay", "More details needed for “Community health-literacy workshops”.", codes["Community health-literacy workshops"], 1)
    note("DCC00003", "message", "Dr Sipho Ndlovu", "The storytelling challenge is approved; we are matching students now.", codes["Township storytelling and publicity drive"], 3)
    note("DCC00001", "alert", "Dr Mandla Zungu", "New supervisor registration waiting for approval.", "DCC00021")

    roles = {r["member_no"]: r["role"] for r in query("SELECT member_no, role FROM users")}
    for who, no, text, kind, action, ago in (
            ("Dr Mandla Zungu", "DCC00021", "registered as a Supervisor — awaiting approval.", "warn", "auth.register", 0),
            ("Prof Kavitha Naidoo", "DCC00015", "completed %s at 100%%." % codes["Campus recycling initiative"], "ok", "challenge.complete", 12),
            ("System", "DCC00022", "3 failed login attempts for DCC00022 — account locked.", "bad", "account.locked", 1),
            ("Mr Kagiso Nkosi", "DCC00010", "submitted %s “Automated timetable clash detection”." % codes["Automated timetable clash detection"], "info", "challenge.submit", 2)):
        execute("INSERT INTO activity (who, text, kind, action, actor_id, actor_no, actor_role, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (who, text, kind, action, ids.get(no), no, roles.get(no, ""), ts(-ago)))

    # A few past sign-ins so the Audit log shows how long members used the system
    names = {r["member_no"]: r for r in query("SELECT * FROM users")}
    for no, ago, minutes in (("DCC00011", 3, 42), ("DCC00002", 2, 27), ("DCC00003", 2, 15), ("DCC00002", 1, 53), ("DCC00001", 1, 18)):
        start = datetime.now(timezone.utc) - timedelta(days=ago, hours=2)
        end = start + timedelta(minutes=minutes)
        f = lambda t: t.strftime("%Y-%m-%d %H:%M:%S")
        sid = execute("INSERT INTO sessions (user_id, started_at, last_seen, ended_at, end_reason, ip) VALUES (?,?,?,?,?,?)",
                      (ids[no], f(start), f(end), f(end), "logout", "127.0.0.1"))
        u = names[no]
        who = (u["title"] + " " if u["title"] else "") + u["first_name"] + " " + u["surname"]
        for text, action, at, dur in (("signed in.", "auth.login", start, None), ("signed out.", "auth.logout", end, minutes * 60)):
            execute("""INSERT INTO activity (who, text, kind, action, actor_id, actor_no, actor_role, session_id, duration, ip, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""", (who, text, "info", action, ids[no], no, u["role"], sid, dur, "127.0.0.1", f(at)))
