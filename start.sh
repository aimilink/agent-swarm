#!/usr/bin/env bash
# AgentSwarm - production-friendly launcher.
# This script reads exported environment variables; it does not parse .env itself.
set -euo pipefail

# --- hostile-env guard -------------------------------------------------------
# Shells managed by agent frameworks may leak PORT/HERMES_* into the environment
# (e.g. Hermes terminal presets PORT=8648 for its own gateway). That would make
# uvicorn bind the wrong port (or die with "address already in use"). Unset the
# known-hostile vars BEFORE applying defaults, so ${VAR:-default} actually works.
unset PORT HERMES_DIR HERMES_AGENT_ROOT || true

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

# Feishu notifier (user_task completed/blocked -> Feishu DM). Credentials live
# in /root/.hermes/.env; load silently if present. Override targets via
# AGENTSWARM_FEISHU_CHAT_ID / AGENTSWARM_FEISHU_OPEN_ID.
if [[ -z "${AGENTSWARM_FEISHU_WEBHOOK:-}" && -r "$HOME/.hermes/.env" ]]; then
  _fid="$(grep -E '^FEISHU_APP_ID=' "$HOME/.hermes/.env" | head -1 | cut -d= -f2- | tr -d '\"')"
  _fsec="$(grep -E '^FEISHU_APP_SECRET=' "$HOME/.hermes/.env" | head -1 | cut -d= -f2- | tr -d '\"')"
  [[ -n "$_fid" ]] && export FEISHU_APP_ID="$_fid"
  [[ -n "$_fsec" ]] && export FEISHU_APP_SECRET="$_fsec"
  export AGENTSWARM_FEISHU_OPEN_ID="${AGENTSWARM_FEISHU_OPEN_ID:-ou_d70bb1432156a33e1dc7f33e8c576aa8}"
  unset _fid _fsec
fi

cd "$APP"
exec "$APP/.venv/bin/python" run.py
