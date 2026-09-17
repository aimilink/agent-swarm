from __future__ import annotations

from types import SimpleNamespace

from flask import Flask, jsonify

from app.controllers.auth import register_api_auth, register_login_auth, websocket_authenticated
from app.services.auth import AuthService


class MemorySettings:
    def __init__(self):
        self.values = {}

    def get_setting(self, key):
        return self.values.get(key)

    def set_setting(self, key, value):
        self.values[key] = value


def make_app(monkeypatch):
    monkeypatch.setenv("AGENT_TEAM_SESSION_SECRET", "test-session-secret-that-is-long-enough")
    monkeypatch.delenv("AGENT_TEAM_API_TOKEN", raising=False)
    service = AuthService(MemorySettings())
    app = Flask(__name__, template_folder="../app/templates")

    @app.get("/")
    def home():
        return "workspace"

    @app.get("/api/ping")
    def ping():
        return jsonify(ok=True)

    register_login_auth(app, service)
    register_api_auth(app)
    app.config.update(TESTING=True)
    return app, service


def csrf(client):
    with client.session_transaction() as values:
        return values["csrf_token"]


def test_first_login_shows_default_and_forces_password_change(monkeypatch):
    app, service = make_app(monkeypatch)
    client = app.test_client()
    redirected = client.get("/")
    assert redirected.status_code == 302
    assert "/login" in redirected.headers["Location"]
    login = client.get("/login")
    assert "默认凭据" in login.get_data(as_text=True)
    assert service.default_password in login.get_data(as_text=True)

    response = client.post("/login", data={
        "csrf_token": csrf(client),
        "username": "admin",
        "password": "agentswarm",
    })
    assert response.status_code == 302
    assert response.headers["Location"].endswith("/change-password")
    assert client.get("/").headers["Location"].endswith("/change-password")
    api = client.get("/api/ping")
    assert api.status_code == 403
    assert api.get_json()["error"] == "password_change_required"

    changed = client.post("/change-password", data={
        "csrf_token": csrf(client),
        "current_password": "agentswarm",
        "new_password": "safe-password-2026",
        "confirmation": "safe-password-2026",
    })
    assert changed.status_code == 302
    assert changed.headers["Location"].endswith("/")
    assert client.get("/").get_data(as_text=True) == "workspace"
    assert client.get("/api/ping").get_json()["ok"] is True


def test_changed_password_hides_default_and_login_errors_are_safe(monkeypatch):
    app, service = make_app(monkeypatch)
    client = app.test_client()
    client.get("/login")
    wrong = client.post("/login", data={"csrf_token": csrf(client), "username": "admin", "password": "wrong"})
    assert wrong.status_code == 200
    assert "账号或密码错误" in wrong.get_data(as_text=True)

    assert service.verify("admin", "agentswarm")
    service.change_password("agentswarm", "another-safe-password", "another-safe-password")
    page = client.get("/login").get_data(as_text=True)
    assert "默认凭据" not in page
    assert "agentswarm" not in page

def test_websocket_accepts_changed_password_session_and_rejects_forced_change(monkeypatch):
    app, _ = make_app(monkeypatch)
    serializer = app.session_interface.get_signing_serializer(app)
    authenticated = serializer.dumps({"authenticated": True, "must_change_password": False, "_permanent": True})
    forced = serializer.dumps({"authenticated": True, "must_change_password": True, "_permanent": True})

    assert websocket_authenticated(SimpleNamespace(query_params={}, cookies={"session": authenticated}), app)
    assert not websocket_authenticated(SimpleNamespace(query_params={}, cookies={"session": forced}), app)
    assert not websocket_authenticated(SimpleNamespace(query_params={}, cookies={"session": "invalid"}), app)


def test_websocket_accepts_configured_api_token(monkeypatch):
    app, _ = make_app(monkeypatch)
    monkeypatch.setenv("AGENT_TEAM_API_TOKEN", "integration-token")
    websocket = SimpleNamespace(query_params={"token": "integration-token"}, cookies={})
    assert websocket_authenticated(websocket, app)
