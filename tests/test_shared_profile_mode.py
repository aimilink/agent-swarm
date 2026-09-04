from __future__ import annotations

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.db import repositories
from app.db.models import MessageRecord, UserTaskRecord
from app.db.session import Base
from app.models.store import RuntimeStore
from app.services import agents, profiles, registry


def _write_profile(root, profile_name: str) -> None:
    profile = root / "profiles" / profile_name
    profile.mkdir(parents=True)
    (profile / "config.yaml").write_text("model: {}\n", encoding="utf-8")
    (profile / "SOUL.md").write_text("# Existing identity\n", encoding="utf-8")
    (profile / "skills" / "learned").mkdir(parents=True)
    (profile / "skills" / "learned" / "SKILL.md").write_text(
        "# Learned skill\n",
        encoding="utf-8",
    )


def test_existing_profile_is_attached_and_detached_without_data_loss(
    tmp_path,
    monkeypatch,
):
    _write_profile(tmp_path, "solo")
    workspace_root = tmp_path / "workspaces"
    monkeypatch.setattr(profiles, "HERMES_HOME", tmp_path)
    monkeypatch.setattr(registry, "HERMES_HOME", tmp_path)
    monkeypatch.setattr(registry, "AGENT_TEAM_WORKSPACE_ROOT", workspace_root)
    monkeypatch.setattr(agents, "AGENT_TEAM_WORKSPACE_ROOT", workspace_root)
    monkeypatch.setattr(profiles, "list_hermes_profiles", lambda: ["solo"])
    monkeypatch.setattr(agents.acp.pool, "start", lambda agent: True)
    monkeypatch.setattr(agents.acp.pool, "stop", lambda agent_id: None)

    store = RuntimeStore()
    agent = agents.create_agent(
        store,
        name="Solo",
        profile_name="solo",
        role="worker",
    )

    assert agent["profile_origin"] == "existing"
    assert agent["readiness_message"] == "沿用现有 Hermes SOUL.md"
    assert (tmp_path / "profiles" / "solo" / "team-meta.json").exists()

    agents.delete_agent(store, agent["agent_id"])

    assert (tmp_path / "profiles" / "solo" / "config.yaml").exists()
    assert (tmp_path / "profiles" / "solo" / "SOUL.md").read_text(
        encoding="utf-8"
    ) == "# Existing identity\n"
    assert (tmp_path / "profiles" / "solo" / "skills" / "learned" / "SKILL.md").exists()
    assert (workspace_root / "solo").exists()
    assert not (tmp_path / "profiles" / "solo" / "team-meta.json").exists()


def test_team_id_is_carried_by_tasks_and_messages():
    store = RuntimeStore()
    store.register_agent(
        {
            "agent_id": "agent_lead",
            "profile_name": "lead",
            "name": "Lead",
            "role": "leader",
            "is_leader": True,
            "team_id": "team_alpha",
        }
    )

    task = store.create_user_task(leader_agent_id="agent_lead", content="goal")
    message = store.record_message("goal", "agent_lead")

    assert task["team_id"] == "team_alpha"
    assert message["team_id"] == "team_alpha"


def test_hermes_environment_is_process_local(tmp_path, monkeypatch):
    monkeypatch.setattr(profiles, "HERMES_HOME", tmp_path)
    monkeypatch.setenv("HERMES_HOME", "outside")

    child_env = profiles.hermes_command_env({"PYTHONUNBUFFERED": "1"})

    assert child_env["HERMES_HOME"] == str(tmp_path)
    assert child_env["PYTHONUNBUFFERED"] == "1"


def test_team_id_survives_database_round_trip(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'state.db'}")
    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(repositories, "SessionLocal", test_session)
    persistence = repositories.SQLitePersistence()

    persistence.upsert_user_task(
        {
            "user_task_id": "ut_1",
            "leader_agent_id": "agent_lead",
            "team_id": "team_alpha",
            "content": "goal",
            "status": "running",
        }
    )
    persistence.insert_message(
        {
            "message_id": "msg_1",
            "team_id": "team_alpha",
            "to_agent_id": "agent_lead",
            "content": "goal",
            "created_at": "2026-09-04T00:00:00Z",
        }
    )

    with test_session() as session:
        task = session.scalar(
            select(UserTaskRecord).where(UserTaskRecord.user_task_id == "ut_1")
        )
        message = session.scalar(
            select(MessageRecord).where(MessageRecord.message_id == "msg_1")
        )

    assert task is not None and task.team_id == "team_alpha"
    assert message is not None and message.team_id == "team_alpha"
