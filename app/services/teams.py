"""团队生命周期服务：创建/更新/删除团队（含默认团队模板）。"""

from __future__ import annotations

from ..models.store import RuntimeStore
from . import messages as messages_service



# 团队模板：可选，用于 initialize_team_agents 风格的一键建队
TEAM_TEMPLATES: dict[str, list[dict]] = {
    "sales": [
        {"name": "销售主管", "role": "leader", "description": "销售团队负责人：接收销售类任务，拆解并分派给销售成员"},
        {"name": "销售专员", "role": "worker", "description": "执行销售任务：客户跟进、商机整理、话术撰写"},
        {"name": "售前顾问", "role": "worker", "description": "售前支持：方案编写、投标响应、产品演示稿"},
    ],
    "tech": [
        {"name": "技术负责人", "role": "leader", "description": "技术团队负责人：接收研发任务，拆解并分派给开发/测试"},
        {"name": "后端开发", "role": "worker", "description": "后端实现：API、数据库、服务逻辑"},
        {"name": "前端开发", "role": "worker", "description": "前端实现：页面、交互、组件"},
        {"name": "测试工程师", "role": "worker", "description": "测试：用例设计、执行验证、Bug 报告"},
    ],
    "market": [
        {"name": "市场负责人", "role": "leader", "description": "市场团队负责人：接收营销任务并分派"},
        {"name": "内容运营", "role": "worker", "description": "内容生产：文章、社媒、活动文案"},
        {"name": "SEO 专员", "role": "worker", "description": "SEO：关键词、站内优化、外链策略"},
    ],
}

# 组织总管关键词路由：按匹配命中数选团队；并列时取列表中靠前的规则。
ORG_DISPATCH_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("sales", ("销售", "客户", "商机", "sales", "customer", "deal")),
    ("tech", ("技术", "开发", "bug", "tech", "code", "api")),
    ("market", ("市场", "内容", "seo", "market", "marketing")),
]


def match_team_slug_for_content(content: str, teams: list[dict]) -> str | None:
    """按关键词为内容匹配团队 slug；无命中时返回 teams 中第一个；无团队则 None。"""
    if not teams:
        return None
    available = {t.get("slug"): t for t in teams if t.get("slug")}
    text = (content or "").lower()
    best_slug = None
    best_score = 0
    for slug, keywords in ORG_DISPATCH_KEYWORDS:
        if slug not in available:
            continue
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > best_score:
            best_score = score
            best_slug = slug
    if best_slug:
        return best_slug
    return teams[0].get("slug")


def org_dispatch(runtime_store: RuntimeStore, *, content: str) -> dict:
    """组织总管入口：按关键词路由到最匹配团队 Lead，并创建用户任务。"""
    content = (content or "").strip()
    if not content:
        raise ValueError("content is required")
    teams = runtime_store.list_teams()
    if not teams:
        raise ValueError("no teams configured")
    slug = match_team_slug_for_content(content, teams)
    if not slug:
        raise ValueError("no teams configured")
    team = runtime_store.find_team_by_slug(slug)
    if team is None:
        raise ValueError(f"team '{slug}' not found")
    lead_agent_id = runtime_store.find_team_lead_agent_id(team["team_id"])
    if not lead_agent_id:
        raise ValueError(f"team '{slug}' has no dispatchable leader")
    message = messages_service.send_user_task(
        runtime_store,
        content=content,
        to_agent_id=lead_agent_id,
    )
    return {
        "team": {"slug": slug, "name": team.get("name"), "team_id": team.get("team_id")},
        "lead_agent_id": lead_agent_id,
        "message": message,
    }


def create_team(
    runtime_store: RuntimeStore,
    *,
    slug: str,
    name: str,
    description: str = "",
    board_name: str = "",
) -> dict:
    return runtime_store.create_team(
        slug=slug,
        name=name,
        description=description,
        board_name=board_name,
    )


def update_team(runtime_store: RuntimeStore, team_id: str, **patch) -> dict:
    return runtime_store.update_team(team_id, **patch)


def delete_team(runtime_store: RuntimeStore, team_id: str) -> dict:
    return runtime_store.delete_team(team_id)


def team_detail(runtime_store: RuntimeStore, slug: str) -> dict:
    team = runtime_store.find_team_by_slug(slug)
    if team is None:
        raise ValueError(f"team '{slug}' not found")
    members = runtime_store.team_agents(team["team_id"])
    lead = next((m for m in members if m.get("role") == "leader"), None)
    return {
        **team,
        "member_count": len(members),
        "lead_agent_id": lead.get("agent_id") if lead else None,
        "lead_name": lead.get("name") if lead else None,
        "members": [
            {
                "agent_id": m.get("agent_id"),
                "name": m.get("name"),
                "profile_name": m.get("profile_name"),
                "role": m.get("role"),
                "status": m.get("status"),
                "runtime_status": m.get("runtime_status"),
            }
            for m in members
        ],
    }
