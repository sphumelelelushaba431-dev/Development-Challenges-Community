"""Development Challenges Community — REST API (Flask).

The front end is a separate static site; it calls this API over HTTP (JSON) with a Bearer token.
"""
import os

from flask import Flask, request

from . import db, errors
from .config import Config


def create_app(config=Config, **overrides):
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(config)
    app.config.update(overrides)
    app.json.sort_keys = False
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # MCDA criterion weights from AHP (falls back to MCDA_WEIGHTS if the judgements are inconsistent)
    if app.config.get("MCDA_AHP_PAIRWISE"):
        from .mcda import ahp_weights
        w, cr = ahp_weights(app.config["MCDA_AHP_PAIRWISE"])
        app.config["MCDA_AHP_CR"] = cr
        if cr < 0.10:
            app.config["MCDA_WEIGHTS"] = w
        else:
            app.logger.warning("AHP judgements are inconsistent (CR=%.2f); using MCDA_WEIGHTS.", cr)

    db.init_app(app)
    errors.init_app(app)

    from .routes import admin, auth, challenges, dashboard, meetings, notifications, requests
    for bp in (auth.bp, challenges.bp, requests.bp, meetings.bp, notifications.bp, admin.bp, dashboard.bp):
        app.register_blueprint(bp)

    # CORS: the front end is served from a different origin
    allowed = [o.strip() for o in app.config["CORS_ORIGINS"].split(",")]

    @app.after_request
    def cors(resp):
        origin = request.headers.get("Origin")
        if origin and ("*" in allowed or origin in allowed):
            resp.headers["Access-Control-Allow-Origin"] = origin if "*" not in allowed else "*"
            resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            resp.headers["Access-Control-Max-Age"] = "3600"
            resp.headers["Vary"] = "Origin"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        return resp

    @app.before_request
    def preflight():
        if request.method == "OPTIONS":
            return app.make_default_options_response()

    db.ensure_db(app)
    return app
