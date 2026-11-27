"""SQLite access (standard library only)."""
import json
import os
import sqlite3
from datetime import datetime, timezone

import click
from flask import current_app, g


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"], detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query(sql, args=(), one=False):
    cur = get_db().execute(sql, args)
    rows = cur.fetchall()
    cur.close()
    return (rows[0] if rows else None) if one else rows


def execute(sql, args=()):
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur.lastrowid


def now():
    """UTC timestamp in SQLite's text format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def jload(value, default=None):
    try:
        return json.loads(value) if value else (default if default is not None else [])
    except (TypeError, ValueError):
        return default if default is not None else []


def jdump(value):
    return json.dumps(value, ensure_ascii=False)


def init_db():
    os.makedirs(os.path.dirname(current_app.config["DATABASE"]), exist_ok=True)
    with current_app.open_resource("schema.sql") as f:
        get_db().executescript(f.read().decode("utf8"))


_ACTIVITY_COLUMNS = {
    "action": "TEXT NOT NULL DEFAULT ''", "actor_id": "INTEGER", "actor_no": "TEXT NOT NULL DEFAULT ''",
    "actor_role": "TEXT NOT NULL DEFAULT ''", "session_id": "INTEGER", "duration": "INTEGER", "ip": "TEXT NOT NULL DEFAULT ''",
}


def migrate():
    """Bring a database made by an older version up to date (adds the audit-log columns and the sessions table)."""
    db = get_db()
    db.executescript("""CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT, end_reason TEXT, ip TEXT NOT NULL DEFAULT '', agent TEXT NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);""")
    have = {r["name"] for r in db.execute("PRAGMA table_info(activity)").fetchall()}
    for name, decl in _ACTIVITY_COLUMNS.items():
        if name not in have:
            db.execute("ALTER TABLE activity ADD COLUMN %s %s" % (name, decl))
    db.execute("CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity(actor_id)")
    db.commit()


def ensure_db(app):
    """Create (and optionally seed) the database the first time the app starts; upgrade an existing one."""
    path = app.config["DATABASE"]
    if os.path.exists(path):
        with app.app_context():
            migrate()
            ensure_admin()
        return
    with app.app_context():
        init_db()
        if app.config.get("SEED_DEMO_DATA"):
            from .seed import seed
            seed()


def ensure_admin():
    """Older databases had no Administrator role: allow it and create the system administrator (DCC00000)."""
    from werkzeug.security import generate_password_hash
    db = get_db()
    ddl = query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'", one=True)
    if not ddl:
        return
    if "'admin'" not in ddl["sql"]:
        db.execute("PRAGMA foreign_keys = OFF")
        db.executescript("BEGIN;" + ddl["sql"].replace("CREATE TABLE users", "CREATE TABLE users_new", 1)
                         .replace("'representative')", "'representative','admin')", 1) +
                         ";INSERT INTO users_new SELECT * FROM users; DROP TABLE users; ALTER TABLE users_new RENAME TO users; COMMIT;")
        db.execute("PRAGMA foreign_keys = ON")
    if not any(c["name"] == "budget" for c in query("PRAGMA table_info(challenges)")):
        execute("ALTER TABLE challenges ADD COLUMN budget REAL")
    if not query("SELECT 1 FROM users WHERE role = 'admin'", one=True):
        if query("SELECT 1 FROM users WHERE lower(email) = 'admin@devchallenges.community'", one=True):
            execute("UPDATE users SET email = 'n.mkhize@devchallenges.community' WHERE lower(email) = 'admin@devchallenges.community'")
        execute("""INSERT INTO users (member_no, role, first_name, surname, email, phone, organisation, password_hash, status, available, record, terms_at)
                   VALUES ('DCC00000', 'admin', 'System', 'Administrator', 'admin@devchallenges.community', '0359026001',
                           'Development Challenges Community', ?, 'active', 0, 0, ?)""",
                (generate_password_hash(current_app.config["ADMIN_PASSWORD"]), now()))
        execute("INSERT INTO activity (who, text, kind) VALUES ('System', 'created the system Administrator account DCC00000.', 'info')")


@click.command("init-db")
def init_db_command():
    """Drop all tables and create them again (empty)."""
    init_db()
    click.echo("Database initialised (empty).")


@click.command("seed")
def seed_command():
    """Recreate the database with demo data."""
    from .seed import seed
    init_db()
    seed()
    click.echo("Database recreated with demo data. Administrator: DCC00000 / %s. Every other demo account: Demo@1234" % current_app.config["ADMIN_PASSWORD"])


def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(seed_command)
