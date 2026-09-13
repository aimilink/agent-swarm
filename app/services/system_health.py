from __future__ import annotations

import copy
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable
from urllib.parse import urlparse

from sqlalchemy import text

from ..config import MCP_BUS_URL, now_iso
from ..db.session import SessionLocal
from ..models.store import store
from .acp import pool as session_pool
from .kanban import KanbanError, KanbanService
from .profiles import check_hermes_ready


logger = logging.getLogger("hermes.system_health")

ComponentCheck = Callable[[], dict]
_COMPONENT_ORDER = (
    "database",
    "hermes_cli",
    "kanban",
    "mcp",
    "event_stream",
    "terminal",
)
_COMPONENT_LABELS = {
    "database": "数据库",
    "hermes_cli": "Hermes CLI",
    "kanban": "Kanban",
    "mcp": "MCP",
    "event_stream": "实时事件",
    "terminal": "Agent 终端",
}


def _result(
    status: str,
    message: str,
    recovery_action: str,
    action_view: str,
) -> dict:
    return {
        "status": status,
        "message": message,
        "recovery_action": recovery_action,
        "action_view": action_view,
    }


def _check_database() -> dict:
    with SessionLocal() as session:
        session.execute(text("SELECT 1")).scalar_one()
    return _result("ready", "数据库连接正常", "无需处理", "settings")


def _check_hermes_cli() -> dict:
    status = check_hermes_ready()
    if status.get("ok"):
        count = len(status.get("profiles") or [])
        return _result("ready", f"Hermes CLI 已就绪，发现 {count} 个 Profile", "无需处理", "members")
    reason = status.get("reason") or "unavailable"
    messages = {
        "not_found": "未检测到 Hermes CLI",
        "timeout": "Hermes CLI 检查超时",
        "no_profiles": "Hermes CLI 尚无可用 Profile",
        "command_failed": "Hermes CLI 当前不可用",
    }
    return _result(
        "unavailable",
        messages.get(reason, "Hermes CLI 当前不可用"),
        "检查 Hermes 安装、Profile 和模型配置",
        "members",
    )


def _check_kanban() -> dict:
    try:
        KanbanService(timeout=5).check_ready(timeout=5)
    except KanbanError:
        return _result(
            "unavailable",
            "Kanban 命令不可用",
            "检查 Hermes Kanban 安装与配置",
            "board",
        )
    return _result("ready", "Kanban 只读检查通过", "无需处理", "board")


def _check_mcp() -> dict:
    parsed = urlparse(MCP_BUS_URL)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return _result(
            "unavailable",
            "MCP 地址配置无效",
            "检查 HERMES_AGENTS_MCP_URL",
            "settings",
        )
    try:
        from ..mcp_server import session_manager_started

        started = session_manager_started()
    except Exception:  # noqa: BLE001
        started = False
    if not started:
        return _result(
            "degraded",
            "MCP 会话管理器尚未就绪",
            "重启服务并检查 MCP 启动日志",
            "settings",
        )
    return _result("ready", "MCP 会话管理器已就绪", "无需处理", "settings")


def _check_event_stream() -> dict:
    with SessionLocal() as session:
        session.execute(text("SELECT 1 FROM events LIMIT 1")).first()
    return _result("ready", "事件存储可用，SSE 路由已加载", "无需处理", "overview")


def _check_terminal() -> dict:
    agents = store.snapshot().get("agents", [])
    expected = [
        agent for agent in agents
        if (agent.get("runtime_status") or "stopped") == "running"
    ]
    missing = [
        agent for agent in expected
        if not session_pool.is_running(str(agent.get("agent_id") or ""))
    ]
    if missing:
        return _result(
            "degraded",
            f"{len(missing)} 个 Agent 的运行状态与终端会话不一致",
            "进入 Agent 与团队页面重启对应 Agent",
            "members",
        )
    if expected:
        return _result(
            "ready",
            f"{len(expected)} 个 Agent 终端会话运行中",
            "无需处理",
            "members",
        )
    return _result("ready", "终端服务已加载，当前没有运行会话", "无需处理", "members")


class SystemHealthService:
    def __init__(
        self,
        checks: dict[str, ComponentCheck] | None = None,
        *,
        cache_ttl_seconds: float = 30,
    ) -> None:
        self._checks = checks or {
            "database": _check_database,
            "hermes_cli": _check_hermes_cli,
            "kanban": _check_kanban,
            "mcp": _check_mcp,
            "event_stream": _check_event_stream,
            "terminal": _check_terminal,
        }
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache_lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._cached_at = 0.0
        self._cached_result: dict | None = None

    def collect(self, *, force: bool = False) -> dict:
        cached = self._read_cache() if not force else None
        if cached is not None:
            return cached

        with self._refresh_lock:
            cached = self._read_cache() if not force else None
            if cached is not None:
                return cached

            component_results: dict[str, dict] = {}
            with ThreadPoolExecutor(max_workers=len(self._checks)) as executor:
                futures = {
                    name: executor.submit(self._measure, name, check)
                    for name, check in self._checks.items()
                }
                for name in _COMPONENT_ORDER:
                    future = futures.get(name)
                    if future is not None:
                        component_results[name] = future.result()

            database_status = component_results.get("database", {}).get("status")
            if database_status == "unavailable":
                overall_status = "unavailable"
            elif any(item["status"] != "ready" for item in component_results.values()):
                overall_status = "degraded"
            else:
                overall_status = "ready"

            result = {
                "ok": True,
                "checked_at": now_iso(),
                "overall_status": overall_status,
                "components": component_results,
                "cached": False,
            }
            with self._cache_lock:
                self._cached_at = time.monotonic()
                self._cached_result = copy.deepcopy(result)
            return result

    def _read_cache(self) -> dict | None:
        now = time.monotonic()
        with self._cache_lock:
            if (
                self._cached_result is None
                or now - self._cached_at >= self._cache_ttl_seconds
            ):
                return None
            result = copy.deepcopy(self._cached_result)
        result["cached"] = True
        return result

    @staticmethod
    def _measure(name: str, check: ComponentCheck) -> dict:
        started = time.monotonic()
        try:
            result = check()
        except Exception as exc:  # noqa: BLE001
            logger.warning("health check failed component=%s error_type=%s", name, type(exc).__name__)
            result = _result(
                "unavailable",
                f"{_COMPONENT_LABELS.get(name, name)}检查失败",
                "查看服务日志并重新检测",
                "settings",
            )
        status = result.get("status")
        if status not in {"ready", "degraded", "unavailable"}:
            result = _result(
                "unavailable",
                f"{_COMPONENT_LABELS.get(name, name)}返回了无效状态",
                "查看服务日志并重新检测",
                "settings",
            )
        result["latency_ms"] = max(0, round((time.monotonic() - started) * 1000))
        return result


system_health_service = SystemHealthService()
