from __future__ import annotations

from app import mcp_server
from app.models.store import RuntimeStore
from app.services import mcp_installer, messages
from app.services.agent_status import recover_crashed_agent
from app.services.acp import pool as session_pool


def _agent(agent_id: str, role: str = "worker", runtime_status: str = "crashed") -> dict:
    return {
        "agent_id": agent_id,
        "profile_name": agent_id,
        "name": agent_id.title(),
        "role": role,
        "is_leader": role == "leader",
        "runtime_status": runtime_status,
        "readiness_status": "ready",
        "status": "offline" if runtime_status != "running" else "idle",
        "team_id": None,
    }


def test_recover_crashed_agent_restarts_and_reads_fresh_store_state():
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("worker"))
    calls = []

    def start(agent):
        calls.append(agent["agent_id"])
        runtime_store.update_agent(agent["agent_id"], runtime_status="running", status="idle")
        return True

    recovered = recover_crashed_agent(runtime_store, runtime_store.find_agent("worker"), start)

    assert calls == ["worker"]
    assert recovered["runtime_status"] == "running"


def test_recover_does_not_autostart_manually_stopped_agent():
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("worker", runtime_status="stopped"))
    calls = []

    recovered = recover_crashed_agent(
        runtime_store,
        runtime_store.find_agent("worker"),
        lambda agent: calls.append(agent),
    )

    assert calls == []
    assert recovered["runtime_status"] == "stopped"


def test_list_workers_recovers_crashed_runtime(monkeypatch):
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("worker"))
    starts = []

    def start(agent):
        starts.append(agent["agent_id"])
        runtime_store.update_agent(agent["agent_id"], runtime_status="running", status="idle")
        return True

    monkeypatch.setattr(mcp_server, "store", runtime_store)
    monkeypatch.setattr(session_pool, "start", start)
    monkeypatch.setattr(mcp_installer, "mcp_summary", lambda profile_name: [])

    workers = mcp_server.list_workers()

    assert starts == ["worker"]
    assert workers[0]["agent_id"] == "worker"
    assert workers[0]["runtime_status"] == "running"


def test_direct_target_lookup_recovers_crashed_runtime(monkeypatch):
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("worker"))

    def start(agent):
        runtime_store.update_agent(agent["agent_id"], runtime_status="running", status="idle")
        return True

    monkeypatch.setattr(session_pool, "start", start)

    recovered = messages._find_ready_agent(runtime_store, "worker")

    assert recovered["runtime_status"] == "running"
