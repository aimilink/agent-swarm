from __future__ import annotations

import queue
import threading

from app.models.store import RuntimeStore
from app.services import profiles
from app.services.kanban_dispatch import KanbanDispatchWorker


def _agent(agent_id: str = "agent_worker", profile_name: str = "worker") -> dict:
    return {
        "agent_id": agent_id,
        "profile_name": profile_name,
        "name": profile_name.title(),
        "role": "worker",
        "runtime_status": "running",
        "readiness_status": "ready",
    }


def test_model_summary_cache_reuses_parse_and_invalidates_after_write(tmp_path, monkeypatch):
    profile_dir = tmp_path / "profiles" / "worker"
    profile_dir.mkdir(parents=True)
    config_path = profile_dir / "config.yaml"
    config_path.write_text(
        "model:\n  default: first\n  provider: custom\n  base_url: http://first\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(
        profiles,
        "_profile_config_path",
        lambda profile_name: tmp_path / "profiles" / profile_name / "config.yaml",
    )
    profiles._MODEL_SUMMARY_CACHE.clear()
    original_safe_load = profiles.yaml.safe_load
    parse_calls = 0

    def counting_safe_load(value):
        nonlocal parse_calls
        parse_calls += 1
        return original_safe_load(value)

    monkeypatch.setattr(profiles.yaml, "safe_load", counting_safe_load)

    assert profiles.read_model_summary("worker")["default"] == "first"
    assert profiles.read_model_summary("worker")["default"] == "first"
    assert parse_calls == 1

    profiles.write_profile_config(
        "worker",
        {"model": {"default": "second", "provider": "custom", "base_url": "http://second"}},
    )

    assert profiles.read_model_summary("worker")["default"] == "second"
    assert parse_calls == 2


def test_snapshot_does_not_hold_store_lock_during_profile_io(monkeypatch):
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent())
    entered = threading.Event()
    release = threading.Event()

    def slow_summary(_profile_name):
        entered.set()
        assert release.wait(timeout=2)
        return {"default": "test", "provider": "custom", "base_url": ""}

    monkeypatch.setattr(profiles, "read_model_summary", slow_summary)
    worker = threading.Thread(target=runtime_store.snapshot)
    worker.start()
    assert entered.wait(timeout=1)

    acquired = runtime_store._lock.acquire(timeout=0.2)
    if acquired:
        runtime_store._lock.release()
    release.set()
    worker.join(timeout=2)

    assert acquired is True
    assert not worker.is_alive()


def test_sse_subscriber_queue_is_bounded_and_keeps_latest_event():
    runtime_store = RuntimeStore()
    subscriber = runtime_store.subscribe()

    for index in range(300):
        runtime_store.push_event(
            "agent.terminal.output",
            agent_id="agent_worker",
            task_id=None,
            data={"index": index},
        )

    assert subscriber.maxsize == 256
    assert subscriber.qsize() == 256
    latest = ""
    try:
        while True:
            latest = subscriber.get_nowait()
    except queue.Empty:
        pass
    assert "evt_0300" in latest


def test_dispatch_idle_path_does_not_build_full_snapshot(monkeypatch):
    runtime_store = RuntimeStore()
    runtime_store.upsert_kanban_task_link(
        local_type="assignment",
        local_id="asg_done",
        kanban_task_id="kb_done",
        kanban_role="worker",
        kanban_status="done",
        assignee_profile="worker",
    )

    def reject_snapshot():
        raise AssertionError("dispatch loop should use lightweight store reads")

    monkeypatch.setattr(runtime_store, "snapshot", reject_snapshot)
    worker = KanbanDispatchWorker(runtime_store=runtime_store)

    result = worker.dispatch_now()

    assert result["skipped"] is True
