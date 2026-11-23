import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import create_app            # noqa: E402
from app.config import TestConfig     # noqa: E402


@pytest.fixture()
def app(tmp_path):
    return create_app(TestConfig, DATABASE=str(tmp_path / "test.sqlite3"), UPLOAD_FOLDER=str(tmp_path / "uploads"))


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def login(client):
    def _login(member_no, password="Demo@1234"):
        r = client.post("/api/auth/login", json={"member_id": member_no, "password": password})
        assert r.status_code == 200, r.json
        return {"Authorization": "Bearer " + r.json["token"]}
    return _login
