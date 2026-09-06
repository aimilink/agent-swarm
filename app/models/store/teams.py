from __future__ import annotations

import re
import uuid

from ...config import now_iso


TEAM_SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{1,40}[a-z0-9]$")


def _team_ulid() -> str:
    return uuid.uuid4().hex[:16]


class TeamsMixin:
    """多团队：teams 的内存态操作 + 持久化。

    team_id: team_xxx（ulid）；slug: URL 标识（如 sales/tech）；board_name 默认 team-{slug}。
    """

    def list_teams(self) -> list[dict]:
        return [dict(team) for team in self.teams]

    def find_team_by_slug(self, slug: str) -> dict | None:
        slug = (slug or "").strip()
        for team in self.teams:
            if team.get("slug") == slug:
                return dict(team)
        return None

    def find_team(self, team_id: str) -> dict | None:
        for team in self.teams:
            if team.get("team_id") == team_id:
                return dict(team)
        return None

    def create_team(self, *, slug: str, name: str, description: str = "", board_name: str = "", settings: dict | None = None) -> dict:
        slug = (slug or "").strip()
        if not TEAM_SLUG_RE.match(slug):
            raise ValueError("slug must be lowercase alphanumeric with dashes (3-42 chars), e.g. sales / tech / market")
        if self.find_team_by_slug(slug) is not None:
            raise ValueError(f"team slug '{slug}' already exists")
        team = {
            "team_id": f"team_{_team_ulid()}",
            "slug": slug,
            "name": (name or "").strip() or slug,
            "description": (description or "").strip(),
            "board_name": (board_name or "").strip() or f"team-{slug}",
            "settings": settings or {},
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        with self._lock:
            self.teams.append(dict(team))
            self._persist("upsert_team", team)
        self.push_event("team.created", "", None, {"team_id": team["team_id"], "slug": slug, "name": team["name"]})
        return team

    def update_team(self, team_id: str, **patch) -> dict:
        team = next((t for t in self.teams if t.get("team_id") == team_id), None)
        if team is None:
            raise ValueError("team not found")
        for key in ("name", "description", "board_name"):
            if key in patch and patch[key] is not None:
                team[key] = str(patch[key]).strip()
        if isinstance(patch.get("settings"), dict):
            merged = dict(team.get("settings") or {})
            merged.update(patch["settings"])
            team["settings"] = merged
        team["updated_at"] = now_iso()
        with self._lock:
            self._persist("upsert_team", team)
        self.push_event("team.updated", "", None, {"team_id": team_id, "slug": team.get("slug")})
        return dict(team)

    def delete_team(self, team_id: str) -> dict:
        team = next((t for t in self.teams if t.get("team_id") == team_id), None)
        if team is None:
            raise ValueError("team not found")
        members = [a for a in self.agents if a.get("team_id") == team_id]
        if members:
            raise ValueError(f"team still has {len(members)} member agent(s); move or delete them first")
        with self._lock:
            self.teams = [t for t in self.teams if t.get("team_id") != team_id]
            self._persist("soft_delete_team", team_id, now_iso())
        self.push_event("team.deleted", "", None, {"team_id": team_id, "slug": team.get("slug")})
        return dict(team)

    # ---- 团队视角查询 ----

    def team_agents(self, team_id: str) -> list[dict]:
        return [dict(a) for a in self.agents if a.get("team_id") == team_id]

    def has_team_lead(self, team_id: str | None) -> bool:
        return any(
            a.get("team_id") == team_id and a.get("role") == "leader"
            for a in self.agents
        )

    def find_team_lead_agent_id(self, team_id: str) -> str | None:
        from ...services.agent_status import is_agent_dispatchable

        leads = [
            a
            for a in self.agents
            if a.get("team_id") == team_id and a.get("role") == "leader"
        ]
        for lead in leads:
            if is_agent_dispatchable(lead):
                return lead["agent_id"]
        return None

    def assign_agent_team(self, agent_id: str, team_id: str | None) -> dict:
        with self._lock:
            agent = next((a for a in self.agents if a["agent_id"] == agent_id), None)
            if agent is None:
                raise ValueError("agent not found")
            if team_id is not None and not any(t["team_id"] == team_id for t in self.teams):
                raise ValueError("team not found")
            if (
                agent.get("role") == "leader"
                and any(
                    a.get("team_id") == team_id and a.get("role") == "leader" and a.get("agent_id") != agent_id
                    for a in self.agents
                )
            ):
                raise ValueError("target team already has a leader")
            agent["team_id"] = team_id
            agent["last_active_at"] = now_iso()
            snapshot = dict(agent)
            self._persist("upsert_agent", snapshot)
        self.push_agents_changed()
        self.push_event("agent.team_assigned", agent_id, None, {"team_id": team_id})
        return snapshot
