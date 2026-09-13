from __future__ import annotations

from types import SimpleNamespace

from app.services import profiles


def test_profile_list_merges_live_cli_and_hermes_home(monkeypatch, tmp_path):
    profiles_dir = tmp_path / "profiles"
    (profiles_dir / "disk_profile").mkdir(parents=True)
    (profiles_dir / "Invalid Profile").mkdir()
    monkeypatch.setattr(profiles, "HERMES_HOME", tmp_path)
    monkeypatch.setattr(
        profiles.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=0,
            stdout="cli_profile\n",
            stderr="",
        ),
    )

    assert profiles.list_hermes_profiles() == ["cli_profile", "disk_profile"]


def test_profile_list_falls_back_to_hermes_home_when_cli_is_unavailable(
    monkeypatch, tmp_path
):
    (tmp_path / "profiles" / "local_profile").mkdir(parents=True)
    monkeypatch.setattr(profiles, "HERMES_HOME", tmp_path)

    def missing(*args, **kwargs):
        raise FileNotFoundError

    monkeypatch.setattr(profiles.subprocess, "run", missing)

    assert profiles.list_hermes_profiles() == ["local_profile"]


def test_ready_check_uses_live_profile_directory_when_cli_output_changes(
    monkeypatch, tmp_path
):
    (tmp_path / "profiles" / "live_profile").mkdir(parents=True)
    monkeypatch.setattr(profiles, "HERMES_HOME", tmp_path)
    monkeypatch.setattr(
        profiles.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="", stderr=""),
    )

    status = profiles.check_hermes_ready()

    assert status["ok"] is True
    assert status["profiles"] == ["live_profile"]
