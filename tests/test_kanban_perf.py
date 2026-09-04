from __future__ import annotations

from app.models.store import RuntimeStore
from app.services.kanban_dispatch import (
    IDLE_DISPATCH_INTERVAL,
    KanbanDispatchWorker,
    dispatch_wait_interval,
)
from app.services.kanban_sync import KanbanSyncWorker


class CountingKanban:
    def __init__(self, tasks=None):
        self.tasks = tasks or {}
        self.show_calls = []
        self.dispatched = 0
        self.assigned = []

    def show_task(self, task_id):
        self.show_calls.append(task_id)
        return self.tasks.get(task_id, {"task_id": task_id, "status": "done"})

    def assign_task(self, task_id, profile):
        self.assigned.append((task_id, profile))

    def dispatch_once(self, *, max_workers=None):
        self.dispatched += 1
        return {"ok": True, "max_workers": max_workers}


def _agent(agent_id: str, profile_name: str, role: str = "leader") -> dict:
    return {
        "agent_id": agent_id,
        "profile_name": profile_name,
        "name": profile_name.title(),
        "role": role,
        "description": "",
        "is_leader": role == "leader",
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


def test_sync_link_skips_show_task_for_done_links():
    runtime_store = RuntimeStore()
    runtime_store.upsert_kanban_task_link(
        local_type="assignment",
        local_id="asg_1",
        kanban_task_id="kb_done",
        kanban_role="worker",
        kanban_status="done",
        assignee_profile="dev",
    )
    service = CountingKanban({"kb_done": {"task_id": "kb_done", "status": "ready"}})
    worker = KanbanSyncWorker(runtime_store=runtime_store, service=service, interval=1)
    link = runtime_store.find_kanban_task_link(kanban_task_id="kb_done")

    worker._sync_link(link)

    assert service.show_calls == []
    assert runtime_store.find_kanban_task_link(kanban_task_id="kb_done")["kanban_status"] == "done"


def test_sync_once_skips_show_task_for_terminal_worker_links():
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("agent_dev", "dev", "worker"))
    for status, task_id in (("done", "kb_done"), ("archived", "kb_archived"), ("failed", "kb_failed")):
        runtime_store.upsert_kanban_task_link(
            local_type="assignment",
            local_id=task_id,
            kanban_task_id=task_id,
            kanban_role="worker",
            kanban_status=status,
            assignee_profile="dev",
        )
    runtime_store.upsert_kanban_task_link(
        local_type="assignment",
        local_id="kb_running",
        kanban_task_id="kb_running",
        kanban_role="worker",
        kanban_status="running",
        assignee_profile="dev",
    )
    service = CountingKanban(
        {
            "kb_done": {"task_id": "kb_done", "status": "done"},
            "kb_archived": {"task_id": "kb_archived", "status": "archived"},
            "kb_failed": {"task_id": "kb_failed", "status": "failed"},
            "kb_running": {"task_id": "kb_running", "status": "running"},
        }
    )
    worker = KanbanSyncWorker(runtime_store=runtime_store, service=service, interval=1)

    worker.sync_once()

    assert service.show_calls == ["kb_running"]


def test_dispatch_wait_interval_backs_off_when_idle():
    assert dispatch_wait_interval(2.0, has_dispatchable=False, has_pending_dispatch=False) == IDLE_DISPATCH_INTERVAL
    assert dispatch_wait_interval(2.0, has_dispatchable=True, has_pending_dispatch=False) == 2.0
    assert dispatch_wait_interval(2.0, has_dispatchable=False, has_pending_dispatch=True) == 2.0


def test_dispatch_worker_uses_idle_interval_when_no_work():
    runtime_store = RuntimeStore()
    runtime_store.upsert_kanban_task_link(
        local_type="assignment",
        local_id="asg_1",
        kanban_task_id="kb_done",
        kanban_role="worker",
        kanban_status="done",
        assignee_profile="dev",
    )
    worker = KanbanDispatchWorker(
        runtime_store=runtime_store,
        service=CountingKanban(),
        interval=2.0,
        idle_interval=30.0,
    )

    outcome = worker.dispatch_now()

    assert outcome["skipped"] is True
    assert worker._wait_interval == 30.0


def test_dispatch_worker_restores_interval_when_ready_tasks_appear():
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("agent_leader", "leader", "leader"))
    worker = KanbanDispatchWorker(
        runtime_store=runtime_store,
        service=CountingKanban({"kb_ready": {"status": "ready"}}),
        interval=2.0,
        idle_interval=30.0,
    )
    worker.dispatch_now()
    assert worker._wait_interval == 30.0

    runtime_store.upsert_kanban_task_link(
        local_type="user_task",
        local_id="ut_1",
        kanban_task_id="kb_ready",
        kanban_role="parent",
        kanban_status="ready",
        assignee_profile="leader",
    )

    outcome = worker.dispatch_now()

    assert outcome["skipped"] is False
    assert worker._wait_interval == 2.0


def test_dispatch_worker_keeps_normal_interval_when_pending_dispatch_exists():
    runtime_store = RuntimeStore()
    runtime_store.upsert_kanban_task_link(
        local_type="user_task",
        local_id="ut_1",
        kanban_task_id="kb_pending",
        kanban_role="parent",
        kanban_status="pending_dispatch",
        assignee_profile="",
    )
    worker = KanbanDispatchWorker(
        runtime_store=runtime_store,
        service=CountingKanban(),
        interval=2.0,
        idle_interval=30.0,
    )

    outcome = worker.dispatch_now()

    assert outcome["skipped"] is True
    assert worker._wait_interval == 2.0
