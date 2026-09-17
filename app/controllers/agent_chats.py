from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import select, update

from ..config import now_iso
from ..db.models import AgentChatRecord
from ..db.session import SessionLocal
from ..models.store import store
from ..services.chat import _run_hermes_chat

bp = Blueprint("agent_chats", __name__, url_prefix="/api/agents/<agent_id>/chats")


def serialize(row, detail=False):
    data = {key: getattr(row, key) for key in ("chat_id", "agent_id", "title", "busy", "updated_at")}
    if row.busy:
        data["progress"] = {
            "title": "Agent 正在思考",
            "started_at": row.updated_at,
            "steps": [
                {"label": "接收用户消息", "detail": "消息已进入当前会话", "status": "complete"},
                {"label": "整理会话上下文", "detail": "已载入本次对话记录", "status": "complete"},
                {"label": "分析请求并生成回复", "detail": "正在等待 Hermes 模型返回", "status": "active"},
                {"label": "保存并展示回复", "detail": "模型返回后自动完成", "status": "pending"},
            ],
        }
    if detail:
        data["messages"] = json.loads(row.messages_json)
    return data


def recover_expired(db, agent_id):
    # A process restart or disconnected worker must not leave a chat locked forever.
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=360)).isoformat().replace("+00:00", "Z")
    rows = db.scalars(select(AgentChatRecord).where(
        AgentChatRecord.agent_id == agent_id, AgentChatRecord.busy.is_(True),
        AgentChatRecord.updated_at < cutoff,
    )).all()
    for row in rows:
        messages = json.loads(row.messages_json)
        messages.append({"role": "error", "content": "上次响应已中断，请重新发送。", "created_at": now_iso()})
        row.messages_json = json.dumps(messages, ensure_ascii=False)
        row.busy = False
    db.commit()


@bp.route("", methods=["GET", "POST"])
def chats(agent_id):
    if request.method == "POST" and not store.find_agent(agent_id):
        return jsonify(ok=False, error="Agent 不存在"), 404
    with SessionLocal() as db:
        if request.method == "POST":
            row = AgentChatRecord(chat_id=uuid.uuid4().hex, agent_id=agent_id,
                                  title="新聊天", messages_json="[]", busy=False, updated_at=now_iso())
            db.add(row)
            db.commit()
            return jsonify(ok=True, chat=serialize(row, True)), 201
        recover_expired(db, agent_id)
        rows = db.scalars(select(AgentChatRecord).where(AgentChatRecord.agent_id == agent_id)
                          .order_by(AgentChatRecord.updated_at.desc())).all()
        return jsonify(ok=True, chats=[serialize(row) for row in rows])


@bp.get("/<chat_id>")
def chat_detail(agent_id, chat_id):
    with SessionLocal() as db:
        recover_expired(db, agent_id)
        row = db.get(AgentChatRecord, chat_id)
        if row is None or row.agent_id != agent_id:
            return jsonify(ok=False, error="聊天不存在"), 404
        return jsonify(ok=True, chat=serialize(row, True))


@bp.post("/<chat_id>/messages")
def send(agent_id, chat_id):
    payload = request.get_json(silent=True)
    content = payload.get("content") if isinstance(payload, dict) else None
    if not isinstance(content, str) or not content.strip() or len(content) > 20000:
        return jsonify(ok=False, error="请输入 1–20000 字的消息"), 400
    content = content.strip()
    agent = store.find_agent(agent_id)
    if agent is None:
        return jsonify(ok=False, error="Agent 不存在"), 404
    # Team readiness tracks SOUL initialization, not whether the CLI can chat.
    # Let Hermes validate its own Profile/model configuration for direct chats.
    with SessionLocal() as db:
        row = db.get(AgentChatRecord, chat_id)
        if row is None or row.agent_id != agent_id:
            return jsonify(ok=False, error="聊天不存在"), 404
        claimed = db.execute(update(AgentChatRecord).where(
            AgentChatRecord.chat_id == chat_id, AgentChatRecord.busy.is_(False)
        ).values(busy=True, updated_at=now_iso()))
        if not claimed.rowcount:
            return jsonify(ok=False, error="正在回复，请稍候"), 409
        messages = json.loads(row.messages_json)
        messages.append({"role": "user", "content": content, "created_at": now_iso()})
        row.messages_json = json.dumps(messages, ensure_ascii=False)
        if row.title == "新聊天":
            row.title = content[:60]
        db.commit()
    # Each invocation is independent. Only this conversation's transcript is supplied.
    transcript = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "error"]
    prompt = ("这是用户与你的 Agent 对话。请直接回复最后一条用户消息。\n"
              "以下 JSON 是当前会话的聊天记录，role 表示消息来源：\n"
              + json.dumps(transcript, ensure_ascii=False))
    try:
        reply = _run_hermes_chat(agent["profile_name"], prompt)
        message = {"role": "assistant", "content": reply or "（空响应）", "created_at": now_iso()}
    except Exception:
        message = {"role": "error", "content": "Agent 回复失败，请检查 Hermes CLI 与模型配置后重试。", "created_at": now_iso()}
    with SessionLocal() as db:
        row = db.get(AgentChatRecord, chat_id)
        messages.append(message)
        row.messages_json = json.dumps(messages, ensure_ascii=False)
        row.busy = False
        row.updated_at = now_iso()
        db.commit()
        return jsonify(ok=True, chat=serialize(row, True))
