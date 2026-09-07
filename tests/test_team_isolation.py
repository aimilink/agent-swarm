from unittest.mock import Mock

import pytest

from app import mcp_server
from app.models.store import RuntimeStore
from app.services import messages


def setup_teams():
    store = RuntimeStore()
    for slug in ("sales", "tech"):
        team = store.create_team(slug=slug, name=slug)
        for role in ("leader", "worker"):
            agent_id = f"{slug}_{role}"
            store.register_agent({
                "agent_id": agent_id, "profile_name": agent_id,
                "role": role, "team_id": team["team_id"],
                "runtime_status": "running", "readiness_status": "ready",
            })
    return store


def test_direct_worker_task_uses_own_team_leader(monkeypatch):
    store = setup_teams()
    board = Mock()
    board.create_task.return_value = {"task_id": "kb_direct", "status": "ready"}
    monkeypatch.setattr(messages, "_kanban_service_for_leader", lambda *_: (board, "team-tech"))
    monkeypatch.setattr(messages, "workspace_for_agent", lambda _: "scratch")
    monkeypatch.setattr(messages.dispatch_worker, "trigger_async", lambda: None)
    result = messages.send_user_task(store, content="Implement", to_agent_id="tech_worker")
    task = store.find_user_task(result["user_task_id"])
    assert task["leader_agent_id"] == "tech_leader"
    assert task["team_id"] == store.find_agent("tech_worker")["team_id"]
    assert board.create_task.call_args.kwargs["assignee"] == "tech_worker"


def test_default_entry_does_not_pick_arbitrary_team():
    with pytest.raises(ValueError, match="ready leader"):
        messages.send_user_task(setup_teams(), content="Unscoped task")


def test_stopped_team_leader_is_not_dispatchable():
    store = setup_teams()
    agent = store.update_agent("tech_leader", runtime_status="stopped")
    assert store.has_team_lead(agent["team_id"])
    assert store.find_team_lead_agent_id(agent["team_id"]) is None


@pytest.mark.parametrize("target", ["sales_worker", "tech_leader"])
def test_worker_dispatch_rejects_foreign_team_and_leader(monkeypatch, target):
    store = setup_teams()
    monkeypatch.setattr(mcp_server, "store", store)
    with pytest.raises(ValueError, match="worker"):
        mcp_server.create_kanban_worker_tasks(
            assignments=[{"to_agent_id": target, "content": "Work"}],
            from_agent_id="tech_leader",
        )
    assert store.delegations == []
    assert store.kanban_task_links == []


def test_worker_dispatch_rejects_foreign_user_task(monkeypatch):
    store = setup_teams()
    task = store.create_user_task(leader_agent_id="sales_leader", content="Sales")
    monkeypatch.setattr(mcp_server, "store", store)
    with pytest.raises(ValueError, match="requesting leader"):
        mcp_server.create_kanban_worker_tasks(
            assignments=[{"to_agent_id": "tech_worker", "content": "Work"}],
            from_agent_id="tech_leader", user_task_id=task["user_task_id"],
        )
    assert store.delegations == []


def test_worker_dispatch_rejects_stale_task_team(monkeypatch):
    store = setup_teams()
    task = store.create_user_task(leader_agent_id="tech_leader", content="Tech")
    store.assign_agent_team("tech_leader", None)
    monkeypatch.setattr(mcp_server, "store", store)
    with pytest.raises(ValueError, match="team no longer matches"):
        mcp_server.create_kanban_worker_tasks(
            assignments=[{"to_agent_id": "tech_worker", "content": "Work"}],
            from_agent_id="tech_leader", user_task_id=task["user_task_id"],
        )
    assert store.delegations == []


def test_detaching_leader_preserves_ungrouped_leader_uniqueness():
    store = setup_teams()
    store.assign_agent_team("sales_leader", None)
    with pytest.raises(ValueError, match="already has a leader"):
        store.assign_agent_team("tech_leader", None)
    assert store.find_agent("tech_leader")["team_id"] is not None
