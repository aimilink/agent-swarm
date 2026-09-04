"""usage_stats 单元测试。"""

from __future__ import annotations

from pathlib import Path


def _write_log(profiles_root: Path, profile: str, lines: list[str]) -> None:
    log = profiles_root / "profiles" / profile / "logs" / "agent.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text("\n".join(lines) + "\n", encoding="utf-8")


SAMPLE_LINES = [
    "2026-09-01 10:00:00,000 INFO [s] agent.conversation_loop: API call #1: model=glm-5.2 provider=custom:zai in=1000 out=100 total=1100 latency=2.0s cache=900/1000 (90%)",
    "2026-09-02 11:00:00,000 INFO [s] agent.conversation_loop: API call #2: model=deepseek-chat provider=deepseek in=2000 out=200 total=2200 latency=1.5s cache=0/2000 (0%)",
    "unrelated line without api call",
    "2026-09-03 12:00:00,000 INFO [s] agent.conversation_loop: API call #3: model=glm-5.2 provider=custom:zai in=500 out=50 total=550 latency=1.0s cache=500/500 (100%)",
]


class TestCollectUsage:
    def test_parses_api_calls(self, tmp_path, monkeypatch):
        import app.services.usage_stats as us

        _write_log(tmp_path, "sales-01", SAMPLE_LINES)
        monkeypatch.setattr(us, "HERMES_HOME", str(tmp_path))
        rows = us.collect_usage(days=7)
        assert len(rows) == 3
        assert rows[0]["model"] == "glm-5.2"
        assert rows[0]["in_tokens"] == 1000
        assert rows[1]["total_tokens"] == 2200

    def test_days_filter(self, tmp_path, monkeypatch):
        import app.services.usage_stats as us
        from datetime import datetime

        old_line = (
            f"{datetime.now().replace(year=2020).strftime('%Y-%m-%d')} 10:00:00,000 INFO "
            "agent.conversation_loop: API call #1: model=m provider=p in=1 out=1 total=2 latency=1.0s"
        )
        _write_log(tmp_path, "x", [old_line, SAMPLE_LINES[0]])
        monkeypatch.setattr(us, "HERMES_HOME", str(tmp_path))
        rows = us.collect_usage(days=7)
        assert len(rows) == 1  # 2020 的被时间过滤，只留 2026-09-01
        assert rows[0]["ts"] == "2026-09-01 10:00:00"


class TestTeamUsage:
    def test_aggregates_by_member_and_model(self, tmp_path, monkeypatch):
        import app.services.usage_stats as us

        _write_log(tmp_path, "sales-01", SAMPLE_LINES[:2])
        _write_log(tmp_path, "outsider", [SAMPLE_LINES[2]])

        class FakeStore:
            def find_team_by_slug(self, slug):
                return {"team_id": "t1", "name": "S", "slug": slug} if slug == "sales" else None

            def team_agents(self, team_id):
                return [{"profile_name": "sales-01"}]

        monkeypatch.setattr(us, "HERMES_HOME", str(tmp_path))
        result = us.team_usage(FakeStore(), "sales", days=7)
        assert result["total"]["calls"] == 2
        assert result["total"]["total_tokens"] == 3300
        assert set(result["by_member"]) == {"sales-01"}
        assert {m["model"] for m in result["by_model"]} == {"glm-5.2", "deepseek-chat"}

    def test_unknown_team_raises(self, tmp_path, monkeypatch):
        import app.services.usage_stats as us

        class FakeStore:
            def find_team_by_slug(self, slug):
                return None

        monkeypatch.setattr(us, "HERMES_HOME", str(tmp_path))
        try:
            us.team_usage(FakeStore(), "ghost")
            assert False, "should raise"
        except ValueError as e:
            assert "not found" in str(e)
