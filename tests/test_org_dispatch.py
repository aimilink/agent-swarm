"""组织总管 POST /api/org/dispatch 与关键词路由测试。"""

from __future__ import annotations

from flask import Flask

from app.controllers import org as org_controller
from app.controllers.auth import register_api_auth
from app.models.store import RuntimeStore
from app.services import teams as teams_service


def _agent(agent_id: str, profile_name: str, *, role: str = "leader", team_id: str | None = None) -> dict:
    return {
        "agent_id": agent_id,
        "profile_name": profile_name,
        "name": profile_name.title(),
        "role": role,
        "description": "",
        "is_leader": role == "leader",
        "team_id": team_id,
        "workspace_path": f"/tmp/{profile_name}",
        "status": "idle",
        "current_task": "空闲",
        "runtime_status": "running",
        "interaction_state": "idle",
        "orchestration_state": "none",
        "queue_depth": 0,
        "pending_interaction": None,
        "load": 0,
        "last_input": "",
        "last_output": "",
        "last_output_at": "",
        "readiness_status": "ready",
        "readiness_message": "",
        "created_at": "2026-04-26T00:00:00Z",
        "last_active_at": "2026-04-26T00:00:00Z",
    }


def _seed_teams(runtime_store: RuntimeStore) -> dict[str, dict]:
    sales = runtime_store.create_team(slug="sales", name="销售")
    tech = runtime_store.create_team(slug="tech", name="技术")
    market = runtime_store.create_team(slug="market", name="市场")
    runtime_store.register_agent(_agent("a_sales", "sales-lead", team_id=sales["team_id"]))
    runtime_store.register_agent(_agent("a_tech", "tech-lead", team_id=tech["team_id"]))
    runtime_store.register_agent(_agent("a_market", "market-lead", team_id=market["team_id"]))
    return {"sales": sales, "tech": tech, "market": market}


def test_match_team_slug_keywords():
    teams = [{"slug": "sales"}, {"slug": "tech"}, {"slug": "market"}]
    assert teams_service.match_team_slug_for_content("跟进客户商机", teams) == "sales"
    assert teams_service.match_team_slug_for_content("修复这个 bug", teams) == "tech"
    assert teams_service.match_team_slug_for_content("写 SEO 内容", teams) == "market"
    assert teams_service.match_team_slug_for_content("随便说点什么", teams) == "sales"


def test_match_defaults_to_first_team_when_unknown_slugs_only():
    teams = [{"slug": "ops"}, {"slug": "finance"}]
    assert teams_service.match_team_slug_for_content("销售客户", teams) == "ops"


def test_org_dispatch_routes_to_sales_lead(monkeypatch):
    runtime_store = RuntimeStore()
    _seed_teams(runtime_store)
    sent = []

    def fake_send(store, *, content, to_agent_id=""):
        sent.append({"content": content, "to_agent_id": to_agent_id})
        return {"user_task_id": "ut_1", "content": content, "leader_agent_id": to_agent_id}

    monkeypatch.setattr(teams_service.messages_service, "send_user_task", fake_send)
    result = teams_service.org_dispatch(runtime_store, content="请跟进客户A的商机")
    assert result["team"]["slug"] == "sales"
    assert result["lead_agent_id"] == "a_sales"
    assert sent[0]["to_agent_id"] == "a_sales"


def test_org_dispatch_api(monkeypatch):
    runtime_store = RuntimeStore()
    _seed_teams(runtime_store)
    monkeypatch.setattr(org_controller, "store", runtime_store)
    monkeypatch.setattr(
        org_controller.teams_service,
        "org_dispatch",
        lambda store, *, content: {
            "team": {"slug": "tech", "name": "技术", "team_id": "team_x"},
            "lead_agent_id": "a_tech",
            "message": {"user_task_id": "ut_tech", "content": content},
        },
    )
    monkeypatch.delenv("AGENT_TEAM_API_TOKEN", raising=False)
    app = Flask(__name__)
    register_api_auth(app)
    app.register_blueprint(org_controller.bp)
    client = app.test_client()

    empty = client.post("/api/org/dispatch", json={})
    assert empty.status_code == 400

    response = client.post("/api/org/dispatch", json={"content": "评估技术方案"})
    assert response.status_code == 201
    data = response.get_json()
    assert data["ok"] is True
    assert data["team"]["slug"] == "tech"
    assert data["lead_agent_id"] == "a_tech"


def test_org_dispatch_requires_auth_when_configured(monkeypatch):
    monkeypatch.setenv("AGENT_TEAM_API_TOKEN", "org-secret")
    app = Flask(__name__)
    register_api_auth(app)
    app.register_blueprint(org_controller.bp)
    client = app.test_client()
    response = client.post("/api/org/dispatch", json={"content": "hello"})
    assert response.status_code == 401
    assert response.get_json()["error"] == "unauthorized"
