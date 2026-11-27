"""Outgoing e-mail over SMTP (standard library only).

send_mail() returns (sent, detail). When MAIL_SERVER is not set, the message is written to MAIL_OUTBOX
as an .eml file instead, so it can be opened and checked.
"""
import os
import smtplib
import ssl
import uuid
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

from flask import current_app


def _sender(cfg):
    address = cfg["MAIL_FROM"] or cfg["MAIL_USERNAME"] or "no-reply@localhost"
    return formataddr((cfg["MAIL_FROM_NAME"], address)), address


def _build(to, subject, text, html, cfg):
    msg = EmailMessage()
    msg["From"], address = _sender(cfg)
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=address.split("@")[-1] or "localhost")
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    return msg


def _save(msg, cfg):
    os.makedirs(cfg["MAIL_OUTBOX"], exist_ok=True)
    path = os.path.join(cfg["MAIL_OUTBOX"], "%s.eml" % uuid.uuid4().hex)
    with open(path, "wb") as f:
        f.write(bytes(msg))
    return path


def send_mail(to, subject, text, html=None):
    cfg = current_app.config
    msg = _build(to, subject, text, html, cfg)
    if cfg.get("MAIL_SUPPRESS_SEND"):
        current_app.extensions.setdefault("outbox", []).append(msg)
        return True, "suppressed"
    if not cfg["MAIL_SERVER"]:
        path = _save(msg, cfg)
        current_app.logger.warning("MAIL_SERVER is not set — e-mail to %s saved to %s instead of being sent.", to, path)
        return False, "E-mail is not configured on the server."
    try:
        if cfg["MAIL_USE_SSL"]:
            server = smtplib.SMTP_SSL(cfg["MAIL_SERVER"], cfg["MAIL_PORT"], timeout=cfg["MAIL_TIMEOUT"], context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(cfg["MAIL_SERVER"], cfg["MAIL_PORT"], timeout=cfg["MAIL_TIMEOUT"])
        with server:
            if cfg["MAIL_USE_TLS"] and not cfg["MAIL_USE_SSL"]:
                server.starttls(context=ssl.create_default_context())
            if cfg["MAIL_USERNAME"]:
                server.login(cfg["MAIL_USERNAME"], cfg["MAIL_PASSWORD"])
            server.send_message(msg)
        return True, "sent"
    except (smtplib.SMTPException, OSError) as e:
        _save(msg, cfg)
        current_app.logger.error("Could not send e-mail to %s: %s", to, e)
        return False, "The e-mail could not be sent (%s)." % e.__class__.__name__
