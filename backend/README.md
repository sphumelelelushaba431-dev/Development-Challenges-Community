# DCC backend — Flask REST API

Python 3.10+ and Flask only. It uses SQLite through Python's standard library, and the tokens use `itsdangerous`, which comes with Flask.

```
pip install -r requirements.txt
python run.py                      # http://127.0.0.1:5000 — creates instance/dcc.sqlite3 with demo data on first run
flask --app run seed               # recreate the database with demo data
flask --app run init-db            # recreate it empty
pip install pytest && python -m pytest -q     # 18 tests
```

## Structure
```
backend/
├── run.py                 entry point
├── requirements.txt
├── app/
│   ├── __init__.py        app factory, CORS, blueprints, AHP weights at start-up
│   ├── config.py          settings (environment variables override them)
│   ├── schema.sql         tables: users, challenges, challenge_students, progress_updates, documents,
│   │                      requests, meetings, notifications, activity
│   ├── db.py              SQLite helpers and CLI commands
│   ├── auth.py            Bearer tokens, role checks
│   ├── errors.py          JSON errors
│   ├── validators.py      SA ID (Luhn), international phone, e-mail, password rules
│   ├── services.py        capacity, classification, matching, notifications, activity log
│   ├── mcda.py            AHP weights · WSM score · TOPSIS ranking
│   ├── nlp/
│   │   ├── taxonomy.py    the 10 Areas of Interest: keywords, related words, phrases, synonyms
│   │   ├── keywords.py    keyword extraction (normalise → synonyms → negation → stem → phrases + RAKE → TF-IDF weighting)
│   │   └── classify.py    Area of Interest by MCDA over 4 evidence criteria
│   ├── routes/            auth · challenges · requests · meetings · notifications · admin · dashboard (+ public)
│   └── seed.py            demo data
└── tests/                 API flow tests, keyword and MCDA tests
```

## Settings (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | change-this… | Signs the sign-in tokens. **Set it in production.** |
| `DATABASE` | `instance/dcc.sqlite3` | Database file |
| `UPLOAD_FOLDER` | `instance/uploads` | Uploaded documents and photos |
| `CORS_ORIGINS` | `*` | Front-end address(es), comma-separated |
| `TOKEN_MAX_AGE` | `28800` | Seconds a sign-in lasts |
| `REQUIRE_APPROVAL` | `true` | Keep new accounts pending until an administrator approves them |
| `SEED_DEMO_DATA` | `true` | Fill a new database with demo data |
| `HOST` / `PORT` | `127.0.0.1` / `5000` | Where the API listens |

The business rules live in `app/config.py`: supervisor cap 5, student cap 3, lab venues and hours, the MCDA AHP judgements, the threshold of 55 and the ranking method (`topsis` or `wsm`).

## API
Every route is under `/api`. Send `Authorization: Bearer <token>` except where the table says "public". Errors return `{"error": "...", "fields": {...}}`.

| Method & path | Who | What |
|---|---|---|
| `POST /auth/register` | public | Register. The form fields match the registration page; a JPG/PNG photo is optional (multipart, up to 2 MB). The account starts as pending |
| `POST /auth/login` | public | `{member_id, password}` → `{token, user, home}`. The account locks after 3 failed attempts |
| `POST /auth/forgot-password` · `POST /auth/reset-password` | public | Reset token, valid for 30 minutes |
| `GET/PUT /me` · `POST /me/password` | any | Profile and password. `PUT /me` accepts `phone_country` as an ISO country code and accepts profile photos as multipart form data (JPG/PNG, up to 2 MB) |
| `GET /photos/{filename}` | public | Retrieve an uploaded profile photo |
| `GET /dashboard/{student,supervisor,representative,admin}` | that role | Everything the dashboard shows |
| `GET /public/overview` | public | Visitors' dashboard data |
| `POST /challenges` | representative, supervisor | Submit (title, description, due_date, priority; representatives must also send `funded` yes/no; files optional) |
| `GET /challenges` · `GET /challenges/{code}` | involved | Lists and details (details include the extracted keywords and areas) |
| `POST /challenges/{code}/open` · `/review` | supervisor | `review {action: approve, request_info or reject, comment}` |
| `POST /challenges/{code}/respond` | representative | Answer an information request (files optional) |
| `GET /challenges/{code}/matches` | supervisor | MCDA ranking of students (WSM score, TOPSIS closeness, recommended) |
| `POST /challenges/{code}/allocate` | supervisor | `{student, reason}`. A reason is needed if the student is not one of the recommended ones |
| `POST /challenges/{code}/decide` | supervisor | No match found: `{action: reject, keep or further_review, note}` |
| `POST /challenges/{code}/progress` · `/submit-work` | student | Progress `{pct, note}` and submit completed work |
| `POST /challenges/{code}/verify` | supervisor | `{action: approve or return, feedback}` |
| `POST /challenges/{code}/documents` · `GET …/documents/{id}` | involved | Upload and download |
| `POST /requests` · `GET /requests` | student, supervisor | Ask to work on an open challenge, or list requests |
| `POST /requests/{id}/accept` · `/decline` | supervisor | Decline needs `{note}` |
| `GET /meetings` · `POST /meetings` · `DELETE /meetings/{id}` | supervisor | In-person lab meetings. Clash, weekday and hours checks |
| `GET /notifications` · `POST /notifications/read-all` · `POST /notifications/{id}/read` · `POST /messages` | any | Notifications and replies |
| `GET /admin/users` · `POST /admin/users/{no}/approve`, `/reject` or `/unlock` · `GET /admin/activity` · `GET /admin/mcda` | admin | Administration |
| `GET /health` | public | Health check |

## Challenge statuses
```
Submitted → Under Review → Unallocated (approved; students ranked) → Allocated → In Progress → Pending Verification → Completed
                         ↘ Pending Information → (representative answers) → Submitted
                         ↘ Rejected
Approved = approved but the supervisor is at 5 open challenges   ·   Interest Review = no student match, sent for review
```
