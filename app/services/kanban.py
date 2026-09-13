from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from ..config import HERMES_CLI, HERMES_HOME, KANBAN_BOARD, KANBAN_DEFAULT_WORKSPACE
from .profiles import hermes_command_env


class KanbanError(RuntimeError):
    pass


class KanbanService:
    def __init__(self, *, board: str = KANBAN_BOARD, timeout: int = 60) -> None:
        self.board = board
        self.timeout = timeout

    def ensure_board(self) -> None:
        try:
            boards = self._run_json(["boards", "list", "--json"], scoped=False)
        except KanbanError:
            boards = []
        if not _contains_board(boards, self.board):
            self._run(
                [
                    "boards",
                    "create",
                    self.board,
                    "--name",
                    _title_from_slug(self.board),
                ],
                scoped=False,
            )

    def check_ready(self, *, timeout: int = 5) -> Any:
        """Run a bounded, read-only probe against the Kanban CLI."""
        return self._run_json(["boards", "list", "--json"], scoped=False, timeout=timeout)

    def reset_board(self) -> dict[str, Any]:
        if self.board == "default":
            raise KanbanError("default board cannot be reset")
        try:
            delete_output = self._run(
                ["boards", "rm", self.board, "--delete"],
                scoped=False,
            )
        except KanbanError as exc:
            if "does not exist" not in str(exc):
                raise
            delete_output = ""
        create_output = self._run(
            ["boards", "create", self.board, "--name", _title_from_slug(self.board)],
            scoped=False,
        )
        return {"board": self.board, "deleted": bool(delete_output), "output": create_output}

    def create_task(
        self,
        title: str,
        *,
        body: str,
        assignee: str | None,
        parent: str | list[str] | None = None,
        workspace: str = KANBAN_DEFAULT_WORKSPACE,
        priority: int | None = None,
        idempotency_key: str | None = None,
        skills: list[str] | None = None,
    ) -> dict[str, Any]:
        self.ensure_board()
        args = [
            "create",
            title,
            "--body",
            body,
            "--workspace",
            workspace,
            "--json",
        ]
        if assignee:
            args.extend(["--assignee", assignee])
        parents = [parent] if isinstance(parent, str) else list(parent or [])
        for parent_id in parents:
            if parent_id:
                args.extend(["--parent", parent_id])
        if priority is not None:
            args.extend(["--priority", str(priority)])
        if idempotency_key:
            args.extend(["--idempotency-key", idempotency_key])
        for skill in skills or []:
            args.extend(["--skill", skill])
        return self._run_json(args)

    def list_tasks(
        self,
        *,
        status: str | None = None,
        assignee: str | None = None,
        archived: bool = False,
    ) -> list[dict[str, Any]]:
        args = ["list", "--json"]
        if status:
            args.extend(["--status", status])
        if assignee:
            args.extend(["--assignee", assignee])
        if archived:
            args.append("--archived")
        data = self._run_json(args)
        return data if isinstance(data, list) else data.get("tasks", [])

    def show_task(self, task_id: str) -> dict[str, Any]:
        return self._run_json(["show", task_id, "--json"])

    def runs(self, task_id: str) -> Any:
        return self._run_json(["runs", task_id, "--json"])

    def log(self, task_id: str, *, tail: int | None = None) -> str:
        args = ["log", task_id]
        if tail is not None:
            args.extend(["--tail", str(tail)])
        cli_error = None
        try:
            output = self._run(args)
            if output:
                return output
        except KanbanError as exc:
            cli_error = exc
        for candidate in (self._worker_log_path(task_id), _legacy_worker_log_path(task_id)):
            try:
                if candidate.exists():
                    return _tail_text(candidate, tail=tail)
            except OSError:
                continue
        if cli_error is not None:
            raise cli_error
        return ""

    def context(self, task_id: str) -> str:
        return self._run(["context", task_id])

    def complete_task(
        self,
        task_id: str,
        *,
        result: str,
        summary: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        args = ["complete", task_id, "--result", result]
        if summary:
            args.extend(["--summary", summary])
        if metadata is not None:
            args.extend(["--metadata", json.dumps(metadata, ensure_ascii=False)])
        return self._run(args)

    def dispatch_once(self, *, max_workers: int | None = None) -> Any:
        args = ["dispatch", "--json"]
        if max_workers is not None:
            args.extend(["--max", str(max_workers)])
        return self._run_json(args, timeout=600)

    def dispatch_one(self, task_id: str, *, assignee: str) -> dict[str, Any]:
        claim_output = self._run(["claim", task_id], timeout=30)
        workspace = _workspace_from_claim_output(claim_output)
        log_path = self._worker_log_path(task_id)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        env = hermes_command_env()
        env["HERMES_KANBAN_TASK"] = task_id
        env["HERMES_KANBAN_WORKSPACE"] = workspace
        env["HERMES_KANBAN_BOARD"] = self.board
        env["HERMES_PROFILE"] = assignee
        with log_path.open("ab") as log_file:
            proc = subprocess.Popen(
                [
                    HERMES_CLI,
                    "-p",
                    assignee,
                    "--skills",
                    "kanban-worker",
                    "chat",
                    "-q",
                    f"work kanban task {task_id}",
                ],
                cwd=workspace if os.path.isdir(workspace) else None,
                stdin=subprocess.DEVNULL,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                env=env,
                start_new_session=True,
            )
        return {"spawned": [{"task_id": task_id, "assignee": assignee, "workspace": workspace, "pid": proc.pid}]}

    def assign_task(self, task_id: str, profile: str) -> str:
        return self._run(["assign", task_id, profile])

    def unblock_task(self, task_id: str) -> str:
        return self._run(["unblock", task_id])

    def archive_task(self, task_id: str) -> str:
        return self._run(["archive", task_id])

    def archive_tasks(self, task_ids: list[str]) -> str:
        ids = [task_id for task_id in task_ids if task_id]
        if not ids:
            return ""
        return self._run(["archive", *ids])

    def _base_args(self, *, scoped: bool = True) -> list[str]:
        if scoped:
            return [HERMES_CLI, "kanban", "--board", self.board]
        return [HERMES_CLI, "kanban"]

    def _run(self, args: list[str], *, scoped: bool = True, timeout: int | None = None) -> str:
        try:
            result = subprocess.run(
                [*self._base_args(scoped=scoped), *args],
                capture_output=True,
                text=True,
                timeout=timeout if timeout is not None else self.timeout,
                start_new_session=True,
                env=hermes_command_env(),
            )
        except FileNotFoundError as exc:
            raise KanbanError("hermes CLI not found in PATH") from exc
        except subprocess.TimeoutExpired as exc:
            raise KanbanError("hermes kanban command timed out") from exc
        output = (result.stdout or "").strip()
        error = (result.stderr or "").strip()
        if result.returncode != 0 or output.startswith("kanban:") or error.startswith("kanban:"):
            detail = (error or output or "hermes kanban failed").strip()
            raise KanbanError(detail)
        return output

    def _run_json(self, args: list[str], *, scoped: bool = True, timeout: int | None = None) -> Any:
        output = self._run(args, scoped=scoped, timeout=timeout)
        if not output:
            return {}
        try:
            return json.loads(output)
        except json.JSONDecodeError as exc:
            raise KanbanError(f"invalid hermes kanban JSON output: {output[:200]}") from exc

    def _worker_log_path(self, task_id: str):
        return _worker_logs_dir(self.board) / f"{task_id}.log"


def extract_task_id(payload: dict[str, Any]) -> str:
    for key in ("task_id", "id", "key"):
        value = payload.get(key)
        if value:
            return str(value)
    for key in ("task", "card", "created", "data"):
        task = payload.get(key)
        if isinstance(task, dict):
            return extract_task_id(task)
    raise KanbanError("kanban task id missing from CLI response")


def task_status(payload: dict[str, Any]) -> str:
    value = payload.get("status") or payload.get("state")
    if value:
        return str(value)
    for key in ("task", "card", "created", "data"):
        task = payload.get(key)
        if isinstance(task, dict):
            return task_status(task)
    return ""


def task_result(payload: dict[str, Any]) -> str:
    for key in ("result", "summary", "latest_summary"):
        value = payload.get(key)
        if value:
            return str(value)
    for key in ("task", "card", "created", "data"):
        task = payload.get(key)
        if isinstance(task, dict):
            return task_result(task)
    return ""


def _contains_board(payload: Any, board: str) -> bool:
    items = payload if isinstance(payload, list) else payload.get("boards", [])
    for item in items:
        if isinstance(item, dict) and item.get("slug") == board:
            return True
        if item == board:
            return True
    return False


def _workspace_from_claim_output(output: str) -> str:
    for line in output.splitlines():
        if line.startswith("Workspace:"):
            value = line.split(":", 1)[1].strip()
            if " @ " in value:
                return value.rsplit(" @ ", 1)[1].strip()
            if value.startswith("dir:"):
                return value.split(":", 1)[1].strip()
            return value
    return ""


def _worker_logs_dir(board: str) -> Path:
    slug = (board or "default").strip() or "default"
    home = HERMES_HOME
    if slug == "default":
        return home / "kanban" / "logs"
    return home / "kanban" / "boards" / slug / "logs"


def _legacy_worker_log_path(task_id: str) -> Path:
    home = HERMES_HOME
    return home / "kanban" / "logs" / f"{task_id}.log"


def _tail_text(path: Path, *, tail: int | None = None) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    if tail is None or tail <= 0 or len(text) <= tail:
        return text
    return text[-tail:]


def _title_from_slug(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.replace("_", "-").split("-") if part)


kanban_service = KanbanService()


# ---- 多团队：每团队一个 KanbanService 实例（board 隔离） ----
_board_services: dict[str, "KanbanService"] = {kanban_service.board: kanban_service}


def kanban_service_for_board(board_name: str) -> "KanbanService":
    """按 board 名取（或惰性建）KanbanService。团队板名来自 teams.board_name。"""
    board = (board_name or "").strip() or KANBAN_BOARD
    if board == KANBAN_BOARD:
        return kanban_service
    service = _board_services.get(board)
    if service is None:
        service = KanbanService(board=board)
        _board_services[board] = service
    return service


def all_board_services() -> list["KanbanService"]:
    """默认板 + 当前所有团队板（团队表驱动）。供 sync/dispatch 全板轮询。"""
    from ..models.store import default_store

    services = [kanban_service]
    try:
        for team in default_store.list_teams():
            board = (team.get("board_name") or "").strip()
            if board and board != KANBAN_BOARD:
                services.append(kanban_service_for_board(board))
    except Exception:  # noqa: BLE001 - store 不可用时退化为单板
        pass
    # 去重（保持顺序）
    seen: set[str] = set()
    unique: list["KanbanService"] = []
    for s in services:
        if s.board not in seen:
            seen.add(s.board)
            unique.append(s)
    return unique
