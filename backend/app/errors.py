"""JSON error responses."""
from flask import jsonify
from werkzeug.exceptions import HTTPException


class APIError(Exception):
    def __init__(self, message, status=400, fields=None):
        super().__init__(message)
        self.message, self.status, self.fields = message, status, fields or {}


def fail(message, status=400, **fields):
    raise APIError(message, status, fields)


def init_app(app):
    @app.errorhandler(APIError)
    def _api_error(e):
        body = {"error": e.message}
        if e.fields:
            body["fields"] = e.fields
        return jsonify(body), e.status

    @app.errorhandler(HTTPException)
    def _http_error(e):
        return jsonify({"error": e.description or e.name}), e.code

    @app.errorhandler(Exception)
    def _server_error(e):                       # never leak a stack trace to the browser
        app.logger.exception(e)
        return jsonify({"error": "Something went wrong on the server."}), 500
