"""团队管理 API：/api/teams CRUD + 按团队消息入口。"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..models.store import store
from ..services import messages as messages_service
from ..services import teams as teams_service


bp = Blueprint("teams", __name__, url_prefix="/api/teams")


@bp.get("")
def list_teams():
    teams = []
    for team in store.list_teams():
        try:
            detail = teams_service.team_detail(store, team["slug"])
        except ValueError:
            detail = {**team, "members": [], "member_count": 0}
        teams.append(detail)
    return jsonify({"ok": True, "teams": teams})


@bp.post("")
def create_team():
    payload = request.get_json(silent=True) or {}
    try:
        team = teams_service.create_team(
            store,
            slug=payload.get("slug") or "",
            name=payload.get("name") or "",
            description=payload.get("description") or "",
            board_name=payload.get("board_name") or "",
        )
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    return jsonify({"ok": True, "team": team}), 201


@bp.get("/<slug>")
def get_team(slug: str):
    try:
        detail = teams_service.team_detail(store, slug)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 404
    return jsonify({"ok": True, "team": detail})


@bp.patch("/<slug>")
def update_team(slug: str):
    team = store.find_team_by_slug(slug)
    if team is None:
        return jsonify({"ok": False, "error": "team not found"}), 404
    payload = request.get_json(silent=True) or {}
    try:
        updated = teams_service.update_team(
            store,
            team["team_id"],
            name=payload.get("name"),
            description=payload.get("description"),
            board_name=payload.get("board_name"),
            settings=payload.get("settings") if isinstance(payload.get("settings"), dict) else None,
        )
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    return jsonify({"ok": True, "team": updated})


@bp.delete("/<slug>")
def delete_team(slug: str):
    team = store.find_team_by_slug(slug)
    if team is None:
        return jsonify({"ok": False, "error": "team not found"}), 404
    try:
        removed = teams_service.delete_team(store, team["team_id"])
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    return jsonify({"ok": True, "team": removed})


@bp.post("/<slug>/messages")
def send_team_message(slug: str):
    """团队任务入口：路由到该团队 lead（没有 lead 时 400）。"""
    team = store.find_team_by_slug(slug)
    if team is None:
        return jsonify({"ok": False, "error": f"team '{slug}' not found"}), 404
    lead_agent_id = store.find_team_lead_agent_id(team["team_id"])
    if not lead_agent_id:
        return jsonify({"ok": False, "error": f"team '{slug}' has no dispatchable leader"}), 400
    payload = request.get_json(silent=True) or {}
    content = (payload.get("content") or "").strip()
    if not content:
        return jsonify({"ok": False, "error": "content is required"}), 400
    try:
        message = messages_service.send_user_task(
            store,
            content=content,
            to_agent_id=lead_agent_id,
        )
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 500
    return jsonify({"ok": True, "message": message, "team": {"slug": slug}}), 201


@bp.get("/<slug>/usage")
def team_usage(slug: str):
    """团队级 token 用量统计（从 agent 日志聚合）。?days=7 可调。"""
    days = request.args.get("days", 7, type=int) or 7
    from ..services import usage_stats

    try:
        result = usage_stats.team_usage(store, slug, days=min(max(days, 1), 30))
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 404
    return jsonify({"ok": True, "usage": result})


@bp.post("/<slug>/members")
def assign_member(slug: str):
    """把已有 agent 加入团队（body: {agent_id}）。"""
    team = store.find_team_by_slug(slug)
    if team is None:
        return jsonify({"ok": False, "error": f"team '{slug}' not found"}), 404
    payload = request.get_json(silent=True) or {}
    agent_id = (payload.get("agent_id") or "").strip()
    if not agent_id:
        return jsonify({"ok": False, "error": "agent_id is required"}), 400
    try:
        agent = teams_service.assign_agent_team(store, agent_id, team["team_id"])
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    return jsonify({"ok": True, "agent": agent})


@bp.delete("/<slug>/members/<agent_id>")
def remove_member(slug: str, agent_id: str):
    team = store.find_team_by_slug(slug)
    if team is None:
        return jsonify({"ok": False, "error": f"team '{slug}' not found"}), 404
    agent = store.find_agent(agent_id)
    if agent is None or agent.get("team_id") != team["team_id"]:
        return jsonify({"ok": False, "error": "agent not in this team"}), 404
    try:
        teams_service.assign_agent_team(store, agent_id, None)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    return jsonify({"ok": True})
