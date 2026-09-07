from __future__ import annotations

import shutil
from pathlib import Path

from ..config import AGENT_TEAM_WORKSPACE_ROOT, MCP_BUS_URL, PROFILE_NAME_RE, now_iso
from ..models.store import RuntimeStore
from . import acp, mcp_installer, profiles, registry, soul


VALID_ROLES = {"leader", "worker"}


def _safe_workspace_delete_path(workspace_path: str) -> Path:
    workspace_root = AGENT_TEAM_WORKSPACE_ROOT.resolve(strict=False)
    target = Path(workspace_path).expanduser().resolve(strict=False)
    if target == workspace_root or workspace_root not in target.parents:
        raise ValueError("workspace_path is outside the configured team workspace root")
    return target


def _delete_workspace(workspace_path: str) -> None:
    target = _safe_workspace_delete_path(workspace_path)
    if target.exists():
        shutil.rmtree(target)


def create_agent(
    store: RuntimeStore,
    *,
    name: str,
    profile_name: str,
    role: str = "worker",
    description: str = "",
    team: str = "",
) -> dict:
    """Validate input, create the hermes profile, write team-meta.json,
    register the agent, and kick off SOUL.md generation asynchronously."""
    name = name.strip()
    profile_name = profile_name.strip().lower()
    role = role.strip()
    description = description.strip()

    if not name:
        raise ValueError("name is required")
    if not PROFILE_NAME_RE.match(profile_name):
        raise ValueError(
            "profile_name must be lowercase alphanumeric (dash/underscore allowed)"
        )
    if role not in VALID_ROLES:
        raise ValueError("role must be one of leader/worker")

    if store.has_profile(profile_name):
        raise ValueError(f"profile '{profile_name}' is already registered")

    team_id: str | None = None
    if (team or "").strip():
        team_record = store.find_team_by_slug(team.strip())
        if team_record is None:
            raise ValueError(f"team '{team.strip()}' not found")
        team_id = team_record["team_id"]
        if role == "leader" and store.has_team_lead(team_id):
            raise ValueError(f"team '{team.strip()}' already has a leader")
    elif role == "leader" and store.has_team_lead(None):
        # 未分组 Leader 的唯一性仅限未分组成员。
        raise ValueError("only one leader can exist")

    workspace_path = registry.ensure_workspace(profile_name)
    created_profile = profiles.create_hermes_profile(profile_name)
    registry.skills_dir_for(profile_name).mkdir(parents=True, exist_ok=True)

    if role == "leader":
        profiles.attach_mcp_server(
            profile_name, name="agent_bus", url=MCP_BUS_URL
        )
        mcp_installer.upsert_builtin_agent_bus(profile_name)

    created_at = now_iso()
    meta = {
        "name": name,
        "role": role,
        "description": description,
        "is_leader": role == "leader",
        "created_at": created_at,
        "workspace_path": workspace_path,
        "team_id": team_id,
        "profile_origin": "created" if created_profile else "existing",
    }
    registry.write_team_meta(profile_name, meta)

    agent = {
        "agent_id": registry.agent_id_for(profile_name),
        "profile_name": profile_name,
        "status": "idle",
        "current_task": "空闲",
        "runtime_status": "stopped",
        "interaction_state": "idle",
        "orchestration_state": "none",
        "queue_depth": 0,
        "pending_interaction": None,
        "load": 0,
        "last_input": "",
        "last_output": "",
        "last_output_at": "",
        "readiness_status": "preparing",
        "readiness_message": "正在准备 Agent",
        "last_active_at": created_at,
        "team_id": team_id,
        **meta,
    }
    store.register_agent(agent)
    existing_soul = registry.soul_path_for(profile_name)
    has_existing_soul = (
        not created_profile
        and existing_soul.exists()
        and bool(existing_soul.read_text(encoding="utf-8").strip())
    )
    if has_existing_soul:
        store.update_agent(
            agent["agent_id"],
            readiness_status="ready",
            readiness_message="沿用现有 Hermes SOUL.md",
            current_task="空闲",
        )
        agent = store.find_agent(agent["agent_id"]) or agent

    store.push_event(
        "agent.created",
        agent["agent_id"],
        None,
        {
            "text": (
                f"Agent {name} 已接入团队（profile={profile_name}）；"
                + ("沿用原 Profile 数据" if not created_profile else "已创建可独立使用的 Profile")
            )
        },
    )
    store.push_agents_changed()

    if has_existing_soul:
        acp.pool.start(agent)
    else:
        soul.spawn_generate(
            store,
            agent_id=agent["agent_id"],
            name=name,
            role=role,
            description=description,
            profile_name=profile_name,
        )
    return agent


def delete_agent(store: RuntimeStore, agent_id: str) -> dict:
    agent = store.find_agent(agent_id)
    if agent is None:
        raise ValueError("agent not found")
    orchestration_state = agent.get("orchestration_state") or "none"
    is_idle = agent.get("status") == "idle" and orchestration_state == "none"
    is_unavailable = (agent.get("readiness_status") or "ready") != "ready" or (
        agent.get("runtime_status") or "stopped"
    ) != "running"
    if not (is_idle or is_unavailable):
        raise ValueError("only idle or unavailable agents can be dismissed")
    profile_name = agent["profile_name"]
    workspace_path = agent.get("workspace_path") or str(registry.workspace_path_for(profile_name))
    _safe_workspace_delete_path(workspace_path)
    acp.pool.stop(agent_id)
    # Dismiss means detach from orchestration only. The Hermes profile,
    # workspace, skills, memories and experience deliberately remain intact.
    registry.delete_team_meta(profile_name)
    store.remove_agent(agent_id)
    store.push_event(
        "agent.deleted",
        agent_id,
        None,
        {
            "text": (
                f"Agent {agent['name']} 已退出团队（profile={profile_name}）；"
                "Profile、Skill、记忆和工作区均已保留"
            )
        },
    )
    return agent
