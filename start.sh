#!/usr/bin/env bash
# Hermes Agents Team - production-friendly launcher.
# This script reads exported environment variables; it does not parse .env itself.
set -euo pipefail

APP="${APP_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)}"
export HERMES_CONTROL_MODE="${HERMES_CONTROL_MODE:-shared}"
if [[ "$HERMES_CONTROL_MODE" == "shared" ]]; then
  export HERMES_HOME="${HERMES_HOME:-${HERMES_HOME_OVERRIDE:-$HOME/.hermes}}"
else
  export HERMES_HOME="${HERMES_HOME:-${HERMES_HOME_OVERRIDE:-$APP/hermes-home}}"
fi
export HERMES_CLI="${HERMES_CLI:-hermes}"
export AGENT_TEAM_WORKSPACE_ROOT="${AGENT_TEAM_WORKSPACE_ROOT:-$APP/workspace}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///$APP/data/hermes_agent_team.db}"
export HERMES_AGENTS_MCP_URL="${HERMES_AGENTS_MCP_URL:-http://127.0.0.1:5050/mcp/}"
export KANBAN_BOARD="${KANBAN_BOARD:-hermes-agents-team}"
export KANBAN_AUTO_DISPATCH="${KANBAN_AUTO_DISPATCH:-0}"
export KANBAN_POLL_INTERVAL="${KANBAN_POLL_INTERVAL:-2}"
export KANBAN_DEFAULT_WORKSPACE="${KANBAN_DEFAULT_WORKSPACE:-scratch}"
export PORT="${PORT:-5050}"
export HOST="${HOST:-127.0.0.1}"
export FLASK_DEBUG="${FLASK_DEBUG:-0}"
export AUTO_START_AGENTS="${AUTO_START_AGENTS:-1}"

cd "$APP"
exec "$APP/.venv/bin/python" run.py
