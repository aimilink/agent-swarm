from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.system_health import system_health_service


bp = Blueprint("system", __name__, url_prefix="/api/system")


@bp.get("/health")
def health():
    force = str(request.args.get("refresh") or "").lower() in {"1", "true", "yes"}
    return jsonify(system_health_service.collect(force=force))
