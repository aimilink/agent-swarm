# Hermes 多 Agent 协作系统 - 架构说明

## 目标

本项目基于 Hermes Agent profile 机制，提供一个本地多 Agent 团队控制台：

- **后端**：Flask 应用挂载在 Starlette/Uvicorn ASGI 服务中。
- **前端**：原生 HTML/JS，展示 Agent、消息、事件、Kanban 任务和终端输出。
- **Agent**：每个 Agent 对应一个 Hermes Profile。Profile 之间相互独立，但同一
  Profile 在 CLI 单 Agent 与团队编排入口之间共享 `config.yaml`、`SOUL.md`、
  skills、memories 和 MCP 配置。
- **编排**：用户任务进入 Hermes Kanban，Leader 通过 MCP 创建可追踪的 Worker Kanban 子任务。
- **运行**：Hermes Kanban dispatcher/gateway 或项目内置 dispatch worker 驱动任务执行。

本项目不是 Nous Research 或 Hermes Agent 官方项目。

---

## 核心概念

### 1. Hermes Profile = 一个持久 Agent 身份

平台中的 Agent 是一个逻辑实体，对应本机 Hermes profile：

```text
~/.hermes/profiles/<profile_name>/
├── config.yaml
├── SOUL.md
├── team-meta.json
├── skills/
└── memories/
```

Agent 接入时会：

1. 已有 Profile 原地接入，不克隆，保留 SOUL、Skill 和记忆；Leader 接入会配置团队 MCP，显式应用模型配置会更新该 Profile。
2. 新名称才调用 `hermes profile create <profile_name> --clone --no-alias`。
3. 创建或复用 Agent 工作区，默认位于 `~/agent_team/<profile_name>`。
4. 写入 `team-meta.json`，注册到 RuntimeStore 和 SQLite。
5. 新 Profile 异步生成 SOUL；已有 Profile 保留原人设。

接入只复用 Profile 身份与持久数据，不附着到其他终端中已经运行的 Hermes 对话，也不迁移其上下文。

Agent 移出团队或从控制台解雇时，只解除编排关系，不删除 Hermes Profile 和工作区。

当前支持两类角色：

| 角色 | 含义 |
|---|---|
| `leader` | 接收用户复杂任务，拆解并调度 Worker。每个团队最多一个 Leader。 |
| `worker` | 执行具体子任务。 |

### 2. MCP / ACP / Kanban 的分工

| 机制 | 用途 |
|---|---|
| MCP | 暴露团队协作工具给 Agent 调用。 |
| ACP / profile 进程 | 启动、停止、重启 Agent，并提供终端观察能力。 |
| Hermes Kanban | 持久化任务、依赖、派工、日志和结果。 |
| SQLite / RuntimeStore | 保存本项目的 Agent、消息、事件、Delegation、Assignment、Kanban 映射状态。 |

当前主执行路径是 **Kanban 驱动**，不是 Agent 之间直接互相发 HTTP 请求，也不是通过 ACP 直接把每个子任务 prompt 给 Worker。

### 单 Agent Web 聊天路径

`agent-chat.js` → `/api/agents/<agent_id>/chats` → `agent_chats` 数据表与 `services/chat.py` → `hermes -p <profile> chat -Q -q <prompt>`。发送接口先保存用户消息并原子占用会话，再等待 CLI 输出并保存回复或错误消息。每次调用携带当前会话的文本记录，不复用 ACP 会话，也不自动进入 Kanban 调度；同一 Profile 的配置与记忆继续共享。接口、恢复机制和验证范围见 [单 Agent 聊天](AGENT-CHAT.md)。

### 3. Agent Registry

Flask 后端维护 Agent Registry。Leader 通过 MCP 工具读取可调度 Worker。

`list_workers(team="")` 只返回已就绪且运行中的 `worker`，并排除 Leader 自身。传入团队 slug 时限制到该团队；省略时可见组织内全部可调度 Worker，但创建子任务仍要求与发起 Leader 同团队。返回字段包含：

- `agent_id`
- `profile_name`
- `team_id`
- `name`
- `role`
- `description`
- `status`
- `current_task`
- `runtime_status`
- `interaction_state`
- `orchestration_state`
- `load`
- `readiness_status`
- `readiness_message`
- `queue_depth`
- `mcps`

其中 `mcps` 只包含 `{name, transport, description, source_type}`，不暴露 URL、headers、env 或密钥。

---

## 系统架构

```text
┌────────────────────────────────────────────────────────────┐
│                         Web UI                              │
│ Agent 管理 / 消息输入 / Kanban 看板 / SSE 事件 / 终端面板      │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP / SSE / WebSocket
                           ▼
┌────────────────────────────────────────────────────────────┐
│                    Starlette / Uvicorn                      │
│                                                            │
│  ┌──────────────────────────────┐   ┌───────────────────┐  │
│  │ Flask WSGI App                │   │ FastMCP ASGI App   │  │
│  │ REST API / SSE / Dashboard    │   │ /mcp/              │  │
│  └──────────────┬───────────────┘   └────────┬──────────┘  │
│                 │                            │             │
│                 ▼                            ▼             │
│       RuntimeStore + SQLite          MCP tools for agents   │
└─────────────────┬────────────────────────────┬─────────────┘
                  │                            │
                  ▼                            ▼
┌────────────────────────────┐      ┌────────────────────────┐
│ Hermes Kanban CLI           │      │ Shared Hermes profiles  │
│ boards / tasks / logs/runs  │      │ CLI + team orchestration│
└────────────────────────────┘      └────────────────────────┘
```

ASGI 路由：

| 路径 | 说明 |
|---|---|
| `/` | Flask Web UI。 |
| `/api/...` | Flask REST API 与 SSE。 |
| `/api/events/stream` | 前端事件流。 |
| `/api/agents/<agent_id>/terminal/ws` | Agent 终端 WebSocket。 |
| `/mcp/` | MCP Streamable HTTP 入口。 |

---

## 任务数据流

### 用户提交任务给团队

```text
Web UI
  -> POST /api/messages
  -> messages.send_user_task(...)
  -> 创建本地 UserTask
  -> Hermes Kanban 创建父任务
  -> 本地记录 kanban_task_link(parent)
  -> dispatch_worker.trigger_async()
```

如果用户直接选择 Worker，系统创建该 Worker 团队 board 上的直派任务，用户任务绑定同团队可调度 Leader。显式选择 Leader 时定向派给该 Leader；省略接收 Agent 时只查找未分组 Leader，没有可调度 Leader 则拒绝创建。

Web 任务栏发送显式 `to_agent_id`；“全部团队”只是筛选范围。团队 API `/api/teams/<slug>/messages` 定向该团队 Leader；组织 API `/api/org/dispatch` 才执行关键词路由。

### Leader 拆解任务

```text
Leader profile 执行 Kanban 父任务
  -> 调用 mcp_agent_bus_list_workers()
  -> 调用 mcp_agent_bus_create_kanban_worker_tasks(...)
  -> 系统创建 Delegation / Assignment
  -> 创建多个 Worker Kanban 子任务
  -> 父任务标记为调度阶段完成
```

Leader 创建 Worker 子任务后，需要调用 `kanban_complete(summary=...)` 关闭当前父任务或 review 任务。这个 complete 表示“本轮调度/复盘完成”，不等于用户最终任务完成。

### Worker 执行与回流

```text
Kanban dispatcher/gateway
  -> 执行 worker profile
  -> worker 调用 kanban_complete 或 kanban_block
  -> kanban_sync 轮询任务状态
  -> 更新 Assignment / Delegation / UserTask
  -> 全部 Worker 完成后创建 Leader review Kanban 任务
```

Leader review 可以：

1. 认为目标完成，调用 `kanban_complete(summary=最终答复)`。
2. 认为还需继续，调用 `create_kanban_worker_tasks` 创建下一轮 Worker 子任务。
3. 认为无法继续，调用 `kanban_block(...)` 或 complete 当前最佳结果与阻塞原因。

---

## MCP 工具

当前 MCP server 定义在 `app/mcp_server.py`，暴露以下工具：

| 工具 | 说明 |
|---|---|
| `list_workers(team="")` | 返回可调度 Worker 及 MCP 摘要，可按团队 slug 筛选。 |
| `create_kanban_worker_tasks(assignments, from_agent_id, parent_task_id="", user_task_id="", summary_instruction="")` | Leader 创建一批 Worker Kanban 子任务。 |
| `dispatch_parallel(assignments, from_agent_id, summary_instruction="")` | 兼容入口，内部调用 `create_kanban_worker_tasks`。 |
| `request_human_input(question, from_agent_id, context="", options=None, parent_task_id="", user_task_id="")` | Agent 需要用户补充信息时创建人工处理 Kanban 任务。 |

跨团队工具：

| 工具 | 说明 |
|---|---|
| `delegate_to_team(task_title, content, from_agent_id, to_team, parent_task_id="", user_task_id="", expected_deliverable="")` | 向另一团队 board 创建由目标 Leader 接收的任务。 |
| `list_team_delegations(from_agent_id, team="")` | 查询跨团队任务状态、结果与阻塞原因。 |

`create_kanban_worker_tasks` 在创建批次之前校验 Worker 角色、同团队关系以及用户任务归属；该校验也在返回幂等派发结果之前执行。成员迁移入口在同一锁内检查 Leader 冲突与更新归属，但尚不具备完整的运行中迁移协议或数据库级唯一性保障。

已废弃的早期概念如 `list_agents`、`delegate_task`、`send_to_agent` 不再是当前 MCP 接口。

---

## 主要 HTTP 接口

| 接口 | 说明 |
|---|---|
| `GET /api/dashboard` | 获取前端 dashboard 快照。 |
| `POST /api/messages` | 提交用户任务，创建 Kanban 任务。 |
| `POST /api/agents` | 接入或新建 Agent，可传团队 slug 字段 `team`。 |
| `GET/POST /api/teams` | 列出/创建团队。 |
| `GET/PATCH/DELETE /api/teams/<slug>` | 查看/更新/删除空团队。 |
| `POST /api/teams/<slug>/members` | 加入或移动成员。 |
| `DELETE /api/teams/<slug>/members/<agent_id>` | 移出成员，保留 Profile。 |
| `POST /api/teams/<slug>/messages` | 向该团队 Leader 下发任务。 |
| `POST /api/org/dispatch` | 按关键词匹配团队并派发。 |
| `DELETE /api/agents/<agent_id>` | 删除 Agent。 |
| `POST /api/agents/<agent_id>/start` | 启动 Agent 运行时。 |
| `POST /api/agents/<agent_id>/stop` | 停止 Agent 运行时。 |
| `POST /api/agents/<agent_id>/restart` | 重启 Agent 运行时。 |
| `POST /api/agents/runtime` | 批量 start / stop / restart。 |
| `GET/PUT /api/agents/<agent_id>/soul` | 查看或更新 `SOUL.md`。 |
| `GET/POST/PUT/DELETE /api/agents/<agent_id>/mcps...` | 管理 Agent MCP servers。 |
| `GET/POST/DELETE /api/agents/<agent_id>/skills...` | 管理 Agent skills。 |
| `GET/POST/PUT/DELETE /api/model-configs...` | 管理模型配置。 |
| `GET /api/kanban/tasks` | 获取本地可见 Kanban 任务映射。 |
| `POST /api/kanban/dispatch` | 触发一次项目内 dispatch。 |
| `POST /api/transfer/export` | 导出团队配置。 |
| `POST /api/transfer/inspect` | 检查导入包。 |
| `POST /api/transfer/import` | 导入团队配置。 |
| `GET /api/events/stream` | SSE 事件流。 |

---

## 持久化

SQLite 表由 `app/db/models.py` 定义，启动时通过 `Base.metadata.create_all` 创建；SQLite 额外通过 `app/db/migrations.py` 补齐长时任务新增列。

主要表：

- `teams`
- `agents`
- `user_tasks`
- `delegations`
- `assignments`
- `kanban_task_links`
- `messages`
- `events`
- `settings`
- `model_configs`
- `agent_skill_installs`
- `agent_mcp_servers`

`agents`、`messages` 和 `user_tasks` 保存 `team_id`，用于隔离团队
视图与任务路由；`team_id IS NULL` 保留旧版未分组兼容行为。

运行时高频终端输出事件不会持久化。

---

## 配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `HERMES_CONTROL_MODE` | `shared` | `shared` 接管正常 Hermes Home；`isolated` 使用隔离目录。 |
| `HERMES_CLI` | `hermes` | Hermes CLI 名称或绝对路径。 |
| `HERMES_HOME` | `~/.hermes` | Hermes profiles 根目录。 |
| `AGENT_TEAM_WORKSPACE_ROOT` | `~/agent_team` | Agent 工作区根目录。 |
| `DATABASE_URL` | `sqlite:///data/hermes_agent_team.db` | 数据库连接串。 |
| `HERMES_AGENTS_MCP_URL` | `http://127.0.0.1:5050/mcp/` | 写入 Leader profile 的团队 MCP 地址。 |
| `HOST` | `127.0.0.1` | HTTP 监听地址。 |
| `PORT` | `5050` | Web 服务端口。 |
| `AGENT_TEAM_API_TOKEN` | 空 | 可选 Bearer Token，保护 Flask `/api/*`。 |
| `FLASK_DEBUG` | `0` | 日志级别开关，不启用 reload。 |
| `AUTO_START_AGENTS` | `1` | 启动项目时自动启动 ready Agent。 |
| `KANBAN_BOARD` | `hermes-agents-team` | 使用的 Hermes Kanban board。 |
| `KANBAN_POLL_INTERVAL` | `2` | Kanban 同步轮询间隔。 |
| `KANBAN_DEFAULT_WORKSPACE` | `scratch` | 默认 Kanban workspace。 |
| `KANBAN_AUTO_DISPATCH` | `0` | 默认是否开启项目内自动 dispatch。 |

---

## 当前定位

```text
Hermes Kanban = 持久化任务队列 + 派工系统 + 日志系统
Hermes Agents Team = 多 Agent 控制台 + Profile/Skill/MCP/模型管理 + Kanban 可视化层
```

本项目侧重本地可信环境，不提供租户隔离和企业级权限模型。可选
`AGENT_TEAM_API_TOKEN` 只覆盖 Flask API 与 SSE；终端 WebSocket、MCP 和整站访问
仍需由监听地址、防火墙、VPN 或反向代理保护。详见 [部署教程](deployment.md)。
