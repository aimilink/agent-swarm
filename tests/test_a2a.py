from __future__ import annotations

from types import SimpleNamespace

import pytest
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.controllers import a2a as a2a_controller
from app.db.models import A2AConversationRecord, A2AMessageRecord
from app.services import a2a
from app.services.acp import pool as session_pool


@pytest.fixture
def a2a_env(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'a2a.db'}")
    A2AConversationRecord.__table__.create(engine)
    A2AMessageRecord.__table__.create(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    agents = {
        "alpha": {
            "agent_id": "alpha",
            "name": "Alpha",
            "profile_name": "alpha",
            "team_id": "team-a",
            "runtime_status": "running",
            "readiness_status": "ready",
        },
        "beta": {
            "agent_id": "beta",
            "name": "Beta",
            "profile_name": "beta",
            "team_id": "team-b",
            "runtime_status": "running",
            "readiness_status": "ready",
        },
        "gamma": {
            "agent_id": "gamma",
            "name": "Gamma",
            "profile_name": "gamma",
            "team_id": "team-b",
            "runtime_status": "stopped",
            "readiness_status": "ready",
        },
    }
    events = []
    fake_store = SimpleNamespace(
        find_agent=lambda agent_id: agents.get(agent_id),
        snapshot=lambda: {"agents": list(agents.values())},
        push_event=lambda *args: events.append(args),
    )
    prompts = []
    monkeypatch.setattr(a2a, "SessionLocal", factory)
    monkeypatch.setattr(a2a, "store", fake_store)
    monkeypatch.setattr(a2a_controller, "a2a", a2a)
    monkeypatch.setattr(session_pool, "is_running", lambda agent_id: agent_id == "beta")
    monkeypatch.setattr(
        session_pool,
        "prompt",
        lambda agent_id, content, **metadata: prompts.append(
            (agent_id, content, metadata)
        ),
    )
    yield SimpleNamespace(
        factory=factory,
        agents=agents,
        events=events,
        prompts=prompts,
    )
    engine.dispose()


def test_create_send_complete_and_continue(a2a_env):
    conversation = a2a.create_conversation("alpha", "beta")
    assert conversation["participant_ids"] == ["alpha", "beta"]

    sent = a2a.send_message(conversation["conversation_id"], "alpha", "请检查方案")
    assert sent["delivery_status"] == "delivered"
    assert len(a2a_env.prompts) == 1
    agent_id, prompt, metadata = a2a_env.prompts[0]
    assert agent_id == "beta"
    assert "请检查方案" in prompt
    assert metadata["a2a_message_id"] == sent["message_id"]
    assert a2a.dispatch_message(sent["message_id"]) == "delivered"
    assert len(a2a_env.prompts) == 1

    completed = a2a.complete_delivery(
        sent["message_id"],
        "beta",
        "方案没有问题",
    )
    assert [item["sender_agent_id"] for item in completed["messages"]] == [
        "alpha",
        "beta",
    ]
    assert completed["messages"][0]["status"] == "completed"
    assert completed["messages"][1]["reply_to_message_id"] == sent["message_id"]

    continued = a2a.send_message(conversation["conversation_id"], "beta", "继续补充")
    assert continued["delivery_status"] == "queued"
    assert len(a2a.list_conversations("alpha")) == 1
    assert len(a2a.list_conversations("beta")) == 1


def test_offline_queue_is_dispatched_when_agent_starts(a2a_env, monkeypatch):
    monkeypatch.setattr(session_pool, "is_running", lambda _: False)
    conversation = a2a.create_conversation("alpha", "beta")
    sent = a2a.send_message(conversation["conversation_id"], "alpha", "离线消息")
    assert sent["delivery_status"] == "queued"
    assert a2a_env.prompts == []

    monkeypatch.setattr(session_pool, "is_running", lambda agent_id: agent_id == "beta")
    assert a2a.dispatch_queued_for_agent("beta") == 1
    assert len(a2a_env.prompts) == 1
    detail = a2a.get_conversation(conversation["conversation_id"])
    assert detail["messages"][0]["status"] == "delivered"


def test_boot_requeues_interrupted_delivery(a2a_env):
    conversation = a2a.create_conversation("alpha", "beta")
    sent = a2a.send_message(conversation["conversation_id"], "alpha", "处理中断")
    assert sent["delivery_status"] == "delivered"

    assert a2a.recover_interrupted_deliveries() == 1
    detail = a2a.get_conversation(conversation["conversation_id"])
    assert detail["messages"][0]["status"] == "queued"
    assert detail["messages"][0]["delivered_at"] is None

def test_validation_failure_and_retry(a2a_env, monkeypatch):
    with pytest.raises(ValueError, match="两个不同"):
        a2a.create_conversation("alpha", "alpha")
    conversation = a2a.create_conversation("alpha", "beta")
    with pytest.raises(ValueError, match="参与者"):
        a2a.send_message(conversation["conversation_id"], "gamma", "消息")

    sent = a2a.send_message(conversation["conversation_id"], "alpha", "会失败")
    a2a.complete_delivery(sent["message_id"], "beta", "private error", failed=True)
    detail = a2a.get_conversation(conversation["conversation_id"])
    assert detail["messages"][0]["status"] == "failed"
    assert "private error" not in str(detail)

    a2a_env.prompts.clear()
    retried = a2a.retry_message(sent["message_id"])
    assert retried["delivery_status"] == "delivered"
    assert len(a2a_env.prompts) == 1


def test_a2a_http_api(a2a_env):
    app = Flask(__name__)
    app.register_blueprint(a2a_controller.bp)
    client = app.test_client()

    created = client.post(
        "/api/a2a/conversations",
        json={"participant_a_id": "alpha", "participant_b_id": "beta"},
    )
    assert created.status_code == 201
    conversation_id = created.get_json()["conversation"]["conversation_id"]

    sent = client.post(
        f"/api/a2a/conversations/{conversation_id}/messages",
        json={"sender_agent_id": "alpha", "content": "API 消息"},
    )
    assert sent.status_code == 202
    assert sent.get_json()["delivery_status"] == "delivered"

    detail = client.get(
        f"/api/a2a/conversations/{conversation_id}?agent_id=alpha"
    )
    assert detail.status_code == 200
    assert detail.get_json()["conversation"]["messages"][0]["content"] == "API 消息"

    forbidden = client.get(
        f"/api/a2a/conversations/{conversation_id}?agent_id=missing"
    )
    assert forbidden.status_code == 400
