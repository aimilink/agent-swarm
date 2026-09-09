"""usage_stats 单元测试。"""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path


def _write_log(profiles_root: Path, profile: str, lines: list[str]) -> None:
    log = profiles_root / "profiles" / profile / "logs" / "agent.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _api_line(days_ago: int, call: int, model: str, provider: str, inp: int, out: int) -> str:
    timestamp = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
    total = inp + out
    return (
        f"{timestamp},000 INFO [s] agent.conversation_loop: API call #{call}: "
        f"model={model} provider={provider} in={inp} out={out} total={total} "
        "latency=2.0s cache=0/1 (0%)"
    )


SAMPLE_LINES = [
    _api_line(1, 1, "glm-5.2", "custom:zai", 1000, 100),
    _api_line(2, 2, "deepseek-chat", "deepseek", 2000, 200),
    "unrelated line without api call",
    _api_line(3, 3, "glm-5.2", "custom:zai", 500, 50),
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

        old_line = (
            f"{datetime.now().replace(year=2020).strftime('%Y-%m-%d')} 10:00:00,000 INFO "
            "agent.conversation_loop: API call #1: model=m provider=p in=1 out=1 total=2 latency=1.0s"
        )
        _write_log(tmp_path, "x", [old_line, SAMPLE_LINES[0]])
        monkeypatch.setattr(us, "HERMES_HOME", str(tmp_path))
        rows = us.collect_usage(days=7)
        assert len(rows) == 1  # 2020 的被时间过滤，只留 2026-09-01
        assert rows[0]["ts"] == SAMPLE_LINES[0][:19]


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
