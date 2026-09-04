#!/usr/bin/env bash
# Hermes Agents Team - shared mode directly orchestrates the normal Hermes home.
# Set HERMES_CONTROL_MODE=isolated to preserve the historical isolated deployment.
set -euo pipefail

APP=/opt/hermes-agent-team
export HERMES_CONTROL_MODE="${HERMES_CONTROL_MODE:-shared}"
if [[ "$HERMES_CONTROL_MODE" == "shared" ]]; then
  export HERMES_HOME="${HERMES_HOME_OVERRIDE:-$HOME/.hermes}"
else
  export HERMES_HOME="${HERMES_HOME_OVERRIDE:-$APP/hermes-home}"
fi
export AGENT_TEAM_WORKSPACE_ROOT="$APP/workspace"
export DATABASE_URL="sqlite:////opt/hermes-agent-team/data/hermes_agent_team.db"
export HERMES_AGENTS_MCP_URL="http://127.0.0.1:5050/mcp/"
export KANBAN_BOARD="hermes-agents-team"
export KANBAN_AUTO_DISPATCH="${KANBAN_AUTO_DISPATCH:-0}"
export KANBAN_POLL_INTERVAL="${KANBAN_POLL_INTERVAL:-10}"
export PORT=5050
export HOST=0.0.0.0
export FLASK_DEBUG=0
export AUTO_START_AGENTS=1

cd "$APP"
exec "$APP/.venv/bin/python" run.py
