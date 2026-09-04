# 多团队改造说明

## 概念模型

组织（单实例、单库）下多个团队（销售/技术/市场...），每个团队：

- 一个 lead（`agents.team_id` 外键 + 每团队唯一 lead 约束）
- 多个 worker
- 独立 Kanban board（`teams.board_name`，默认 `team-{slug}`）
- 任务入口 `POST /api/teams/{team}/messages` → 路由到该团队 lead

## 数据变更

- 新表 `teams`（id/team_id/slug/name/description/board_name/settings_json/...）
- `agents` 加列 `team_id VARCHAR(120) NULL`（NULL = 未分组，兼容存量单团队数据）
- `messages` 加列 `team_id VARCHAR(120) NULL`

## 兼容性

- 存量无 team 的 agent：`team_id IS NULL`，`/api/messages` 原行为不变（全局找 leader）
- `POST /api/teams/{team}/messages`：新入口，按 slug 找 team → 找该 team 的 lead
- `has_leader()` → `has_team_lead(team_id)`，全局 leader 唯一性放宽为每团队唯一

## 阶段

- P1: teams CRUD + agent 归属 + 团队消息路由 + MCP team 过滤
- P2: 每团队 Kanban board + dispatch/sync 实例化 + UI 分组
- P3: delegate_to_team MCP 工具 + 跨团队任务回执
