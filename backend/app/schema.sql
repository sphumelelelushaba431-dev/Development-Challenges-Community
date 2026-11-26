-- Development Challenges Community — database schema (SQLite)
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS activity;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS progress_updates;
DROP TABLE IF EXISTS challenge_students;
DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  member_no     TEXT    NOT NULL UNIQUE,            -- DCC00001
  role          TEXT    NOT NULL CHECK (role IN ('student','supervisor','representative')),
  title         TEXT    NOT NULL DEFAULT '',
  first_name    TEXT    NOT NULL,
  surname       TEXT    NOT NULL,
  gender        TEXT    NOT NULL DEFAULT '',
  id_number     TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  email         TEXT    NOT NULL UNIQUE,
  organisation  TEXT    NOT NULL DEFAULT '',
  interest      TEXT    NOT NULL DEFAULT '',          -- registered Area of Interest
  expertise     TEXT    NOT NULL DEFAULT '[]',        -- JSON list of areas (supervisors; students: interests)
  address       TEXT    NOT NULL DEFAULT '',
  photo         TEXT,
  password_hash TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','locked')),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  available     INTEGER NOT NULL DEFAULT 1,
  record        REAL    NOT NULL DEFAULT 0.8,         -- track record 0–1 (MCDA criterion)
  terms_at      TEXT,
  joined_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  locked_at     TEXT
);

CREATE TABLE challenges (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    UNIQUE,                     -- DCC-000001 (set after insert)
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  priority        TEXT    NOT NULL DEFAULT 'Medium',
  due_date        TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'Submitted',
  funded          TEXT    NOT NULL DEFAULT 'none' CHECK (funded IN ('yes','no','none')),
  submitted_by    INTEGER NOT NULL REFERENCES users(id),
  supervisor_id   INTEGER REFERENCES users(id),
  areas           TEXT    NOT NULL DEFAULT '[]',     -- JSON [{area, score}] from keyword extraction
  keywords        TEXT    NOT NULL DEFAULT '[]',     -- JSON [{term, weight, kind}]
  match_outcome   TEXT,                               -- recommended | flagged
  progress        INTEGER NOT NULL DEFAULT 0,
  info_request    TEXT,
  decision_note   TEXT,
  summary         TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  approved_at     TEXT,
  allocated_at    TEXT,
  completed_at    TEXT
);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenges_supervisor ON challenges(supervisor_id);

CREATE TABLE challenge_students (
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES users(id),
  assigned_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (challenge_id, student_id)
);

CREATE TABLE progress_updates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  pct          INTEGER NOT NULL,
  note         TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE meetings (                               -- venue stores the mode: Online | In person
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  supervisor_id INTEGER NOT NULL REFERENCES users(id),
  challenge_id  INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,
  venue         TEXT    NOT NULL,
  date          TEXT    NOT NULL,                    -- YYYY-MM-DD
  start         TEXT    NOT NULL,                    -- HH:MM
  minutes       INTEGER NOT NULL,
  people        TEXT    NOT NULL DEFAULT '[]',       -- JSON list of names
  agenda        TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,                       -- message | alert | update | assign | meeting
  sender     TEXT    NOT NULL,
  about      TEXT    NOT NULL DEFAULT '',
  text       TEXT    NOT NULL,
  ref        TEXT    NOT NULL DEFAULT '',            -- e.g. challenge code or meeting id
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- One row per sign-in: how long each member used the system
CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT    NOT NULL DEFAULT (datetime('now')),
  ended_at   TEXT,
  end_reason TEXT,                                   -- logout | password | locked
  ip         TEXT    NOT NULL DEFAULT '',
  agent      TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Audit log: what was done, by whom, when and (where it applies) how long it took
CREATE TABLE activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  who        TEXT    NOT NULL,
  text       TEXT    NOT NULL,
  kind       TEXT    NOT NULL DEFAULT 'info',        -- ok | bad | warn | info
  action     TEXT    NOT NULL DEFAULT '',            -- e.g. auth.login, challenge.submit
  actor_id   INTEGER,
  actor_no   TEXT    NOT NULL DEFAULT '',
  actor_role TEXT    NOT NULL DEFAULT '',
  session_id INTEGER,
  duration   INTEGER,                                -- seconds
  ip         TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_actor ON activity(actor_id);
