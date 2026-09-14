from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services import a2a


bp = Blueprint("a2a", __name__, url_prefix="/api/a2a")


def _error(exc: ValueError):
    message = str(exc)
    status = 404 if "不存在" in message else 400
    return jsonify({"ok": False, "error": message}), status


@bp.get("/conversations")
def conversations():
    agent_id = str(request.args.get("agent_id") or "").strip()
    try:
        rows = a2a.list_conversations(agent_id)
    except ValueError as exc:
        return _error(exc)
    return jsonify({"ok": True, "conversations": rows})


@bp.post("/conversations")
def create_conversation():
    payload = request.get_json(silent=True) or {}
    try:
        conversation = a2a.create_conversation(
            str(payload.get("participant_a_id") or ""),
            str(payload.get("participant_b_id") or ""),
            title=str(payload.get("title") or ""),
        )
    except ValueError as exc:
        return _error(exc)
    return jsonify({"ok": True, "conversation": conversation}), 201


@bp.get("/conversations/<conversation_id>")
def conversation_detail(conversation_id: str):
    viewer_agent_id = str(request.args.get("agent_id") or "").strip()
    try:
        conversation = a2a.get_conversation(
            conversation_id,
            viewer_agent_id=viewer_agent_id,
        )
    except ValueError as exc:
        return _error(exc)
    return jsonify({"ok": True, "conversation": conversation})


@bp.post("/conversations/<conversation_id>/messages")
def send_message(conversation_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        result = a2a.send_message(
            conversation_id,
            str(payload.get("sender_agent_id") or ""),
            payload.get("content") if isinstance(payload.get("content"), str) else "",
        )
    except ValueError as exc:
        return _error(exc)
    return jsonify({"ok": True, **result}), 202


@bp.post("/messages/<message_id>/retry")
def retry_message(message_id: str):
    try:
        result = a2a.retry_message(message_id)
    except ValueError as exc:
        return _error(exc)
    return jsonify({"ok": True, **result}), 202
