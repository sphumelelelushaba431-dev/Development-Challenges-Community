"""Settings. Every value can be overridden with an environment variable of the same name."""
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _env(name, default, cast=str):
    value = os.environ.get(name)
    if value is None:
        return default
    if cast is bool:
        return value.lower() in ("1", "true", "yes", "on")
    return cast(value)


class Config:
    SECRET_KEY = _env("SECRET_KEY", "change-this-secret-key-in-production")
    DATABASE = _env("DATABASE", os.path.join(BASE_DIR, "instance", "dcc.sqlite3"))
    UPLOAD_FOLDER = _env("UPLOAD_FOLDER", os.path.join(BASE_DIR, "instance", "uploads"))
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024            # 10 MB per request
    # The front end runs on its own origin (e.g. http://localhost:3000). Comma-separated list or "*".
    CORS_ORIGINS = _env("CORS_ORIGINS", "*")
    TOKEN_MAX_AGE = _env("TOKEN_MAX_AGE", 8 * 3600, int)    # seconds a sign-in lasts
    RESET_MAX_AGE = 30 * 60                                   # password-reset link: 30 minutes
    MAX_FAILED_LOGINS = 3                                     # then the account is locked
    SEED_DEMO_DATA = _env("SEED_DEMO_DATA", True, bool)       # seed demo data when the database is new
    HOST = _env("HOST", "127.0.0.1")
    PORT = _env("PORT", 5000, int)
    DEBUG = _env("FLASK_DEBUG", False, bool)

    # Business rules
    SUPERVISOR_CAP = 5        # open challenges per supervisor
    STUDENT_CAP = 3           # active challenges per student
    LAB_VENUES = ["Lab DC-001", "Lab DC-002", "Lab DC-003", "Lab DC-004"]
    LAB_OPEN, LAB_CLOSE = "08:00", "17:00"

    # MCDA (see app/mcda.py)
    # Weights come from AHP pairwise judgements (Saaty 1–9 scale: "the first is x times as important as the second").
    # Set MCDA_AHP_PAIRWISE = None to use MCDA_WEIGHTS directly.
    MCDA_AHP_PAIRWISE = {
        ("alignment", "capacity"): 2, ("alignment", "availability"): 3, ("alignment", "record"): 5,
        ("capacity", "availability"): 2, ("capacity", "record"): 2, ("availability", "record"): 2,
    }
    MCDA_WEIGHTS = {"alignment": 0.50, "capacity": 0.25, "availability": 0.15, "record": 0.10}
    MCDA_THRESHOLD = 55.0      # minimum weighted score (0–100) to be recommended / assigned
    MCDA_RANKING = "topsis"   # "topsis" or "wsm" (weighted sum)


class TestConfig(Config):
    TESTING = True
    SEED_DEMO_DATA = True
