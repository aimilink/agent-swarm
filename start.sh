#!/usr/bin/env bash
# Hermes Agents Team - 隔离部署启动脚本
# 完全隔离于真实 /root/.hermes，使用独立 HERMES_HOME / workspace / DB / 端口
set -euo pipefail

APP=/opt/hermes-agent-team
export HERMES_HOME="$APP/hermes-home"
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
