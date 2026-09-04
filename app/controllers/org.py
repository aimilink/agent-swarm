"""组织级入口：跨团队任务自动路由。"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..models.store import store
from ..services import teams as teams_service


bp = Blueprint("org", __name__, url_prefix="/api/org")


@bp.post("/dispatch")
def org_dispatch():
    payload = request.get_json(silent=True) or {}
    content = (payload.get("content") or "").strip()
    if not content:
        return jsonify({"ok": False, "error": "content is required"}), 400
    try:
        result = teams_service.org_dispatch(store, content=content)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 500
    return jsonify({"ok": True, **result}), 201
