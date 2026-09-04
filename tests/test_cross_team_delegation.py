from __future__ import annotations

from app import mcp_server
from app.models.store import RuntimeStore


def _agent(
    agent_id: str,
    profile_name: str,
    *,
    role: str = "leader",
    team_id: str | None = None,
) -> dict:
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


def test_delegate_to_team_creates_cross_link_and_listable(monkeypatch):
    runtime_store = RuntimeStore()
    sales = runtime_store.create_team(slug="sales", name="销售")
    tech = runtime_store.create_team(slug="tech", name="技术")
    runtime_store.register_agent(_agent("a_sales", "sales-lead", team_id=sales["team_id"]))
    runtime_store.register_agent(_agent("a_tech", "tech-lead", team_id=tech["team_id"]))
    monkeypatch.setattr(mcp_server, "store", runtime_store)

    created = []

    class FakeBoardService:
        def create_task(self, title, **kwargs):
            created.append({"title": title, **kwargs})
            return {"task_id": "kb_cross_1", "status": "ready"}

    monkeypatch.setattr("app.services.kanban.kanban_service_for_board", lambda board: FakeBoardService())

    result = mcp_server.delegate_to_team(
        task_title="技术评估",
        content="请评估方案可行性",
        from_agent_id="a_sales",
        to_team="tech",
        expected_deliverable="评估报告",
    )

    assert result["ok"] is True
    assert result["to_team"] == "tech"
    assert result["board"] == tech["board_name"]
    assert created[0]["assignee"] == "tech-lead"
    assert created[0]["idempotency_key"].startswith("cross_team:")

    links = [
        link
        for link in runtime_store.snapshot()["kanban_task_links"]
        if link.get("kanban_role") == "cross_team_worker"
    ]
    assert len(links) == 1
    meta = links[0]["metadata"]
    assert meta["board"] == tech["board_name"]
    assert meta["from_team"] == "sales"
    assert meta["to_team"] == "tech"

    delegations = mcp_server.list_team_delegations(from_agent_id="a_sales", team="tech")
    assert len(delegations) == 1
    assert delegations[0]["delegation_task_id"] == "kb_cross_1"
    assert delegations[0]["board"] == tech["board_name"]


def test_create_kanban_worker_tasks_skips_idempotent_when_disabled(monkeypatch, tmp_path):
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("agent_lead", "lead", role="leader"))
    workspace_path = tmp_path / "dev_profile"
    runtime_store.register_agent(_agent("agent_dev", "dev_profile", role="worker", team_id=None))
    task = runtime_store.create_user_task(leader_agent_id="agent_lead", content="Build")
    runtime_store.upsert_kanban_task_link(
        local_type="user_task",
        local_id=task["user_task_id"],
        kanban_task_id="kb_parent",
        kanban_role="parent",
    )
    runtime_store.upsert_kanban_task_link(
        local_type="assignment",
        local_id="asg_1",
        kanban_task_id="kb_worker_old",
        kanban_role="worker",
        parent_local_id=task["user_task_id"],
        kanban_status="done",
        metadata={"round": 1, "parent_task_id": "kb_parent", "delegation_id": "del_1"},
    )
    monkeypatch.setattr(mcp_server, "store", runtime_store)
    monkeypatch.setattr(mcp_server.settings_service, "get_kanban_idempotent_protection_enabled", lambda: False)

    calls = []

    def fake_create_task(title, **kwargs):
        calls.append({"title": title, **kwargs})
        return {"task_id": f"kb_worker_{len(calls)}", "status": "ready"}

    def fake_complete_task(task_id, **kwargs):
        return "completed"

    monkeypatch.setattr(mcp_server.kanban_service, "create_task", fake_create_task, raising=False)
    monkeypatch.setattr(mcp_server.kanban_service, "complete_task", fake_complete_task, raising=False)

    result = mcp_server.create_kanban_worker_tasks(
        assignments=[{"to_agent_id": "agent_dev", "content": "Implement", "title": "Implement API"}],
        from_agent_id="agent_lead",
        user_task_id=task["user_task_id"],
        summary_instruction="Summarize",
    )

    assert result["ok"] is True
    assert result.get("idempotent") is not True
    assert len(calls) == 1
