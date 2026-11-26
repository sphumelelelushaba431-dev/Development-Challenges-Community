"""Settings. Every value can be overridden with an environment variable of the same name."""
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _load_dotenv(path):
    """Read KEY=VALUE lines from backend/.env (if present) into the environment. Real environment variables win."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_dotenv(os.path.join(BASE_DIR, ".env"))


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
    # False: a new member can log in straight after registering with the Member ID / email and password they chose.
    # True:  new accounts stay "pending" until a supervisor approves them in the Audit log.
    REQUIRE_APPROVAL = _env("REQUIRE_APPROVAL", False, bool)
    SESSION_IDLE_MINUTES = 30                                 # a sign-in with no activity for this long counts as ended
    # Where members log in — used in e-mails.
    APP_URL = _env("APP_URL", "http://localhost:3000")

    # E-mail (SMTP). Registration and approval e-mails are sent when MAIL_SERVER is set.
    # Without it, each e-mail is saved to instance/outbox/ so nothing is lost. Gmail: smtp.gmail.com, port 587,
    # MAIL_USE_TLS=true and an App Password (Google account → Security → App passwords) as MAIL_PASSWORD.
    MAIL_SERVER = _env("MAIL_SERVER", "")
    MAIL_PORT = _env("MAIL_PORT", 587, int)
    MAIL_USE_TLS = _env("MAIL_USE_TLS", True, bool)           # STARTTLS (port 587)
    MAIL_USE_SSL = _env("MAIL_USE_SSL", False, bool)          # implicit TLS (port 465)
    MAIL_USERNAME = _env("MAIL_USERNAME", "")
    MAIL_PASSWORD = _env("MAIL_PASSWORD", "")
    MAIL_FROM = _env("MAIL_FROM", "")                         # defaults to MAIL_USERNAME
    MAIL_FROM_NAME = _env("MAIL_FROM_NAME", "Development Challenges Community")
    MAIL_TIMEOUT = _env("MAIL_TIMEOUT", 15, int)
    MAIL_OUTBOX = _env("MAIL_OUTBOX", os.path.join(BASE_DIR, "instance", "outbox"))
    MAIL_SUPPRESS_SEND = False                                # tests: keep e-mails in memory instead of sending
    SEED_DEMO_DATA = _env("SEED_DEMO_DATA", True, bool)       # seed demo data when the database is new
    HOST = _env("HOST", "127.0.0.1")
    PORT = _env("PORT", 5000, int)
    DEBUG = _env("FLASK_DEBUG", False, bool)

    # Business rules
    SUPERVISOR_CAP = 5        # open challenges per supervisor
    STUDENT_CAP = 3           # active challenges per student
    AUTO_TEAM_SIZE = 3        # students auto-assigned to an approved challenge
    MEETING_MODES = ("Online", "In person")

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
    REQUIRE_APPROVAL = False
    MAIL_SUPPRESS_SEND = True
