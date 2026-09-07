# 当前版本功能地图

本文描述当前代码已经具备的能力、数据归属和兼容边界。规划中的能力不列为已完成。

## 1. 产品定位

Hermes Agents Team 是 Hermes Agent 之上的本地编排控制台：

- Hermes Profile 负责持久 Agent 身份和能力。
- Web 控制台负责团队、任务、消息、运行时与可视化。
- MCP 负责 Agent 调用团队协作工具。
- ACP 负责控制和观察 Agent 进程。
- Hermes Kanban 负责任务队列、派工、日志和结果回流。

核心约束是“一个 Profile、一份数据、两种使用入口”：

```text
Hermes CLI 单 Agent ─┐
                     ├─ ~/.hermes/profiles/<profile_name>
团队 / 多 Agent ─────┘    SOUL + Skill + Memory + Config + MCP
```

加入团队不会复制 Profile；退出团队不会删除 Profile。

## 2. 运行模式

| 能力 | `shared`（默认） | `isolated` |
|---|---|---|
| Hermes 数据目录 | 当前用户 `~/.hermes` | 项目 `hermes-home` 或显式路径 |
| 接入已有 Profile | 原地接入，不覆盖 SOUL/Skill/记忆 | 只接入隔离目录中的 Profile |
| 新建 Profile | 写入日常 Hermes Home，可独立使用 | 仅写入隔离 Hermes Home |
| 退出团队 | 保留 Profile 和工作区 | 同样保留 |
| 适用场景 | 日常使用、长期团队协作 | 测试、演示、临时环境 |

显式 `HERMES_HOME` 的优先级高于模式默认目录。切换模式不会自动迁移数据。

## 3. 功能总览

| 功能域 | 当前能力 | 主要入口 |
|---|---|---|
| Profile 接管 | 列出已有 Profile；原地接入；新名称按 active Profile 克隆创建 | 新员工弹窗、`GET /api/profiles` |
| Agent 生命周期 | 创建、初始化、批量启动/停止/重启、运行状态、终端输入与尺寸同步 | Agent 列表、终端抽屉、`/api/agents/*` |
| SOUL 人设 | 查看、编辑、重新生成；保存在 Profile 内 | SOUL 抽屉 |
| Skill | 列表、详情、Git 安装、重装、卸载；团队和单 Agent 共用 | Skill 抽屉 |
| MCP | HTTP、Streamable HTTP、stdio；增删改查、连通测试、敏感字段脱敏 | MCP 管理 |
| 模型配置 | 配置 CRUD、连通测试、应用到指定 Profile | 模型配置页/Agent 抽屉 |
| 团队 | 多团队 CRUD、成员加入/移出、每团队一个 Leader、多个 Worker | 团队管理、`/api/teams` |
| 团队任务入口 | 将任务定向给某团队 Leader | `POST /api/teams/<slug>/messages` |
| 组织路由 | 按关键词把组织级任务路由到匹配团队 | `POST /api/org/dispatch` |
| 团队内协作 | Leader 发现本团队 Worker，并行创建 Kanban 子任务 | MCP `list_workers`、`create_kanban_worker_tasks` |
| 跨团队协作 | Leader 向另一团队 Leader 委派并查询回执 | MCP `delegate_to_team`、`list_team_delegations` |
| Kanban | 任务列表、详情、运行记录、日志、派发、解阻、回答人工问题、删除与归档 | 看板页、`/api/kanban/*` |
| 人工介入 | Agent 创建需要用户回答的任务，用户从页面响应 | MCP `request_human_input` |
| 消息与事件 | 用户消息、Agent 输出、SSE 实时刷新、团队维度持久化 | 对话区、`/api/events/stream` |
| 用量统计 | 团队级 Token 用量聚合，支持 1–30 天窗口 | `GET /api/teams/<slug>/usage` |
| 导入导出 | Profile 白名单文件、Skill、MCP 元数据与可选工作区；校验 checksum | 团队设置 |
| 响应式 UI | 桌面/移动布局、移动侧栏、弹窗焦点管理、Escape 关闭、加载/错误反馈 | Web UI |
| API 访问控制 | 可选 Bearer Token 保护 `/api/*` 和 SSE | `AGENT_TEAM_API_TOKEN` |

## 4. 单 Agent、多 Agent、多团队关系

| 场景 | 身份数据 | 团队数据 | 能力是否回流单 Agent |
|---|---|---|---|
| Hermes CLI 单独运行 | 读取 Profile | 不需要 | 原生入口 |
| 一个 Agent 加入团队 | 仍读取同一 Profile | 增加 `team_id` 和 `team-meta.json` | 是 |
| 团队中安装 Skill/MCP | 写入同一 Profile | 记录安装元数据 | 是，CLI 下次运行可见 |
| 团队中积累记忆/经验 | 写入同一 Profile | 任务关系写 SQLite | 是 |
| Agent 移出团队 | Profile 不变 | 清除成员关系 | 是 |
| 多团队协作 | 每个 Agent 仍有自己的 Profile | 委派带来源/目标团队和看板信息 | 是 |

一个 Agent 同一时刻最多属于一个团队。每个团队最多一个 Leader；不同团队可以各有
自己的 Leader。未分组 Agent 保留旧版兼容行为。

## 5. 数据地图

### 5.1 Hermes 持久数据

默认位置：

```text
~/.hermes/profiles/<profile_name>/
├── config.yaml       # 模型、MCP、Hermes 配置
├── SOUL.md           # 人设
├── skills/           # 技能
├── memories/         # 记忆与经验
└── team-meta.json    # 控制台编排元数据，不限制独立运行
```

这些数据属于 Profile。控制台解除成员关系或解雇 Agent 时不会删除它们。

### 5.2 控制台数据库

默认 `data/hermes_agent_team.db`：

- `teams`：团队、slug、独立 board、设置。
- `agents`：Profile 与运行时映射、`team_id`。
- `messages`、`user_tasks`：团队消息和用户任务。
- `delegations`、`assignments`：拆解、派工和跨团队关系。
- `kanban_task_links`：本地实体与 Hermes Kanban 任务映射。
- `events`、`settings`：事件与控制台设置。
- `model_configs`、Skill/MCP 安装记录：管理元数据。

数据库记录不替代 Profile 文件。两者应一起备份。

### 5.3 工作区

`AGENT_TEAM_WORKSPACE_ROOT/<profile_name>` 保存任务产物。退出团队时保留；
团队导入的“替换控制台状态”流程会按页面预检结果清理旧工作区，因此导入前应备份。

### 5.4 临时运行状态

RuntimeStore、终端订阅、进程句柄和高频终端事件只在进程内存在；重启后从 SQLite
与 Profile 元数据重新构建。

## 6. 主要工作流

### 6.1 接入已有 Agent

```text
选择已有 Profile
  -> 校验 Profile 名称
  -> 保留原 config / SOUL / skills / memories
  -> 写入或更新 team-meta.json
  -> 注册 SQLite / RuntimeStore
  -> 可选加入团队并启动
```

### 6.2 新建 Agent

```text
输入新 Profile 名
  -> hermes profile create <name> --clone --no-alias
  -> 创建工作区
  -> 写入团队元数据
  -> 生成 SOUL
  -> 注册并启动
```

### 6.3 团队任务

```text
用户任务 -> 团队 Leader -> Kanban 父任务
  -> Leader 拆解 -> Worker 子任务并行执行
  -> Worker 完成/阻塞 -> 状态回流
  -> Leader review -> 继续派工或最终汇总
```

### 6.4 跨团队任务

```text
来源团队 Leader
  -> delegate_to_team
  -> 目标团队独立 Kanban board
  -> 目标 Leader 拆解执行
  -> list_team_delegations 查询状态与结果
```

## 7. 兼容性承诺

- 默认 `shared`，但保留 `isolated` 部署模式。
- 旧数据中 `team_id IS NULL` 的 Agent 可继续使用全局消息入口。
- 子进程显式获得 `HERMES_HOME`，不依赖调用者碰巧使用相同 shell。
- Profile 配置采用锁和原子替换，降低并发更新导致的覆盖或损坏风险。
- 团队成员移除只解除编排关系；Profile、Skill、记忆和经验继续保留。

## 8. 当前边界与安全说明

- 这是本地/可信内网工具，不是多租户 SaaS；没有租户级权限隔离。
- `AGENT_TEAM_API_TOKEN` 只保护 Flask `/api/*`；整站、终端 WebSocket
  和 MCP 仍需网络层保护。
- SQLite 部署只支持单控制台写进程，不建议多 worker 横向扩容。
- 控制台运行端推荐 POSIX 环境；原生 Windows 请改用 WSL2。
- 导入会替换控制台注册、工作区和运行历史；共享 Hermes Profile 不因普通成员移除
  而删除，但执行导入前仍应完成数据库、Profile 和工作区备份。

## 9. 相关文档

- [部署与安装教程](deployment.md)
- [架构说明](ARCHITECTURE.md)
- [多团队改造说明](MULTI-TEAM.md)
- [MCP 管理](mcp-management.md)
- [Skill 管理](skills-management.md)
- [团队导入导出](import-export.md)
