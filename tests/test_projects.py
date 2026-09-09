from pathlib import Path
from types import SimpleNamespace

import pytest
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import mcp_server
from app.controllers import projects as controller
from app.db.models import ProjectRecord, ProjectTeamRecord, ProjectArtifactRecord
from app.models.store import RuntimeStore
from app.services import projects, messages, human_input
from app.services.kanban_sync import KanbanSyncWorker


@pytest.fixture
def env(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    ProjectRecord.__table__.create(engine)
    ProjectTeamRecord.__table__.create(engine)
    ProjectArtifactRecord.__table__.create(engine)
    monkeypatch.setattr(projects, 'SessionLocal', sessionmaker(bind=engine, expire_on_commit=False))
    monkeypatch.setattr(projects, 'PROJECTS_ROOT', tmp_path / 'projects')
    store = RuntimeStore()
    for role in ('leader', 'worker'):
        store.register_agent(dict(agent_id=role, profile_name=role, name=role, role=role,
            status='idle', runtime_status='running', readiness_status='ready', team_id=None))
    monkeypatch.setattr(controller, 'store', store)
    monkeypatch.setattr(mcp_server, 'store', store)
    monkeypatch.setattr(messages.dispatch_worker, 'trigger_async', lambda: None)
    calls = []
    def create(title, **kwargs):
        calls.append(dict(title=title, **kwargs))
        return {'task_id': f'kb_{len(calls)}', 'status': 'ready'}
    monkeypatch.setattr(messages.kanban_service, 'create_task', create)
    monkeypatch.setattr(messages.kanban_service, 'complete_task', lambda *args, **kwargs: '')
    app = Flask(__name__)
    app.register_blueprint(controller.bp)
    yield app.test_client(), store, calls
    engine.dispose()


def test_project_parent_worker_review_and_artifacts(env, monkeypatch):
    client, store, calls = env
    response = client.post('/api/projects', json={'name':'示例项目', 'description':'交付 API 和测试'})
    assert response.status_code == 201
    project = response.json['project']; pid = project['project_id']; root = Path(project['workspace_path'])
    assert (root / 'PROJECT.md').is_file()
    assert all((root / d).is_dir() for d in ('docs','src','tests','deliverables'))
    assert client.get('/api/projects').json['projects'][0]['project_id'] == pid
    result = client.post(f'/api/projects/{pid}/tasks', json={'content':'开发 API', 'to_agent_id':'leader'})
    assert result.status_code == 201
    user_id = result.json['message']['user_task_id']
    worker = mcp_server.create_kanban_worker_tasks(assignments=[{'to_agent_id':'worker','content':'实现 API'}],
        from_agent_id='leader', parent_task_id='kb_1', user_task_id=user_id)
    assert worker['ok']
    delegation = store.snapshot()['delegations'][0]
    # Mark the generated assignment complete using the existing synchronization path.
    sync = KanbanSyncWorker(runtime_store=store, service=messages.kanban_service)
    link = store.find_kanban_task_link(kanban_task_id='kb_2')
    store.complete_assignment(delegation['delegation_id'], delegation['assignments'][0]['assignment_id'], result='API 完成')
    sync._create_ready_review_tasks()
    assert len(calls) == 3
    assert f'当前 worker 工作区是：{root}' in calls[1]['body']
    for call in calls:
        assert call['workspace'] == f'dir:{root}'
        assert pid in call['body'] and 'PROJECT.md' in call['body']
    assert all(l['metadata']['project_id'] == pid for l in store.snapshot()['kanban_task_links'])
    (root / 'docs' / 'design.md').write_text('设计', encoding='utf-8')
    payload = dict(path='docs/design.md',title='设计',task_id='kb_2',agent_id='worker',summary='API 设计',validation='已审查')
    assert client.post(f'/api/projects/{pid}/artifacts', json=payload).status_code == 201
    assert client.post(f'/api/projects/{pid}/artifacts', json=payload).status_code == 201
    detail = client.get(f'/api/projects/{pid}').json
    assert len(detail['tasks']) == 3 and len(detail['artifacts']) == 1
    assert detail['artifacts'][0]['exists']
    assert client.get(f'/api/projects/{pid}/file?path=docs/design.md').data.decode() == '设计'
    assert 'docs/design.md' in client.get(f'/api/projects/{pid}/files').json['files']
    (root / 'docs' / 'design.md').unlink()
    assert not client.get(f'/api/projects/{pid}').json['artifacts'][0]['exists']


def test_project_isolation_and_paths(env):
    client, store, calls = env
    one = projects.create_project('一'); two = projects.create_project('二')
    pid = one['project_id']; root = Path(one['workspace_path'])
    client.post(f'/api/projects/{pid}/tasks', json={'content':'说明','to_agent_id':'worker'})
    assert calls[0]['workspace'] == f'dir:{root}'
    assert len(client.get(f'/api/projects/{two["project_id"]}').json['tasks']) == 0
    for path in ('../test.db','/etc/passwd','C:/Windows/win.ini','docs/missing.md','docs\\x'):
        assert client.get(f'/api/projects/{pid}/file',query_string={'path':path}).status_code == 400
    assert client.post(f'/api/projects/{two["project_id"]}/artifacts',json=dict(path='PROJECT.md',title='目标',task_id='kb_1')).status_code == 400
    assert client.post('/api/projects',json={'name':' '}).status_code == 400
    assert client.post('/api/projects',json=[]).status_code == 400
    assert client.post('/api/projects/missing/tasks',json={'content':'x','to_agent_id':'leader'}).status_code == 400
    assert len(calls) == 1


def test_project_human_input_continuation(env):
    client, store, calls = env
    p = projects.create_project('人工确认')
    result = client.post(f'/api/projects/{p["project_id"]}/tasks',json={'content':'实施','to_agent_id':'leader'}).json
    human = human_input.create_human_input_task(store,question='是否继续',from_agent_id='leader',parent_task_id='kb_1',user_task_id=result['message']['user_task_id'])
    human_input.answer_human_input_task(store,human_task_id=human['human_task_id'],answer='继续')
    assert len(calls) == 3
    assert all(c['workspace'] == f'dir:{p["workspace_path"]}' for c in calls)
    assert all(l['metadata']['project_id'] == p['project_id'] for l in store.snapshot()['kanban_task_links'])


def test_cross_team_project_inheritance(env, monkeypatch):
    client, store, calls = env
    p = projects.create_project('跨团队')
    result = client.post(f'/api/projects/{p["project_id"]}/tasks',json={'content':'跨团队开发','to_agent_id':'leader'}).json
    team = store.create_team(slug='design',name='设计')
    store.register_agent(dict(agent_id='designer',profile_name='designer',name='设计负责人',role='leader',
        status='idle',runtime_status='running',readiness_status='ready',team_id=team['team_id']))
    from app.services import kanban
    monkeypatch.setattr(kanban, 'kanban_service_for_board',lambda _: messages.kanban_service)
    mcp_server.delegate_to_team(task_title='设计',content='设计页面',from_agent_id='leader',to_team='design',
        parent_task_id='kb_1',user_task_id=result['message']['user_task_id'])
    assert calls[-1]['workspace'] == f'dir:{p["workspace_path"]}'
    assert store.find_kanban_task_link(kanban_task_id='kb_2')['metadata']['project_id'] == p['project_id']


def test_project_tasks_are_numbered_as_iterations(env):
    client, store, calls = env
    project = projects.create_project("持续迭代")
    project_id = project["project_id"]

    first = client.post(
        f"/api/projects/{project_id}/tasks",
        json={"content": "完成第一个版本", "to_agent_id": "worker"},
    )
    second = client.post(
        f"/api/projects/{project_id}/tasks",
        json={"content": "根据反馈继续优化", "to_agent_id": "worker"},
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json["iteration"] == 1
    assert second.json["iteration"] == 2
    assert calls[0]["workspace"] == calls[1]["workspace"] == f"dir:{project['workspace_path']}"
    assert "第 1 次迭代" in calls[0]["body"]
    assert "第 2 次迭代" in calls[1]["body"]
    links = store.snapshot()["kanban_task_links"]
    assert [link["metadata"]["project_iteration"] for link in links] == [1, 2]
    detail = client.get(f"/api/projects/{project_id}").json
    assert detail["current_iteration"] == 2
    assert detail["next_iteration"] == 3



def test_projects_and_teams_have_many_to_many_relationship(env, monkeypatch):
    client, store, calls = env
    engineering = store.create_team(slug="engineering", name="工程团队")
    design = store.create_team(slug="design", name="设计团队")
    store.assign_agent_team("leader", engineering["team_id"])
    store.assign_agent_team("worker", design["team_id"])

    first = client.post("/api/projects", json={
        "name": "产品项目",
        "team_ids": [engineering["team_id"], design["team_id"], design["team_id"]],
    })
    second = client.post("/api/projects", json={
        "name": "品牌项目",
        "team_ids": [design["team_id"]],
    })
    assert first.status_code == second.status_code == 201
    first_project = first.json["project"]
    second_project = second.json["project"]
    assert first_project["team_ids"] == [engineering["team_id"], design["team_id"]]
    assert [team["name"] for team in first_project["teams"]] == ["工程团队", "设计团队"]

    listed = client.get("/api/projects").json["projects"]
    by_id = {project["project_id"]: project for project in listed}
    assert design["team_id"] in by_id[first_project["project_id"]]["team_ids"]
    assert design["team_id"] in by_id[second_project["project_id"]]["team_ids"]

    from app.services import kanban
    monkeypatch.setattr(kanban, "kanban_service_for_board", lambda _: messages.kanban_service)
    updated = client.put(f"/api/projects/{first_project['project_id']}/teams", json={
        "team_ids": [engineering["team_id"]],
    })
    assert updated.status_code == 200
    assert updated.json["project"]["team_ids"] == [engineering["team_id"]]
    assert client.post(f"/api/projects/{first_project['project_id']}/tasks", json={
        "content": "设计任务", "to_agent_id": "worker",
    }).status_code == 400
    allowed = client.post(f"/api/projects/{first_project['project_id']}/tasks", json={
        "content": "工程任务", "to_agent_id": "leader",
    })
    assert allowed.status_code == 201
    assert "参与团队：工程团队" in calls[-1]["body"]

    store.register_agent(dict(agent_id="design-lead", profile_name="design-lead", name="设计负责人",
        role="leader", status="idle", runtime_status="running", readiness_status="ready",
        team_id=design["team_id"]))
    with pytest.raises(ValueError, match="目标团队未参与当前项目"):
        mcp_server.delegate_to_team(
            task_title="设计",
            content="设计页面",
            from_agent_id="leader",
            to_team="design",
            parent_task_id="kb_1",
            user_task_id=allowed.json["message"]["user_task_id"],
        )

    invalid = client.put(f"/api/projects/{first_project['project_id']}/teams", json={
        "team_ids": ["missing-team"],
    })
    assert invalid.status_code == 400
    assert "团队不存在" in invalid.json["error"]
