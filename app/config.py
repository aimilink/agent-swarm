from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path


UTC = timezone.utc
PROFILE_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
HERMES_CONTROL_MODE = os.environ.get("HERMES_CONTROL_MODE", "shared").strip().lower()
if HERMES_CONTROL_MODE not in {"shared", "isolated"}:
    raise ValueError("HERMES_CONTROL_MODE must be shared or isolated")
_default_hermes_home = (
    PROJECT_ROOT / "hermes-home"
    if HERMES_CONTROL_MODE == "isolated"
    else Path.home() / ".hermes"
)
HERMES_HOME = Path(
    os.environ.get("HERMES_HOME", str(_default_hermes_home))
).expanduser().resolve(strict=False)
HERMES_CLI = os.environ.get("HERMES_CLI", "hermes").strip() or "hermes"
HERMES_MANAGED_BY = "agentswarm"
AGENT_TEAM_WORKSPACE_ROOT = Path(
    os.environ.get("AGENT_TEAM_WORKSPACE_ROOT", str(Path.home() / "agent_team"))
).expanduser().resolve(strict=False)
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{(Path(__file__).resolve().parents[1] / 'data' / 'hermes_agent_team.db')}",
)
MCP_BUS_URL = os.environ.get(
    "HERMES_AGENTS_MCP_URL", "http://127.0.0.1:5050/mcp/"
)
KANBAN_BOARD = os.environ.get("KANBAN_BOARD", "hermes-agents-team")
KANBAN_POLL_INTERVAL = float(os.environ.get("KANBAN_POLL_INTERVAL", "2"))
KANBAN_DEFAULT_WORKSPACE = os.environ.get("KANBAN_DEFAULT_WORKSPACE", "scratch")
KANBAN_AUTO_DISPATCH = os.environ.get("KANBAN_AUTO_DISPATCH", "0") == "1"
AUTO_START_AGENTS = os.environ.get("AUTO_START_AGENTS", "1") != "0"
DEFAULT_MAX_TASK_ROUNDS = 10


def now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")
