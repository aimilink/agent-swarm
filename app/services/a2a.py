from __future__ import annotations

import uuid

from sqlalchemy import or_, select, update

from ..config import now_iso
from ..db.models import A2AConversationRecord, A2AMessageRecord
from ..db.session import SessionLocal
from ..models.store import store


MAX_MESSAGE_CHARS = 20_000
RETRYABLE_STATUSES = {"queued", "failed"}


def _agent(agent_id: str) -> dict:
    agent = store.find_agent((agent_id or "").strip())
    if agent is None:
        raise ValueError(f"Agent 不存在：{agent_id}")
    return agent


def _participants(row: A2AConversationRecord) -> tuple[str, str]:
    return row.participant_a_id, row.participant_b_id


def _agent_summaries() -> dict[str, dict]:
    return {
        agent["agent_id"]: {
            "agent_id": agent["agent_id"],
            "name": agent.get("name") or agent["agent_id"],
            "profile_name": agent.get("profile_name") or "",
            "team_id": agent.get("team_id"),
            "runtime_status": agent.get("runtime_status") or "stopped",
            "readiness_status": agent.get("readiness_status") or "ready",
        }
        for agent in store.snapshot().get("agents", [])
    }


def _serialize_conversation(row: A2AConversationRecord, agents: dict[str, dict]) -> dict:
    participant_ids = list(_participants(row))
    return {
        "conversation_id": row.conversation_id,
        "title": row.title,
        "status": row.status,
        "participant_ids": participant_ids,
        "participants": [
            agents.get(agent_id, {"agent_id": agent_id, "name": agent_id})
            for agent_id in participant_ids
        ],
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_message(row: A2AMessageRecord, agents: dict[str, dict]) -> dict:
    return {
        "message_id": row.message_id,
        "conversation_id": row.conversation_id,
        "sender_agent_id": row.sender_agent_id,
        "sender_name": agents.get(row.sender_agent_id, {}).get("name", row.sender_agent_id),
        "recipient_agent_id": row.recipient_agent_id,
        "recipient_name": agents.get(row.recipient_agent_id, {}).get("name", row.recipient_agent_id),
        "content": row.content,
        "status": row.status,
        "reply_to_message_id": row.reply_to_message_id,
        "created_at": row.created_at,
        "delivered_at": row.delivered_at,
        "completed_at": row.completed_at,
        "error": row.error,
    }


def create_conversation(
    participant_a_id: str,
    participant_b_id: str,
    *,
    title: str = "",
) -> dict:
    first = _agent(participant_a_id)
    second = _agent(participant_b_id)
    if first["agent_id"] == second["agent_id"]:
        raise ValueError("A2A 对话需要两个不同的 Agent")
    participant_ids = sorted((first["agent_id"], second["agent_id"]))
    now = now_iso()
    row = A2AConversationRecord(
        conversation_id=f"a2a_{uuid.uuid4().hex}",
        participant_a_id=participant_ids[0],
        participant_b_id=participant_ids[1],
        title=(title or "").strip()[:200]
        or f"{first.get('name') or first['agent_id']} ↔ {second.get('name') or second['agent_id']}",
        status="active",
        created_at=now,
        updated_at=now,
    )
    with SessionLocal.begin() as session:
        session.add(row)
    store.push_event(
        "a2a.conversation.created",
        first["agent_id"],
        None,
        {"conversation_id": row.conversation_id, "participant_ids": participant_ids},
    )
    return get_conversation(row.conversation_id)


def list_conversations(agent_id: str = "", *, limit: int = 100) -> list[dict]:
    query = select(A2AConversationRecord).order_by(
        A2AConversationRecord.updated_at.desc()
    ).limit(max(1, min(int(limit), 200)))
    if agent_id:
        _agent(agent_id)
        query = query.where(
            or_(
                A2AConversationRecord.participant_a_id == agent_id,
                A2AConversationRecord.participant_b_id == agent_id,
            )
        )
    agents = _agent_summaries()
    with SessionLocal() as session:
        rows = session.scalars(query).all()
        return [_serialize_conversation(row, agents) for row in rows]


def get_conversation(conversation_id: str, *, viewer_agent_id: str = "") -> dict:
    agents = _agent_summaries()
    with SessionLocal() as session:
        row = session.get(A2AConversationRecord, conversation_id)
        if row is None:
            raise ValueError("A2A 对话不存在")
        if viewer_agent_id and viewer_agent_id not in _participants(row):
            raise ValueError("Agent 不是该 A2A 对话的参与者")
        messages = session.scalars(
            select(A2AMessageRecord)
            .where(A2AMessageRecord.conversation_id == conversation_id)
            .order_by(A2AMessageRecord.created_at, A2AMessageRecord.message_id)
        ).all()
        result = _serialize_conversation(row, agents)
        result["messages"] = [_serialize_message(message, agents) for message in messages]
        return result


def send_message(conversation_id: str, sender_agent_id: str, content: str) -> dict:
    content = (content or "").strip()
    if not content or len(content) > MAX_MESSAGE_CHARS:
        raise ValueError(f"请输入 1–{MAX_MESSAGE_CHARS} 字的消息")
    sender = _agent(sender_agent_id)
    with SessionLocal.begin() as session:
        conversation = session.get(A2AConversationRecord, conversation_id)
        if conversation is None:
            raise ValueError("A2A 对话不存在")
        participant_ids = _participants(conversation)
        if sender["agent_id"] not in participant_ids:
            raise ValueError("发送 Agent 不是该 A2A 对话的参与者")
        recipient_id = (
            participant_ids[1]
            if participant_ids[0] == sender["agent_id"]
            else participant_ids[0]
        )
        message = A2AMessageRecord(
            message_id=f"a2am_{uuid.uuid4().hex}",
            conversation_id=conversation_id,
            sender_agent_id=sender["agent_id"],
            recipient_agent_id=recipient_id,
            content=content,
            status="queued",
            reply_to_message_id=None,
            created_at=now_iso(),
            delivered_at=None,
            completed_at=None,
            error="",
        )
        session.add(message)
        conversation.updated_at = message.created_at
    delivery_status = dispatch_message(message.message_id)
    store.push_event(
        "a2a.message.created",
        sender["agent_id"],
        None,
        {
            "conversation_id": conversation_id,
            "message_id": message.message_id,
            "recipient_agent_id": recipient_id,
            "status": delivery_status,
        },
    )
    return {
        "conversation": get_conversation(conversation_id),
        "message_id": message.message_id,
        "delivery_status": delivery_status,
    }


def _delivery_prompt(message: A2AMessageRecord, sender: dict) -> str:
    return (
        "[SYSTEM_A2A_MESSAGE]\n"
        f"conversation_id: {message.conversation_id}\n"
        f"message_id: {message.message_id}\n"
        f"from_agent_id: {message.sender_agent_id}\n"
        f"from_name: {sender.get('name') or message.sender_agent_id}\n\n"
        "这是另一个 Agent 发来的直接对话消息。请直接回复对方的问题或内容。"
        "本次回复会自动保存到 A2A 会话；不要创建 Kanban 任务，不要自动继续追问。\n\n"
        f"{message.content}"
    )


def dispatch_message(message_id: str) -> str:
    with SessionLocal() as session:
        message = session.get(A2AMessageRecord, message_id)
        if message is None:
            raise ValueError("A2A 消息不存在")
        if message.status not in RETRYABLE_STATUSES:
            return message.status
        recipient = store.find_agent(message.recipient_agent_id)
        sender = store.find_agent(message.sender_agent_id)
        if recipient is None or sender is None:
            _set_message_status(message_id, "failed", error="Agent 已不存在")
            return "failed"

    from .acp import pool as session_pool

    if (
        (recipient.get("readiness_status") or "ready") != "ready"
        or not session_pool.is_running(recipient["agent_id"])
    ):
        _set_message_status(message_id, "queued", error="")
        return "queued"

    delivered_at = now_iso()
    with SessionLocal.begin() as session:
        claimed = session.execute(
            update(A2AMessageRecord)
            .where(
                A2AMessageRecord.message_id == message_id,
                A2AMessageRecord.status.in_(RETRYABLE_STATUSES),
            )
            .values(status="delivered", delivered_at=delivered_at, error="")
        )
        if not claimed.rowcount:
            current = session.get(A2AMessageRecord, message_id)
            return current.status if current is not None else "failed"
    try:
        session_pool.prompt(
            recipient["agent_id"],
            _delivery_prompt(message, sender),
            a2a_message_id=message.message_id,
            a2a_conversation_id=message.conversation_id,
        )
    except Exception:  # noqa: BLE001
        _set_message_status(message_id, "queued", delivered_at=None, error="")
        return "queued"
    return "delivered"


def _set_message_status(
    message_id: str,
    status: str,
    *,
    delivered_at: str | None | object = ...,
    completed_at: str | None | object = ...,
    error: str | None = None,
) -> None:
    with SessionLocal.begin() as session:
        row = session.get(A2AMessageRecord, message_id)
        if row is None:
            return
        row.status = status
        if delivered_at is not ...:
            row.delivered_at = delivered_at
        if completed_at is not ...:
            row.completed_at = completed_at
        if error is not None:
            row.error = error
        conversation = session.get(A2AConversationRecord, row.conversation_id)
        if conversation is not None:
            conversation.updated_at = now_iso()


def complete_delivery(
    message_id: str,
    responder_agent_id: str,
    reply: str,
    *,
    failed: bool = False,
) -> dict | None:
    with SessionLocal.begin() as session:
        original = session.get(A2AMessageRecord, message_id)
        if original is None:
            return None
        if original.recipient_agent_id != responder_agent_id:
            raise ValueError("A2A 回复 Agent 与接收方不一致")
        existing = session.scalar(
            select(A2AMessageRecord).where(
                A2AMessageRecord.reply_to_message_id == message_id
            )
        )
        if existing is not None or original.status == "completed":
            conversation_id = original.conversation_id
        elif failed:
            original.status = "failed"
            original.completed_at = now_iso()
            original.error = "目标 Agent 处理失败，请重试"
            conversation_id = original.conversation_id
        else:
            completed_at = now_iso()
            original.status = "completed"
            original.completed_at = completed_at
            original.error = ""
            session.add(
                A2AMessageRecord(
                    message_id=f"a2am_{uuid.uuid4().hex}",
                    conversation_id=original.conversation_id,
                    sender_agent_id=responder_agent_id,
                    recipient_agent_id=original.sender_agent_id,
                    content=(reply or "").strip() or "（空响应）",
                    status="completed",
                    reply_to_message_id=message_id,
                    created_at=completed_at,
                    delivered_at=completed_at,
                    completed_at=completed_at,
                    error="",
                )
            )
            conversation_id = original.conversation_id
        conversation = session.get(A2AConversationRecord, conversation_id)
        if conversation is not None:
            conversation.updated_at = now_iso()

    store.push_event(
        "a2a.message.failed" if failed else "a2a.message.completed",
        responder_agent_id,
        None,
        {"conversation_id": conversation_id, "message_id": message_id},
    )
    return get_conversation(conversation_id)


def retry_message(message_id: str) -> dict:
    with SessionLocal() as session:
        row = session.get(A2AMessageRecord, message_id)
        if row is None:
            raise ValueError("A2A 消息不存在")
        if row.reply_to_message_id:
            raise ValueError("A2A 回复消息不能重试")
        if row.status not in RETRYABLE_STATUSES:
            raise ValueError("该 A2A 消息当前不能重试")
        conversation_id = row.conversation_id
    _set_message_status(
        message_id,
        "queued",
        delivered_at=None,
        completed_at=None,
        error="",
    )
    delivery_status = dispatch_message(message_id)
    return {
        "conversation": get_conversation(conversation_id),
        "message_id": message_id,
        "delivery_status": delivery_status,
    }


def recover_interrupted_deliveries() -> int:
    """Return process-local in-flight messages to the durable queue on boot."""
    with SessionLocal.begin() as session:
        result = session.execute(
            update(A2AMessageRecord)
            .where(A2AMessageRecord.status == "delivered")
            .values(status="queued", delivered_at=None, error="")
        )
        return int(result.rowcount or 0)


def dispatch_queued_for_agent(agent_id: str) -> int:
    with SessionLocal() as session:
        ids = list(
            session.scalars(
                select(A2AMessageRecord.message_id)
                .where(
                    A2AMessageRecord.recipient_agent_id == agent_id,
                    A2AMessageRecord.status == "queued",
                )
                .order_by(A2AMessageRecord.created_at)
            ).all()
        )
    delivered = 0
    for message_id in ids:
        if dispatch_message(message_id) == "delivered":
            delivered += 1
    return delivered
