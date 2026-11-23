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


def ensure_db(app):
    """Create (and optionally seed) the database the first time the app starts."""
    path = app.config["DATABASE"]
    if os.path.exists(path):
        return
    with app.app_context():
        init_db()
        if app.config.get("SEED_DEMO_DATA"):
            from .seed import seed
            seed()


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
    click.echo("Database recreated with demo data. Demo password for every account: Demo@1234")


def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
    app.cli.add_command(seed_command)
