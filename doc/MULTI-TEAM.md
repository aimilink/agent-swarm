# 多团队实现说明

本文描述当前已经落地的多团队模型。Profile 数据共享规则见
[功能地图](FEATURE-MAP.md)，安装配置见 [部署教程](deployment.md)。

## 概念模型

单实例、单 SQLite 数据库下可以创建多个团队。每个团队具有：

- 一个 Leader，唯一性按团队约束，不再全局唯一。
- 多个 Worker。
- 独立 Kanban board，默认名称为 `team-<slug>`。
- 独立任务入口和用量统计。
- 与其他团队进行委派的能力。

一个 Agent 同一时刻最多属于一个团队。Agent 的 Profile 身份独立于团队关系：
加入/移出团队只更新 `team_id` 和 `team-meta.json`，不会复制或删除
SOUL、Skill、记忆、经验、模型与 MCP。

## 数据模型

| 数据 | 作用 |
|---|---|
| `teams` | `team_id`、slug、名称、说明、board、设置 |
| `agents.team_id` | Agent 当前团队；NULL 表示未分组 |
| `messages.team_id` | 消息所属团队 |
| `user_tasks.team_id` | 用户任务所属团队 |
| `team-meta.json` | Profile 旁的控制台编排元数据 |
| Kanban link metadata | 跨团队来源、目标团队、目标 Leader 与 board |

启动时，数据库和 Profile 旁的 `team-meta.json` 会用于恢复 RuntimeStore。

## HTTP 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/teams` | 团队列表及成员摘要 |
| POST | `/api/teams` | 创建团队 |
| GET | `/api/teams/<slug>` | 团队详情 |
| PATCH | `/api/teams/<slug>` | 更新名称、说明、board、设置 |
| DELETE | `/api/teams/<slug>` | 删除团队关系 |
| POST | `/api/teams/<slug>/members` | 把已有 Agent 加入团队 |
| DELETE | `/api/teams/<slug>/members/<agent_id>` | 移出成员，不删除 Profile |
| POST | `/api/teams/<slug>/messages` | 将任务发送给该团队 Leader |
| GET | `/api/teams/<slug>/usage?days=7` | 聚合团队 Token 用量 |
| POST | `/api/org/dispatch` | 组织级关键词路由 |

## MCP 协作工具

### 团队内

- `list_workers(team="")`：可按团队 slug 筛选可调度 Worker；省略时可见
  组织内全部可调度 Worker。
- `create_kanban_worker_tasks(...)`：Leader 在当前团队 board 上创建 Worker
  子任务。
- `dispatch_parallel(...)`：兼容入口，内部使用 Kanban 子任务。
- `request_human_input(...)`：创建等待用户处理的 Kanban 任务。

### 跨团队

- `delegate_to_team(...)`：来源 Leader 把任务投递到目标团队的独立 board，
  由目标 Leader 接手拆解。
- `list_team_delegations(...)`：查询跨团队任务状态、结果与阻塞信息。

跨团队任务在 Kanban link metadata 中保存 `from_team`、`to_team`、
`to_lead_agent_id`、`user_task_id` 和 `parent_task_id`。

## 组织级路由

`POST /api/org/dispatch` 根据当前关键词规则选择团队，并把任务发送给该团队
Leader。当前内置规则覆盖 sales、tech、market；无命中时使用团队列表中的第一个
团队。它是轻量路由，不是模型语义分类器。

## 兼容性

- 存量 `team_id IS NULL` 的 Agent 继续通过 `POST /api/messages` 使用旧入口。
- 全局 Leader 唯一性已经放宽为“每团队最多一个 Leader”。
- 未分组 Agent 可以被重新分配到任意团队。
- 同一 Profile 在 CLI 单 Agent 模式和团队模式中始终读取同一 Hermes Home。
- 移除成员和删除团队不会删除 Hermes Profile 数据。

## 当前限制

- 一个 Agent 不能同时属于多个团队。
- 单实例使用一个 SQLite 数据库，不支持多租户权限隔离。
- 组织路由规则目前由代码中的关键词表定义。
- 跨团队任务由目标团队 Leader 接管，不直接绕过 Leader 派给目标 Worker。


## 团队隔离与派发规则

- 不指定接收 Agent 的 `/api/messages` 只查找未分组 Leader；团队任务使用团队入口或显式指定 Agent，避免按注册顺序落到其他团队。
- 直接指派 Worker 时，用户任务归属该 Worker 所在团队的可调度 Leader；该团队没有可调度 Leader 时拒绝创建，不回退到其他团队。
- 停止或未就绪的 Leader 保留成员身份和 Leader 名额，但不能接收团队派发。
- MCP Worker 子任务只允许派给同团队 Worker；跨团队工作通过 `delegate_to_team` 交给目标 Leader。
- 显式用户任务必须属于发起 Leader，且历史任务团队必须与该 Leader 当前团队一致；不允许调队后继续用原任务向新团队派发。
- 移动成员时，Leader 名额校验与成员更新在同一个锁内执行；未分组成员也最多保留一个 Leader。

## 本轮项目梳理

调用链为 HTTP/MCP → services 编排 → RuntimeStore → SQLite；Hermes Profile 保存 Agent 身份，ACP 管理运行会话，Kanban 承载任务执行与同步。前端位于 `app/static`，控制器位于 `app/controllers`。

本轮修复聚焦任务归属和派发边界，并由 `tests/test_team_isolation.py` 覆盖。一个 Agent 仍只属于一个团队。运行中成员迁移的完整生命周期、数据库级并发约束以及跨团队父子任务的权限校验仍需进一步设计；当前隔离检查不构成多租户鉴权。
