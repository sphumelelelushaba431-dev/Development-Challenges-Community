# Development Challenges Community — Challenge Management System

Organisations submit real development challenges; supervisors review them; student teams are matched to them with an **MCDA (Multi-Criteria Decision Analysis)** model and solve them under supervision.

```
dcc-system/
├── frontend/   the web app — HTML, CSS and JavaScript only (static files)
└── backend/    the REST API — Python Flask + SQLite
```
The two run separately. The front end talks to the backend over HTTP (JSON) with a sign-in token.

## Quick start (two terminals)

**1. Backend** (Python 3.10+)
```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python run.py                   # → http://127.0.0.1:5000  (creates and fills the database on first run)
```

**2. Front end**
```
cd frontend
python -m http.server 3000      # or: npx serve -l 3000 .
```
Open **http://localhost:3000**.

The front end finds the backend through `frontend/js/config.js` (`apiBase: 'http://127.0.0.1:5000/api'`). If the backend runs somewhere else, change that line.

## Demo accounts
**Administrator:** Member no. **`DCC00000`**, password **`Admin@2026`** (change it with the `ADMIN_PASSWORD` environment variable before the database is created, or under Settings after signing in). Only the administrator can approve, decline or unlock user accounts and open the **Audit log**.

The password for every other account is **`Demo@1234`**.

| Member no. | Name | Role |
|---|---|---|
| DCC00000 | System Administrator | Administrator (user accounts + audit log) |
| DCC00001 | Ms Nokuthula Mkhize | Supervisor |
| DCC00002 | Ms Amahle Mthembu | Student |
| DCC00003 | Ms Sbongokuhle Msomi | Representative (BET Media) |
| DCC00011 | Dr Sipho Ndlovu | Supervisor (already at the 5-challenge limit) |
| DCC00012–16 | Other supervisors | Supervisor |
| DCC00004–07 | Other students | Student |
| DCC00008–10 | Other representatives | Representative |
| DCC00020, DCC00021 | Waiting for approval | — |
| DCC00022 | Locked after 3 failed logins | — |

New registrations stay **pending** until an administrator approves them. To start again with fresh demo data:
```
cd backend
flask --app run seed
```

## How the model works

**1. Keyword extraction** (`backend/app/nlp/keywords.py`)

The representative only writes a title and description; there is no category field. The text goes through a hybrid pipeline:
- **Knowledge-based:** text normalisation, US→UK spelling, a synonym map, negation ("not a software project"), stemming, and a list of known domain phrases.
- **Statistical:** TF-IDF, with the IDF learned from every challenge in the database, plus YAKE-style position and spread features.
- **Phrase method:** RAKE (Rapid Automatic Keyword Extraction).

**2. Area of Interest** (`backend/app/nlp/classify.py`)

An MCDA weighted-sum decision over four criteria for each of the 10 areas:

| Criterion | Weight |
|---|---|
| Phrase evidence | 0.35 |
| Keyword evidence | 0.30 |
| Related words | 0.15 |
| TF-IDF cosine similarity | 0.20 |

The match is found in stages: exact → related → similar meaning → no match.

**3. Matching people** (`backend/app/mcda.py`)

| Criterion | Weight |
|---|---|
| Interest alignment | 0.49 |
| Free capacity | 0.25 |
| Availability | 0.16 |
| Track record | 0.10 |

- **AHP** sets the criterion weights from pairwise judgements (consistency ratio 0.015, below the 0.10 limit).
- **WSM** (weighted sum, 0–100) gives the pass mark: 55 or more is recommended.
- **TOPSIS** gives the ranking order.
- The same model assigns each new challenge to a supervisor with matching expertise (at most 5 open challenges each) and recommends students (at most 3 active challenges each). If nobody qualifies, the challenge is flagged for the supervisor's decision.

All weights, thresholds and limits are in `backend/app/config.py`. `GET /api/admin/mcda` shows the values in use.

## Main features
- **Home:** Register, Login and the public dashboard. The public dashboard has impact metrics, a progress strip, previous solutions, submissions by area and a date-range calendar.
- **Registration:** Terms and Conditions + POPIA consent step, SA ID / phone / password checks, and administrator approval.
- **Representative:** submits challenges (the funding question is required), answers "Supervisors Attention" requests, and follows Progress Tracking.
- **Supervisor:**
  - reviews challenges (approve / request information / reject)
  - allocates the recommended students
  - decides on unmatched challenges
  - accepts or declines student requests
  - verifies completed work
  - books in-person meetings in labs DC-001 to DC-004 (no double bookings, weekdays 08:00–17:00)
  - submits challenges (no funding question)
- **Student:** requests recommended challenges, updates progress and submits completed work.
- **Administrator (only):** approves or rejects accounts, unlocks locked accounts, sees every member, and reads the **Audit log** (search and filter every recorded action). Supervisors, representatives and students cannot manage user accounts.
- **Everyone:** notifications and messages, profile, settings and password change.

More detail: `backend/README.md` (API and tests) and `frontend/README.md` (pages and configuration).

## Before going live
- Set a strong `SECRET_KEY` and restrict `CORS_ORIGINS` to your front-end address (environment variables).
- Serve the API with a production server (for example `gunicorn "run:app"` on Linux, or `waitress-serve --call app:create_app` on Windows) behind HTTPS.
- Send the password-reset link by e-mail. The API creates the token; e-mail sending is not included.
- Replace `frontend/images/home-bg.jpg` with a licensed photo. The supplied one has watermarks.
