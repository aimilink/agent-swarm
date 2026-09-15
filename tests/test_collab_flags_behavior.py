from __future__ import annotations

from app import mcp_server
from app.models.store import RuntimeStore
from app.services.kanban_sync import KanbanSyncWorker
from app.services.settings import SettingsService


def _agent(
    agent_id: str,
    profile_name: str,
    role: str,
    workspace_path: str | None = None,
    description: str = "",
) -> dict:
    return {
        "agent_id": agent_id,
        "profile_name": profile_name,
        "name": profile_name.title(),
        "role": role,
        "description": description,
        "is_leader": role == "leader",
        "workspace_path": workspace_path or f"/tmp/{profile_name}",
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
        "created_at": "2026-09-15T00:00:00Z",
        "last_active_at": "2026-09-15T00:00:00Z",
    }


class _FakeKanbanService:
    """Minimal kanban_service stand-in for human-input creation."""

    def __init__(self, tasks: dict | None = None) -> None:
        self.created_tasks: list[dict] = []
        self.tasks: dict = tasks or {}

    def create_task(self, title, **kwargs):
        self.created_tasks.append({"title": title, **kwargs})
        if any(item["title"].startswith("人工处理") for item in self.created_tasks):
            task_id = f"kb_human_{sum(1 for item in self.created_tasks if item['title'].startswith('人工处理'))}"
        else:
            task_id = f"kb_review_{len(self.created_tasks)}"
        self.tasks[task_id] = {"task_id": task_id, "status": "ready"}
        return {"task_id": task_id, "status": "ready"}

    def show_task(self, task_id):
        return self.tasks[task_id]


def _make_settings_service(monkeypatch, *, block_human_input_enabled: bool) -> SettingsService:
    """Patch the module-level settings_service singleton with a stub."""

    class _StubSettingsService:
        def get_kanban_block_human_input_enabled(self) -> bool:
            return block_human_input_enabled

        def get_kanban_multi_review_enabled(self) -> bool:
            return True

    stub = _StubSettingsService()
    monkeypatch.setattr(mcp_server, "settings_service", stub, raising=False)
    from app.services import human_input as human_input_service

    monkeypatch.setattr(human_input_service, "settings_service", stub, raising=False)
    return stub  # type: ignore[return-value]


def test_block_human_input_disabled_does_not_create_task(monkeypatch):
    """block_human_input_enabled=false：不创建 Kanban 任务，返回 blocked 提示。"""
    _make_settings_service(monkeypatch, block_human_input_enabled=False)
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("agent_lead", "lead", "leader"))
    monkeypatch.setattr(mcp_server, "store", runtime_store)

    fake_kanban = _FakeKanbanService()
    monkeypatch.setattr(mcp_server, "kanban_service", fake_kanban, raising=False)
    from app.services import human_input as human_input_service

    monkeypatch.setattr(human_input_service, "kanban_service", fake_kanban, raising=False)

    result = mcp_server.request_human_input(
        question="部署到生产前是否继续？",
        context="测试已通过，但需要用户确认上线窗口。",
        options=["继续", "暂停"],
        from_agent_id="agent_lead",
        parent_task_id="kb_parent",
        user_task_id="ut_1234",
    )

    # MCP 工具照常成功返回（不抛异常），但没有任何 Kanban 任务被创建。
    assert result["ok"] is True
    assert result["blocked"] is True
    assert "block_human_input_enabled=false" in result["content"]
    assert "自行决策并继续" in result["content"]
    assert fake_kanban.created_tasks == []
    assert runtime_store.kanban_task_links == []

    # 服务层直接调用同样返回 blocked。
    service_result = human_input_service.create_human_input_task(
        runtime_store,
        question="再次请求确认",
        from_agent_id="agent_lead",
        parent_task_id="kb_parent",
        user_task_id="ut_1234",
    )
    assert service_result == {
        "blocked": True,
        "reason": "人工输入通道已禁用（block_human_input_enabled=false），请基于现有信息自行决策并继续",
    }
    assert fake_kanban.created_tasks == []


def test_block_human_input_enabled_still_creates_task(monkeypatch):
    """block_human_input_enabled=true（默认）：行为不变，照常创建 human_input 任务。"""
    _make_settings_service(monkeypatch, block_human_input_enabled=True)
    runtime_store = RuntimeStore()
    runtime_store.register_agent(_agent("agent_lead", "lead", "leader"))
    monkeypatch.setattr(mcp_server, "store", runtime_store)

    fake_kanban = _FakeKanbanService()
    monkeypatch.setattr(mcp_server, "kanban_service", fake_kanban, raising=False)
    from app.services import human_input as human_input_service

    monkeypatch.setattr(human_input_service, "kanban_service", fake_kanban, raising=False)

    result = mcp_server.request_human_input(
        question="部署到生产前是否继续？",
        context="测试已通过，但需要用户确认上线窗口。",
        options=["继续", "暂停"],
        from_agent_id="agent_lead",
        parent_task_id="kb_parent",
        user_task_id="ut_1234",
    )

    assert result["ok"] is True
    assert result.get("blocked") is None
    assert result["status"] == "waiting_human"
    assert len(fake_kanban.created_tasks) == 1
    assert fake_kanban.created_tasks[0]["title"] == "人工处理：部署到生产前是否继续？"
    assert fake_kanban.created_tasks[0]["assignee"] is None
    assert fake_kanban.created_tasks[0]["parent"] == "kb_parent"
    link = runtime_store.find_kanban_task_link(kanban_task_id="kb_human_1")
    assert link is not None
    assert link["kanban_role"] == "human_input"
    assert link["kanban_status"] == "waiting_human"
    assert link["metadata"]["question"] == "部署到生产前是否继续？"
    assert link["metadata"]["options"] == ["继续", "暂停"]


# ---------------------------------------------------------------------------
# multi_review_enabled 行为（owner: developer-wangchuanyi / kanban t_2789536a）
# ---------------------------------------------------------------------------


def _make_stub_settings(monkeypatch, *, multi_review_enabled: bool):
    from app.services import kanban_sync as kanban_sync_module

    class _StubSettingsService:
        def get_kanban_multi_review_enabled(self) -> bool:
            return multi_review_enabled

        def get_kanban_block_human_input_enabled(self) -> bool:
            return True

    stub = _StubSettingsService()
    monkeypatch.setattr(kanban_sync_module, "settings_service", stub, raising=False)
    return stub


def _build_worker_round(runtime_store: RuntimeStore) -> tuple[KanbanSyncWorker, _FakeKanbanService, dict]:
    """注册 leader+worker，创建 user_task → delegation → 关闭派发 → 全部 worker 到终态的看板链路。"""
    runtime_store.register_agent(_agent("agent_mr_lead", "mr_lead", "leader"))
    runtime_store.register_agent(_agent("agent_mr_dev", "mr_dev", "worker"))
    user_task = runtime_store.create_user_task(leader_agent_id="agent_mr_lead", content="Build something")
    delegation = runtime_store.create_delegation(
        leader_agent_id="agent_mr_lead",
        assignments=[{"to_agent_id": "agent_mr_dev", "content": "Implement"}],
        summary_instruction="Summarize",
        user_task_id=user_task["user_task_id"],
    )
    assignment = delegation["assignments"][0]
    runtime_store.close_user_task_dispatch(user_task["user_task_id"])
    runtime_store.upsert_kanban_task_link(
        local_type="assignment",
        local_id=assignment["assignment_id"],
        kanban_task_id="kb_mr_worker",
        kanban_role="worker",
        kanban_status="running",
        assignee_profile="mr_dev",
        parent_local_id=user_task["user_task_id"],
        metadata={"delegation_id": delegation["delegation_id"]},
    )
    fake_kanban = _FakeKanbanService(
        {"kb_mr_worker": {"task_id": "kb_mr_worker", "status": "done", "result": "worker final output"}}
    )
    worker = KanbanSyncWorker(runtime_store=runtime_store, service=fake_kanban, interval=1)
    return worker, fake_kanban, user_task


def test_multi_review_disabled_auto_finalizes_user_task(monkeypatch):
    """multi_review_enabled=false：不建 review 任务，user_task 直接 completed，有 auto_finalized 事件。"""
    _make_stub_settings(monkeypatch, multi_review_enabled=False)
    runtime_store = RuntimeStore()
    worker, fake_kanban, user_task = _build_worker_round(runtime_store)

    worker.sync_once()  # worker 任务 done → assignment completed
    worker.sync_once()  # 下一拍 _create_ready_review_tasks 触发自动定稿

    snapshot = runtime_store.snapshot()
    task = next(ut for ut in snapshot["user_tasks"] if ut["user_task_id"] == user_task["user_task_id"])
    assert task["status"] == "completed"
    assert task["completed_at"]

    # 没有创建任何 review/summary Kanban 任务，也没有 review link。
    review_links = [
        link
        for link in snapshot["kanban_task_links"]
        if link.get("kanban_role") in {"review", "summary"}
    ]
    assert review_links == []
    assert fake_kanban.created_tasks == []

    # 摘要落 auto_finalized 事件（latest_summary 拼接 worker 结果）。
    event_types = [event["event_type"] for event in snapshot["events"]]
    assert "user_task.auto_finalized" in event_types
    auto_event = next(
        event
        for event in snapshot["events"]
        if event["event_type"] == "user_task.auto_finalized"
        and event["task_id"] == user_task["user_task_id"]
    )
    assert "multi_review" in auto_event["data"]["text"]
    assert "worker final output" in auto_event["data"]["latest_summary"]

    # 幂等：继续 sync 不重复定稿、不产生新事件。
    events_before = len(snapshot["events"])
    worker.sync_once()
    assert len(runtime_store.snapshot()["events"]) == events_before
    assert fake_kanban.created_tasks == []


def test_multi_review_enabled_still_creates_review_task(monkeypatch):
    """multi_review_enabled=true（默认）：行为不变，仍创建 leader review 任务。"""
    _make_stub_settings(monkeypatch, multi_review_enabled=True)
    runtime_store = RuntimeStore()
    worker, fake_kanban, user_task = _build_worker_round(runtime_store)

    worker.sync_once()
    worker.sync_once()

    snapshot = runtime_store.snapshot()
    task = next(ut for ut in snapshot["user_tasks"] if ut["user_task_id"] == user_task["user_task_id"])
    assert task["status"] == "reviewing"
    assert "user_task.auto_finalized" not in [event["event_type"] for event in snapshot["events"]]

    assert len(fake_kanban.created_tasks) == 1
    created = fake_kanban.created_tasks[0]
    assert created["idempotency_key"] == f"review:{user_task['user_task_id']}:round:1"
    review_link = runtime_store.find_kanban_task_link(
        local_type="user_task",
        local_id=f"{user_task['user_task_id']}:round:1",
        kanban_role="review",
    )
    assert review_link is not None
    assert review_link["kanban_task_id"] == "kb_review_1"
