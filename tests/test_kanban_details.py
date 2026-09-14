from types import SimpleNamespace

from flask import Flask

from app.controllers import kanban as controller
from app.services.kanban import KanbanError


class PartialService:
    def show_task(self, task_id):
        raise KanbanError("show unavailable")

    def runs(self, task_id):
        return [{"id": "run-1", "status": "done", "summary": "完成实现"}]

    def context(self, task_id):
        raise KanbanError("context unavailable")

    def log(self, task_id, tail=None):
        return "step one\nstep two\nfinished"


def test_task_details_keeps_partial_process_and_persisted_result(monkeypatch):
    link = {
        "kanban_task_id": "kb_1",
        "kanban_status": "done",
        "last_result": "最终交付结果",
        "assignee_profile": "developer",
    }
    monkeypatch.setattr(controller, "_service_for_task", lambda _task_id: PartialService())
    monkeypatch.setattr(controller, "store", SimpleNamespace(
        find_kanban_task_link=lambda **_kwargs: link,
    ))
    app = Flask(__name__)
    app.register_blueprint(controller.bp)

    response = app.test_client().get("/api/kanban/tasks/kb_1/details?tail=9999999")
    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert data["task"]["task"]["result"] == "最终交付结果"
    assert data["log"].endswith("finished")
    assert data["runs"][0]["summary"] == "完成实现"
    assert set(data["errors"]) == {"task", "context"}
