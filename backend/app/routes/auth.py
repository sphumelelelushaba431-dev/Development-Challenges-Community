"""Registration, login, password reset and the signed-in member's own profile."""
import os
import uuid

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import login_required, make_token, read_token
from ..db import execute, jdump, now, query
from ..errors import fail
from ..nlp.taxonomy import AREAS
from ..services import full_name, log, me_payload, notify_admins
from ..validators import ACCOUNT_ROLES, EMAIL, GENDERS, MEMBER_NO, ROLES, TITLES, parse_phone, password_problems, valid_sa_id

bp = Blueprint("auth", __name__, url_prefix="/api")
MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024


def _save_photo(upload):
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png"):
        fail("Use a JPG or PNG photo.", 422, photo="Use a JPG or PNG photo.")
    content = upload.stream.read(MAX_PROFILE_PHOTO_BYTES + 1)
    if len(content) > MAX_PROFILE_PHOTO_BYTES:
        fail("Photo must be 2 MB or smaller.", 422, photo="Photo must be 2 MB or smaller.")
    os.makedirs(current_app.config["UPLOAD_FOLDER"], exist_ok=True)
    photo = "photo-" + uuid.uuid4().hex + ext
    with open(os.path.join(current_app.config["UPLOAD_FOLDER"], photo), "wb") as saved:
        saved.write(content)
    return photo


def _data():
    data = request.get_json(silent=True)
    if data is not None:
        return data
    result = request.form.to_dict()
    for key in request.form:
        values = request.form.getlist(key)
        if len(values) > 1:
            result[key] = values
    return result


def _interests(d):
    raw = d.get("area_of_interest") or d.get("interests") or d.get("interest")
    if isinstance(raw, (list, tuple)):
        values = list(raw)
    elif isinstance(raw, str):
        values = [value.strip() for value in raw.split(",") if value.strip()]
    else:
        values = []
    out = []
    for value in values:
        if value not in out:
            out.append(value)
    return out


def _next_member_no():
    row = query("SELECT member_no FROM users ORDER BY member_no DESC LIMIT 1", one=True)
    n = int(row["member_no"][3:]) + 1 if row else 1
    while query("SELECT 1 FROM users WHERE member_no = ?", ("DCC%05d" % n,), one=True):
        n += 1
    return "DCC%05d" % n


@bp.post("/auth/register")
def register():
    d = _data()
    errors = {}
    role = (d.get("role") or "").lower()
    if role not in ROLES:
        errors["role"] = "Select a role."
    if d.get("title") not in TITLES:
        errors["title"] = "Select a title."
    if d.get("gender") not in GENDERS:
        errors["gender"] = "Select a gender option."
    for f, label in (("first_name", "first name"), ("surname", "surname")):
        if len((d.get(f) or "").strip()) < 2:
            errors[f] = "Enter your %s." % label
    if not valid_sa_id(d.get("id_number")):
        errors["id_number"] = "Enter a valid 13-digit SA ID number."
    phone = parse_phone(d.get("phone"), d.get("phone_country"))
    if not phone:
        errors["phone"] = "Enter a valid phone number for the selected country."
    email = (d.get("email") or "").strip().lower()
    if not EMAIL.match(email):
        errors["email"] = "Enter a valid email address."
    elif query("SELECT 1 FROM users WHERE lower(email) = ?", (email,), one=True):
        errors["email"] = "An account with this email already exists."
    if len((d.get("organisation") or "").strip()) < 2:
        errors["organisation"] = "Enter your organisation."
    interests = _interests(d)
    if not interests:
        errors["area_of_interest"] = "Select at least one area of interest."
    elif len(interests) > 3:
        errors["area_of_interest"] = "Select no more than 3 areas of interest."
    else:
        invalid = [interest for interest in interests if interest not in AREAS]
        if invalid:
            errors["area_of_interest"] = "Select valid areas of interest."
    interest = interests[0] if interests else ""
    if len((d.get("address") or "").strip()) < 10:
        errors["address"] = "Enter your full physical address."
    problems = password_problems(d.get("password"))
    if problems:
        errors["password"] = "Use " + ", ".join(problems) + "."
    if d.get("password") != d.get("confirm_password"):
        errors["confirm_password"] = "Passwords do not match."
    if str(d.get("terms_accepted")).lower() not in ("yes", "true", "1", "on") or str(d.get("popia_consent")).lower() not in ("yes", "true", "1", "on"):
        errors["terms"] = "Accept the Terms and Conditions and the Privacy Policy."
    if errors:
        fail("Please correct the highlighted fields.", 422, **errors)

    photo = _save_photo(request.files.get("photo"))

    member_no = _next_member_no()
    execute("""INSERT INTO users (member_no, role, title, first_name, surname, gender, id_number, phone, email, organisation, interest,
               expertise, address, photo, password_hash, status, terms_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)""",
            (member_no, role, d["title"], d["first_name"].strip(), d["surname"].strip(), d["gender"], d["id_number"].strip(), phone, email,
             d["organisation"].strip(), interest, jdump(interests), d["address"].strip(), photo, generate_password_hash(d["password"]), now()))
    name = "%s %s %s" % (d["title"], d["first_name"].strip(), d["surname"].strip())
    log(name, "registered as a %s — awaiting approval." % role.title(), "warn")
    notify_admins("alert", name, "New %s registration waiting for approval." % role, member_no)
    return jsonify({"member_no": member_no, "status": "pending",
                    "message": "Registration received. Your member number is %s. You can log in once the administrator approves your account." % member_no}), 201


@bp.post("/auth/login")
def login():
    d = _data()
    ident = (d.get("member_id") or d.get("email") or "").strip()
    if not ident or not d.get("password"):
        fail("Enter your Member ID or email and your password.", 422)
    if MEMBER_NO.match(ident):
        u = query("SELECT * FROM users WHERE upper(member_no) = upper(?)", (ident,), one=True)
    else:
        u = query("SELECT * FROM users WHERE lower(email) = lower(?)", (ident,), one=True)
    if not u:
        fail("The Member ID or password is incorrect.", 401)
    if u["status"] == "locked":
        fail("Your account is locked after too many failed attempts. Contact the administrator.", 403)
    if not check_password_hash(u["password_hash"], d["password"]):
        tries = u["failed_logins"] + 1
        if tries >= current_app.config["MAX_FAILED_LOGINS"]:
            execute("UPDATE users SET failed_logins = ?, status = 'locked', locked_at = ? WHERE id = ?", (tries, now(), u["id"]))
            log("System", "%d failed login attempts for %s — account locked." % (tries, u["member_no"]), "bad")
            fail("Too many failed attempts. Your account is now locked; contact the administrator.", 403)
        execute("UPDATE users SET failed_logins = ? WHERE id = ?", (tries, u["id"]))
        fail("The Member ID or password is incorrect.", 401)
    if u["status"] == "pending":
        fail("Your account is waiting for administrator approval.", 403)
    if u["status"] == "rejected":
        fail("Your registration was not approved. Contact the administrator.", 403)
    if u["role"] not in ACCOUNT_ROLES:
        fail("This account cannot access the workspace.", 403)
    execute("UPDATE users SET failed_logins = 0 WHERE id = ?", (u["id"],))
    home = "workspace.html"   # one role-gated workspace for every member
    return jsonify({"token": make_token(u), "user": me_payload(u), "home": home})


@bp.post("/auth/forgot-password")
def forgot_password():
    email = ((_data().get("email")) or "").strip().lower()
    if not EMAIL.match(email):
        fail("Enter a valid email address.", 422)
    u = query("SELECT * FROM users WHERE lower(email) = ?", (email,), one=True)
    body = {"message": "If an account exists for %s, a reset link has been sent. It expires in 30 minutes." % email}
    if u:
        token = make_token(u, salt="reset")
        # Send `token` by e-mail in production (link: reset-password.html?token=...). Shown here only in debug mode.
        current_app.logger.info("Password reset token for %s: %s", u["member_no"], token)
        if current_app.debug or current_app.testing:
            body["debug_token"] = token
    return jsonify(body)


@bp.post("/auth/reset-password")
def reset_password():
    d = _data()
    u = read_token(d.get("token", ""), salt="reset", max_age=current_app.config["RESET_MAX_AGE"])
    problems = password_problems(d.get("password"))
    if problems:
        fail("Use " + ", ".join(problems) + ".", 422)
    execute("UPDATE users SET password_hash = ?, failed_logins = 0, status = CASE WHEN status = 'locked' THEN 'active' ELSE status END WHERE id = ?",
            (generate_password_hash(d["password"]), u["id"]))
    return jsonify({"message": "Your password has been changed. You can log in now."})


@bp.get("/me")
@login_required()
def me():
    return jsonify(me_payload(g.user))


@bp.get("/photos/<path:filename>")
def get_photo(filename):
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)


@bp.put("/me")
@login_required()
def update_me():
    d = _data()
    errors = {}
    email = (d.get("email") or "").strip().lower()
    if not EMAIL.match(email):
        errors["email"] = "Enter a valid email address."
    elif query("SELECT 1 FROM users WHERE lower(email) = ? AND id <> ?", (email, g.user["id"]), one=True):
        errors["email"] = "Another account uses this email."
    phone = parse_phone(d.get("phone"), d.get("phone_country"))
    if not phone:
        errors["phone"] = "Enter a valid phone number for the selected country."
    if len((d.get("org") or d.get("organisation") or "").strip()) < 2:
        errors["org"] = "Enter your organisation."
    interests = _interests(d)
    if not interests:
        interest = d.get("interest") or g.user["interest"]
        interests = [interest] if interest else []
    if len(interests) > 3:
        errors["interest"] = "Select no more than 3 areas of interest."
    elif any(interest not in AREAS for interest in interests):
        errors["interest"] = "Choose valid Areas of Interest."
    interest = interests[0] if interests else ""
    if errors:
        fail("Please correct the highlighted fields.", 422, **errors)
    photo = _save_photo(request.files.get("photo")) or g.user["photo"]
    execute("UPDATE users SET email = ?, phone = ?, organisation = ?, address = ?, interest = ?, expertise = ?, photo = ? WHERE id = ?",
            (email, phone, (d.get("org") or d.get("organisation")).strip(), (d.get("address") or "").strip(),
             interest, jdump(interests), photo, g.user["id"]))
    return jsonify(me_payload(query("SELECT * FROM users WHERE id = ?", (g.user["id"],), one=True)))


@bp.post("/me/password")
@login_required()
def change_password():
    d = _data()
    if not check_password_hash(g.user["password_hash"], d.get("current", "")):
        fail("Your current password is incorrect.", 422, current="Your current password is incorrect.")
    problems = password_problems(d.get("new"))
    if problems:
        fail("Use " + ", ".join(problems) + ".", 422, new="Use " + ", ".join(problems) + ".")
    execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash(d["new"]), g.user["id"]))
    u = query("SELECT * FROM users WHERE id = ?", (g.user["id"],), one=True)
    return jsonify({"message": "Password changed.", "token": make_token(u)})
