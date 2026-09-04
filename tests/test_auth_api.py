"""API Bearer token 鉴权测试。"""

from __future__ import annotations

from flask import Flask, jsonify

from app.controllers.auth import register_api_auth
from app.controllers import events as events_controller
from app.models.store import RuntimeStore


def _app_with_auth(monkeypatch, token: str | None):
    if token is None:
        monkeypatch.delenv("AGENT_TEAM_API_TOKEN", raising=False)
    else:
        monkeypatch.setenv("AGENT_TEAM_API_TOKEN", token)
    app = Flask(__name__)

    @app.get("/api/ping")
    def ping():
        return jsonify({"ok": True})

    @app.get("/")
    def index():
        return "ok"

    register_api_auth(app)
    return app


def test_auth_skipped_when_token_unset(monkeypatch):
    app = _app_with_auth(monkeypatch, None)
    client = app.test_client()
    response = client.get("/api/ping")
    assert response.status_code == 200
    assert response.get_json()["ok"] is True


def test_auth_rejects_missing_bearer(monkeypatch):
    app = _app_with_auth(monkeypatch, "secret-token")
    client = app.test_client()
    response = client.get("/api/ping")
    assert response.status_code == 401
    assert response.get_json() == {"ok": False, "error": "unauthorized"}


def test_auth_rejects_wrong_bearer(monkeypatch):
    app = _app_with_auth(monkeypatch, "secret-token")
    client = app.test_client()
    response = client.get("/api/ping", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401
    assert response.get_json()["error"] == "unauthorized"


def test_auth_accepts_bearer_header(monkeypatch):
    app = _app_with_auth(monkeypatch, "secret-token")
    client = app.test_client()
    response = client.get("/api/ping", headers={"Authorization": "Bearer secret-token"})
    assert response.status_code == 200
    assert response.get_json()["ok"] is True


def test_auth_accepts_query_token_for_sse(monkeypatch):
    monkeypatch.setenv("AGENT_TEAM_API_TOKEN", "sse-secret")
    runtime_store = RuntimeStore()
    monkeypatch.setattr(events_controller, "store", runtime_store)
    app = Flask(__name__)
    register_api_auth(app)
    app.register_blueprint(events_controller.bp)
    client = app.test_client()

    denied = client.get("/api/events/stream")
    assert denied.status_code == 401
    assert denied.get_json() == {"ok": False, "error": "unauthorized"}

    # 用 query token；流式响应应成功建立（读一点后断开）
    allowed = client.get("/api/events/stream?token=sse-secret", buffered=False)
    assert allowed.status_code == 200
    assert allowed.mimetype == "text/event-stream"
    chunk = next(allowed.response)
    assert b"connected" in chunk
    allowed.close()


def test_auth_does_not_block_non_api(monkeypatch):
    app = _app_with_auth(monkeypatch, "secret-token")
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200
    assert response.data == b"ok"


def test_ui_stores_and_sends_api_token():
    from pathlib import Path

    source = Path("app/static/app.js").read_text(encoding="utf-8")
    assert 'API_TOKEN_STORAGE_KEY = "agentTeamApiToken"' in source
    assert "ensureApiToken" in source
    assert "Authorization" in source
    assert "Bearer" in source
    assert "/api/events/stream?token=" in source
