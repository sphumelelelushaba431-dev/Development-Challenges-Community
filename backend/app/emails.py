"""The e-mails members receive. Passwords are never included."""
from html import escape

from flask import current_app

from .db import jload
from .mailer import send_mail
from .services import full_name

ROLE_LABEL = {"student": "Student", "supervisor": "Supervisor", "representative": "Representative"}


def _login_url():
    return current_app.config["APP_URL"].rstrip("/") + "/login.html"


def _html(greeting, intro, rows, steps, closing):
    table = "".join(
        '<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;width:170px">%s</td>'
        '<td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600">%s</td></tr>' % (escape(k), escape(v))
        for k, v in rows)
    items = "".join('<li style="margin:4px 0">%s</li>' % s for s in steps)
    return ('<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">'
            '<div style="background:#1e3a8a;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">'
            'Development Challenges Community</div>'
            '<div style="border:1px solid #e2e8f0;border-top:0;padding:24px;border-radius:0 0 10px 10px">'
            '<p>%s</p><p>%s</p>'
            '<table style="border-collapse:collapse;width:100%%;margin:16px 0;font-size:14px">%s</table>'
            '<ol style="padding-left:20px;font-size:14px">%s</ol>'
            '<p style="font-size:13px;color:#64748b">%s</p></div></div>') % (escape(greeting), intro, table, items, closing)


def _details(u):
    interests = ", ".join(jload(u["expertise"])) or u["interest"]
    rows = [("Member ID", u["member_no"]), ("Name", full_name(u)), ("Role", ROLE_LABEL.get(u["role"], u["role"].title())),
            ("Email (login)", u["email"]), ("Phone", u["phone"]), ("Organisation", u["organisation"])]
    if interests:
        rows.append(("Areas of interest", interests))
    rows.append(("Registered on", u["joined_at"][:16] + " UTC"))
    return rows


def send_registration_email(u):
    """Confirmation with the member's ID and details. Returns (sent, detail)."""
    pending = u["status"] == "pending"
    rows = _details(u) + [("Account status", "Waiting for administrator approval" if pending else "Active")]
    url = _login_url()
    greeting = "Dear %s," % full_name(u)
    intro = "Thank you for registering with Development Challenges Community. Your membership details are below — keep this e-mail for your records."
    steps = ["Open <a href=\"%s\">%s</a>." % (escape(url), escape(url)),
             "Enter your Member ID <b>%s</b> (or your e-mail address)." % escape(u["member_no"]),
             "Enter the password you chose when you registered."]
    if pending:
        steps.insert(0, "Wait for the e-mail that tells you the administrator has approved your account.")
    closing = ("For your security we never send passwords by e-mail. If you did not register, please ignore this message "
               "or contact the community administrators.")
    text = "\n".join([greeting, "", intro, ""] + ["%-18s %s" % (k + ":", v) for k, v in rows] + ["", "How to log in:"] +
                     ["%d. %s" % (i + 1, s.replace("<b>", "").replace("</b>", "").replace('<a href="%s">%s</a>' % (url, url), url))
                      for i, s in enumerate(steps)] + ["", closing])
    subject = "Registration confirmed — your Member ID is %s" % u["member_no"]
    return send_mail(u["email"], subject, text, _html(greeting, intro, rows, steps, closing))


def send_approval_email(u):
    url = _login_url()
    greeting = "Dear %s," % full_name(u)
    intro = "Good news — your Development Challenges Community account has been approved. You can log in now."
    rows = [("Member ID", u["member_no"]), ("Email (login)", u["email"]), ("Role", ROLE_LABEL.get(u["role"], u["role"].title()))]
    steps = ["Open <a href=\"%s\">%s</a>." % (escape(url), escape(url)),
             "Enter your Member ID <b>%s</b> (or e-mail) and the password you chose when you registered." % escape(u["member_no"])]
    closing = "For your security we never send passwords by e-mail."
    text = "\n".join([greeting, "", intro, ""] + ["%-15s %s" % (k + ":", v) for k, v in rows] +
                     ["", "Log in at %s with your Member ID %s and the password you chose." % (url, u["member_no"]), "", closing])
    return send_mail(u["email"], "Your account is approved — Member ID %s" % u["member_no"], text, _html(greeting, intro, rows, steps, closing))
