"""团队级成本统计：从各 profile 的 agent 日志解析 API call token 用量，按团队聚合。

数据源：hermes-home/profiles/<profile>/logs/agent.log 的
  "API call #N: model=... provider=... in=X out=Y total=Z latency=...s cache=A/B (P%)"
行。按 agent→team 归属聚合。

端点：GET /api/teams/{slug}/usage?days=7 → 按模型/成员的 token 统计。
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from pathlib import Path

from ..config import HERMES_HOME

# API call #12: model=x provider=p in=36126 out=231 total=36357 latency=2.5s cache=35712/36126 (99%)
_API_CALL_RE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?API call #\d+: model=(?P<model>\S+) "
    r"provider=(?P<provider>\S+) in=(?P<inp>\d+) out=(?P<out>\d+) total=(?P<total>\d+) "
    r"latency=(?P<lat>[\d.]+)s"
)


def iter_agent_logs(days: int = 7):
    """遍历所有 profile 的 agent.log，yield (profile_name, 行)。"""
    profiles_dir = Path(HERMES_HOME) / "profiles"
    if not profiles_dir.exists():
        return
    cutoff = datetime.now() - timedelta(days=days)
    for prof_dir in sorted(profiles_dir.iterdir()):
        log = prof_dir / "logs" / "agent.log"
        if not log.exists():
            continue
        try:
            with log.open("r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    yield prof_dir.name, line
        except OSError:
            continue


def collect_usage(days: int = 7) -> list[dict]:
    """收集近 N 天全部 API call 记录。"""
    cutoff = datetime.now() - timedelta(days=days)
    rows = []
    for profile, line in iter_agent_logs(days):
        m = _API_CALL_RE.search(line)
        if not m:
            continue
        try:
            ts = datetime.strptime(m.group("ts"), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
        if ts < cutoff:
            continue
        rows.append(
            {
                "profile": profile,
                "ts": ts.strftime("%Y-%m-%d %H:%M:%S"),
                "model": m.group("model"),
                "provider": m.group("provider"),
                "in_tokens": int(m.group("inp")),
                "out_tokens": int(m.group("out")),
                "total_tokens": int(m.group("total")),
            }
        )
    return rows


def team_usage(runtime_store, slug: str, days: int = 7) -> dict:
    """按团队聚合：成员/模型 维度 token 统计。"""
    team = runtime_store.find_team_by_slug(slug)
    if team is None:
        raise ValueError(f"team '{slug}' not found")
    members = runtime_store.team_agents(team["team_id"])
    member_profiles = {m.get("profile_name") for m in members if m.get("profile_name")}

    rows = [r for r in collect_usage(days) if r["profile"] in member_profiles]

    by_member: dict[str, dict] = {}
    by_model: dict[str, dict] = {}
    total = {"calls": 0, "in_tokens": 0, "out_tokens": 0, "total_tokens": 0}
    for r in rows:
        prof, model = r["profile"], r["model"]
        m_stats = by_member.setdefault(prof, {"calls": 0, "in_tokens": 0, "out_tokens": 0, "total_tokens": 0})
        d_stats = by_model.setdefault(model, {"calls": 0, "in_tokens": 0, "out_tokens": 0, "total_tokens": 0})
        for stats in (m_stats, d_stats, total):
            stats["calls"] += 1
            stats["in_tokens"] += r["in_tokens"]
            stats["out_tokens"] += r["out_tokens"]
            stats["total_tokens"] += r["total_tokens"]

    return {
        "team": {"slug": slug, "name": team.get("name")},
        "days": days,
        "total": total,
        "by_member": by_member,
        "by_model": sorted(
            [{"model": k, **v} for k, v in by_model.items()],
            key=lambda x: -x["total_tokens"],
        ),
    }
