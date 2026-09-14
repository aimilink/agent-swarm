from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

from flask import Flask

from app.controllers import system as system_controller
from app.services import system_health
from app.services.system_health import SystemHealthService


def component(status="ready", message="正常", action_view="settings"):
    return {
        "status": status,
        "message": message,
        "recovery_action": "无需处理" if status == "ready" else "检查配置",
        "action_view": action_view,
    }


def all_checks(status="ready"):
    names = ("database", "hermes_cli", "kanban", "mcp", "event_stream", "terminal")
    return {name: (lambda value=status: component(value)) for name in names}


def test_health_ready_contract_and_cache():
    calls = {"database": 0}
    checks = all_checks()

    def database():
        calls["database"] += 1
        return component()

    checks["database"] = database
    service = SystemHealthService(checks, cache_ttl_seconds=60)

    first = service.collect()
    second = service.collect()

    assert first["ok"] is True
    assert first["overall_status"] == "ready"
    assert first["cached"] is False
    assert second["cached"] is True
    assert calls["database"] == 1
    assert list(first["components"]) == [
        "database", "hermes_cli", "kanban", "mcp", "event_stream", "terminal"
    ]
    assert all(item["latency_ms"] >= 0 for item in first["components"].values())


def test_concurrent_requests_share_one_refresh():
    calls = {"database": 0}
    checks = all_checks()

    def database():
        calls["database"] += 1
        time.sleep(0.05)
        return component()

    checks["database"] = database
    service = SystemHealthService(checks, cache_ttl_seconds=60)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: service.collect(), range(2)))

    assert calls["database"] == 1
    assert sorted(result["cached"] for result in results) == [False, True]

def test_health_degraded_and_database_unavailable():
    degraded = all_checks()
    degraded["kanban"] = lambda: component("unavailable", "Kanban 命令不可用", "board")
    result = SystemHealthService(degraded, cache_ttl_seconds=0).collect()
    assert result["overall_status"] == "degraded"

    unavailable = all_checks()
    unavailable["database"] = lambda: component("unavailable", "数据库检查失败")
    result = SystemHealthService(unavailable, cache_ttl_seconds=0).collect()
    assert result["overall_status"] == "unavailable"


def test_health_hides_exception_details_and_force_refresh():
    calls = {"count": 0}
    checks = all_checks()

    def database():
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("postgres://user:secret@private-host/database")
        return component()

    checks["database"] = database
    service = SystemHealthService(checks, cache_ttl_seconds=60)
    first = service.collect()
    second = service.collect(force=True)

    assert first["overall_status"] == "unavailable"
    assert "secret" not in str(first)
    assert second["overall_status"] == "ready"
    assert calls["count"] == 2


def test_health_api_passes_manual_refresh(monkeypatch):
    calls = []
    payload = {
        "ok": True,
        "checked_at": "2026-09-13T00:00:00Z",
        "overall_status": "ready",
        "components": {},
        "cached": False,
    }
    monkeypatch.setattr(
        system_controller.system_health_service,
        "collect",
        lambda *, force=False: calls.append(force) or payload,
    )
    app = Flask(__name__)
    app.register_blueprint(system_controller.bp)
    client = app.test_client()

    assert client.get("/api/system/health").status_code == 200
    assert client.get("/api/system/health?refresh=1").status_code == 200
    assert calls == [False, True]


def test_hermes_component_normalizes_failure_without_detail(monkeypatch):
    monkeypatch.setattr(
        system_health,
        "check_hermes_ready",
        lambda: {
            "ok": False,
            "reason": "timeout",
            "message": "private",
            "detail": "token=secret-value",
        },
    )

    result = system_health._check_hermes_cli()

    assert result["status"] == "unavailable"
    assert result["message"] == "Hermes CLI 检查超时"
    assert "secret-value" not in str(result)


def test_terminal_component_detects_runtime_mismatch(monkeypatch):
    monkeypatch.setattr(
        system_health.store,
        "snapshot",
        lambda: {
            "agents": [
                {"agent_id": "running", "runtime_status": "running"},
                {"agent_id": "stopped", "runtime_status": "stopped"},
            ]
        },
    )
    monkeypatch.setattr(system_health.session_pool, "is_running", lambda _: False)

    result = system_health._check_terminal()

    assert result["status"] == "degraded"
    assert "1 个 Agent" in result["message"]
    assert result["action_view"] == "members"
