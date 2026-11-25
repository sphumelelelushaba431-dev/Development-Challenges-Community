"""Input checks shared by the routes (the browser checks too, but the server must not trust it)."""
import re
from datetime import date

EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
PHONE = re.compile(r"^(\+27|0)[6-8]\d{8}$")
MEMBER_NO = re.compile(r"^DCC\d{5}$", re.I)
TITLES = {"Mr", "Miss", "Ms", "Mrs", "Dr", "Prof"}
GENDERS = {"Male", "Female"}
ROLES = {"student", "supervisor", "representative"}


def clean_phone(p):
    return re.sub(r"[\s()\-]", "", p or "")


def valid_sa_id(n):
    """13 digits, a real date of birth and a correct Luhn check digit."""
    n = (n or "").strip()
    if not re.fullmatch(r"\d{13}", n):
        return False
    yy, mm, dd = int(n[0:2]), int(n[2:4]), int(n[4:6])
    year = 2000 + yy if yy <= date.today().year % 100 else 1900 + yy
    try:
        date(year, mm, dd)
    except ValueError:
        return False
    total = 0
    for i, ch in enumerate(n):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def password_problems(pw):
    rules = [(len(pw or "") >= 8, "8+ characters"), (re.search(r"[A-Z]", pw or ""), "an uppercase letter"),
             (re.search(r"[a-z]", pw or ""), "a lowercase letter"), (re.search(r"\d", pw or ""), "a number"),
             (re.search(r"[^A-Za-z0-9]", pw or ""), "a symbol")]
    return [msg for ok, msg in rules if not ok]


def parse_date(s):
    try:
        return date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None
