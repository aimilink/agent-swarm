#!/bin/bash
# AgentWeave 自启 (shared 模式, 只读 /root/.hermes 现有 profiles)
cd /opt/hermes-agent-team
exec env HOST=0.0.0.0 PORT=5050 HERMES_CONTROL_MODE=shared .venv/bin/python run.py >> /tmp/agentweave-127.log 2>&1
