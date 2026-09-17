import json
from types import SimpleNamespace

import pytest
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.controllers import agent_chats as controller
from app.db.models import AgentChatRecord


@pytest.fixture
def client(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'chats.db'}")
    AgentChatRecord.__table__.create(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(controller, 'SessionLocal', factory)
    monkeypatch.setattr(controller, 'store', SimpleNamespace(find_agent=lambda agent_id:
        {'profile_name': agent_id, 'readiness_status': 'ready'} if agent_id in ('a', 'b') else None))
    app = Flask(__name__)
    app.register_blueprint(controller.bp)
    yield app.test_client()
    engine.dispose()


def create(client, agent='a'):
    response = client.post(f'/api/agents/{agent}/chats', json={})
    assert response.status_code == 201
    return response.json['chat']['chat_id']


def test_history_context_and_isolation(client, monkeypatch):
    calls = []
    monkeypatch.setattr(controller, '_run_hermes_chat', lambda profile, prompt: calls.append((profile, prompt)) or '回答')
    first, second = create(client), create(client)
    url = f'/api/agents/a/chats/{first}'
    assert client.post(url + '/messages', json={'content': '你好'}).status_code == 200
    assert client.post(url + '/messages', json={'content': '继续'}).status_code == 200
    assert '你好' in calls[1][1] and '回答' in calls[1][1] and '继续' in calls[1][1]
    assert client.get(url).json['chat']['messages'][-1]['content'] == '回答'
    assert len(client.get('/api/agents/a/chats').json['chats']) == 2
    assert client.get(f'/api/agents/b/chats/{first}').status_code == 404
    assert client.post(f'/api/agents/b/chats/{first}/messages', json={'content': 'x'}).status_code == 404
    client.post(f'/api/agents/a/chats/{second}/messages', json={'content': '全新问题'})
    assert '你好' not in calls[-1][1]


def test_invalid_busy_and_failure(client, monkeypatch):
    chat_id = create(client)
    url = f'/api/agents/a/chats/{chat_id}'
    for payload in ({}, {'content': []}, {'content': '  '}, {'content': 'x' * 20001}, []):
        assert client.post(url + '/messages', json=payload).status_code == 400
    def fail(profile, prompt):
        progress = client.get(url).json["chat"]["progress"]
        assert progress["title"] == "Agent 正在思考"
        assert [step["status"] for step in progress["steps"]] == ["complete", "complete", "active", "pending"]
        assert client.post(url + '/messages', json={'content': '重复'}).status_code == 409
        raise RuntimeError('private configuration')
    monkeypatch.setattr(controller, '_run_hermes_chat', fail)
    data = client.post(url + '/messages', json={'content': '测试'}).json['chat']
    assert not data['busy']
    assert data['messages'][-1]['role'] == 'error'
    assert 'private' not in json.dumps(data)
    assert client.post('/api/agents/missing/chats', json={}).status_code == 404


def test_interrupted_chat_recovery(client):
    chat_id = create(client)
    with controller.SessionLocal() as db:
        row = db.get(AgentChatRecord, chat_id)
        row.busy = True
        row.updated_at = '2000-01-01T00:00:00Z'
        db.commit()
    data = client.get(f'/api/agents/a/chats/{chat_id}').json['chat']
    assert not data['busy']
    assert data['messages'][-1]['role'] == 'error'


@pytest.mark.parametrize("readiness", ["failed", "preparing", None, ""])
def test_direct_chat_does_not_require_team_readiness(client, monkeypatch, readiness):
    agent = {"profile_name": "a", "readiness_status": readiness,
             "readiness_message": "SOUL.md 缺失或为空", "runtime_status": "stopped"}
    monkeypatch.setattr(controller, "store", SimpleNamespace(find_agent=lambda _: agent))
    calls = []
    monkeypatch.setattr(controller, "_run_hermes_chat",
                        lambda profile, prompt: calls.append(profile) or "正常回复")
    chat_id = create(client)
    response = client.post(f"/api/agents/a/chats/{chat_id}/messages", json={"content": "你好"})
    assert response.status_code == 200
    assert calls == ["a"]
    assert response.json["chat"]["messages"][-1]["content"] == "正常回复"
    assert response.json["chat"]["busy"] is False
    assert agent["readiness_status"] == readiness
