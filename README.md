# AgentSwarm

AgentSwarm 是基于 [Hermes Agent](https://hermes-agent.nousresearch.com/) Profile 机制构建的多团队、多 Agent 协作工作台。它以项目为交付单位，将团队、Agent 对话、任务看板、工作空间和产物集中管理。一个 Profile 是一个持久 Agent 身份：它可以在 Hermes CLI 中独立使用，也可以被 AgentSwarm 接入团队；两种模式共用人设、技能、记忆、经验、模型与工具配置。

> 1. 本项目是社区实验项目，不是 Nous Research 或 Hermes Agent 官方项目。
> 2. 当前仅建议在本机或可信内网环境运行，不要在未加鉴权、访问控制和 HTTPS 保护的情况下直接暴露到公网。
> 3. 所有 Agent profile、MCP、Skill、数据库与运行时配置均仅保存在本机环境中，项目不会将这些数据上传到云端，可放心在本地配置和使用。
> 4. 系统实际能力取决于本机 Hermes Agent 所配置和调用的模型。

- **后端**：Flask + Starlette/Uvicorn (ASGI)
- **通信协议**：MCP（Agent → 中枢）+ ACP（中枢 → Agent）+ Hermes Kanban
- **存储**：SQLite
- **前端**：原生 HTML/JS，实时展示多 Agent 对话、终端输出与任务流转

先看 [功能地图](doc/FEATURE-MAP.md) 了解当前版本边界；后续建设目标、优先级和验收标准见 [项目路线图](doc/PROJECT-ROADMAP.md)。安装上线见 [部署与安装教程](doc/deployment.md)。从接入已有 Agent 到派发团队任务，见 [使用指南](doc/USER-GUIDE.md)。更多设计细节见 [架构说明](doc/ARCHITECTURE.md)。

## 功能

### Hermes 共享接管模式

默认使用 `shared` 模式，控制台直接接入用户正常使用的 `~/.hermes`。一个 Profile
就是同一个 Agent：既可以从 Hermes CLI 单独运行，也可以加入一个团队参与多
Agent 协作。两种入口共用 SOUL、Skill、记忆、经验、模型配置和 MCP 配置。

- 接入已有 Profile 时不克隆、不覆盖已有 SOUL，团队只增加编排元数据。
- 新建 Profile 同样写入 ~/.hermes，可立即脱离控制台独立使用。
- Agent 退出团队时只解除编排关系，不删除 Profile、Skill、记忆或工作区。
- 团队任务、消息和成员关系带 team_id 持久化，支持多团队并行与跨团队委派。
- 接入的是 Profile 身份与持久配置，不会接管已有终端对话或迁移其上下文。
- 每团队最多一个 Leader、多个 Worker；一个 Agent 同时最多属于一个团队。
- 如需与日常 Hermes 数据完全隔离，可设置 `HERMES_CONTROL_MODE=isolated`。

- Leader / Specialist 两层 Agent 角色，自动任务拆解、执行、审查与汇总
- Web UI 实时观察多 Agent 对话、终端输出、工具调用与子任务流转
- Hermes Kanban 看板任务、自动派发、状态同步与任务归档
- Agent 初始化、批量启动 / 停止 / 重启
- 系统健康检查：统一展示数据库、Hermes、Kanban、MCP、实时事件和终端状态
- 模型配置管理，可为不同 Agent 应用不同模型配置
- 团队导入 / 导出，支持迁移 Agent profile、skills 与可选 workspace
- MCP Server 安装管理，支持 `http` / `streamable_http` / `stdio`
- Skill 安装管理，支持从 frontmatter 解析元信息
- SOUL.md 人设编辑
- 项目与任务工作空间：统一资料和交付目录、任务产物归集、实时在线预览、产物登记与下载
- Agent 对话：新建会话、查看历史、携带当前会话上下文继续聊天
- A2A 对话：两个 Agent 持久讨论、在线投递、离线排队、回复回流与失败重试

## 目录结构

```
app/             Flask 应用（controllers / services / models / db / static / templates）
  asgi.py        ASGI 入口，挂载 Flask + MCP Server
  mcp_server.py  暴露给 Agent 的 MCP 工具
  config.py      环境变量与路径配置
data/            SQLite 数据库（运行时生成，已 gitignore）
doc/             架构 / 设计 / 管理文档
tests/           pytest 测试
run.py           本地开发启动入口
agentswarm       Web 服务 start/stop/status/restart 管理命令
```

## 快速开始

### 1. 环境要求

- 控制台运行环境：Linux / macOS；Windows 推荐 WSL2
- Python 3.10+
- 已安装并完成模型配置的 [Hermes Agent](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/)
- Hermes CLI 需要支持 `profile`、`acp`、`kanban` 等子命令

> Hermes Agent 本身已支持原生 Windows，但本项目的嵌入式 Agent 终端依赖
> `pexpect`/POSIX PTY，因此原生 Windows 不是推荐部署方式。

### 2. 安装并验证 Hermes

Linux、macOS 或 WSL2：

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc  # zsh 用户改为 source ~/.zshrc
hermes setup
hermes profile list
hermes acp --help
hermes kanban --help
```

先运行一次 `hermes`，确认单 Agent 对话和模型调用正常，再安装本控制台。

### 3. 安装项目依赖

```bash
git clone <REPOSITORY_URL> agentswarm
cd agentswarm
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 4. 配置环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HERMES_CONTROL_MODE` | `shared` | `shared` 共用正常 Hermes 数据；`isolated` 使用项目隔离目录 |
| `HERMES_CLI` | `hermes` | Hermes CLI 可执行文件名或绝对路径 |
| `HERMES_HOME` | `~/.hermes` | Hermes profiles 根目录 |
| `AGENT_TEAM_WORKSPACE_ROOT` | `~/agent_team` | Agent 工作区根目录 |
| `DATABASE_URL` | `sqlite:///data/agent-swarm.db` | 数据库连接串 |
| `HERMES_AGENTS_MCP_URL` | `http://127.0.0.1:5050/mcp/` | MCP Bus 地址 |
| `HOST` | `127.0.0.1` | HTTP 监听地址 |
| `PORT` | `5050` | HTTP 服务端口 |
| `AGENT_TEAM_API_TOKEN` | 空 | `/api/*` Bearer Token；留空时不鉴权 |
| `FLASK_DEBUG` | `0` | 调试日志开关 |
| `AUTO_START_AGENTS` | `1` | 项目启动时自动启动所有已就绪 Agent；设为 `0` 可关闭 |
| `KANBAN_BOARD` | `agent-swarm` | Hermes Kanban board 名称 |
| `KANBAN_POLL_INTERVAL` | `2` | Kanban 状态同步轮询间隔（秒） |
| `KANBAN_DEFAULT_WORKSPACE` | `scratch` | Kanban 任务默认 workspace |
| `KANBAN_AUTO_DISPATCH` | `0` | 首次无持久化设置时，自动 Dispatch 开关的默认值 |

`.env.example` 是配置样例，应用不会自动读取 `.env`。本地启动可这样加载：

```bash
cp .env.example .env
# 按实际路径和安全要求编辑 .env
set -a
source .env
set +a
```

`shared` 模式建议不设置 `HERMES_HOME`，让控制台自动使用当前运行用户的
`~/.hermes`。服务必须与日常使用 Hermes 的用户一致，否则会接入另一个用户目录。

### 5. Hermes Kanban 调整

需要关闭 Hermes Agent 的 `config.yaml` 中的 `dispatch_in_gateway`：

```yaml
kanban:
  dispatch_in_gateway: false
```

### 6. 服务管理

首次使用时创建全局命令：

```bash
chmod +x agentswarm start.sh
sudo ln -sf "$(pwd)/agentswarm" /usr/local/bin/agentswarm
```

随后可统一管理服务：

```bash
agentswarm start
agentswarm status
agentswarm restart
agentswarm stop
```

未创建全局链接时使用 `./agentswarm <command>`。命令自动读取项目根目录的
`.env`；普通进程的 PID 和日志保存在 `.run/`。检测到
`agentswarm.service` 用户服务时，命令会自动转交给 systemd。当
`HOST=0.0.0.0` 时，`status` 会列出本机和局域网访问地址。

启动后访问 [http://127.0.0.1:5050](http://127.0.0.1:5050)。生产环境、
systemd、Nginx、升级、备份与故障排查见[部署与安装教程](doc/deployment.md)。

### 7. 运行测试

```bash
python -m pytest -q
```

浏览器交互回归使用 `node tests/team_ux.browser.cjs`，依赖配置与验证边界见
[UX 检查记录](doc/UX-REVIEW.md)。浏览器回归使用模拟 API，不等同于真实 Hermes 联调。

### 8. 接入并组建团队

1. 在“团队管理”创建团队，例如 `tech`。
2. 点击“新员工”，选择已有 Hermes Profile，设置角色与所属团队；先接入一个 Leader，再接入 Worker。
3. 在成员页面确认相关 Agent 已就绪并运行；已有注册成员可从“查看成员”加入或移出团队。
4. 在任务栏选择团队范围和具体接收 Agent，输入任务并点击“创建任务”；需要拆解协作时选择 Leader。
5. 在看板跟踪执行、阻塞和结果，查看 Leader 的复盘与交付。“全部团队”是查看/选择范围，不会向全部团队广播任务。

任务发送失败会显示原因并保留输入。删除团队前必须先移出成员；Agent Profile、技能和记忆保留。完整操作与排障见 [使用指南](doc/USER-GUIDE.md)。

### 9. Agent 对话

从侧栏“Agent 对话”或成员卡片“对话”进入，选择 Agent 后新建会话。聊天记录保存在数据库，可从历史列表继续；Enter 发送、Shift+Enter 换行。此入口直接调用 Hermes CLI，不自动创建看板任务。升级后重启服务以创建聊天表，详细接口与边界见 [Agent 对话](doc/AGENT-CHAT.md)。

A2A 讨论从侧栏“A2A 对话”进入，选择两个 Agent 后建立持续会话。接收 Agent 在线时立即处理，离线时消息保留到其启动后投递；详细状态与接口见 [A2A 对话](doc/A2A.md)。

## 文档

- [项目重规划与迭代路线图](doc/PROJECT-ROADMAP.md)
- [当前版本功能地图](doc/FEATURE-MAP.md)
- [使用指南](doc/USER-GUIDE.md)
- [Agent 对话与接口](doc/AGENT-CHAT.md)
- [A2A 对话与接口](doc/A2A.md)
- [项目工作区与产物管理](doc/PROJECTS.md)
- [架构设计](doc/ARCHITECTURE.md)
- [服务管理命令](doc/SERVICE-MANAGEMENT.md)
- [部署与安装教程](doc/deployment.md)
- [多团队说明](doc/MULTI-TEAM.md)
- [UX 检查与浏览器回归](doc/UX-REVIEW.md)
- [详细设计](doc/design.md)
- [MCP 管理](doc/mcp-management.md)
- [Skill 管理](doc/skills-management.md)
- [团队导入导出](doc/import-export.md)

## 维护说明

本项目作为开源项目发布，希望能为有需要的人提供参考和帮助。

由于个人时间和精力有限，本项目将以尽力而为的方式维护。我可能无法及时回复 Issue、审核 Pull Request，或提供持续的技术支持。

欢迎你根据自己的需要 Fork 本项目，并在此基础上自由修改和扩展。


## 示例

### 不同角色的描述

- **Leader Agent**：

```text
负责理解用户目标，拆解项目任务，选择合适的 worker 执行，并跟踪各环节结果。
```

- **产品 Agent**：

```text
负责把用户想法整理成清晰需求，定义功能范围、用户流程、优先级和验收标准。
```

- **开发 Agent**：

```text
负责根据需求完成技术方案、代码实现、接口设计等，不要做测试。
```

- **测试 Agent**：

```text
负责根据需求和实现设计测试用例，验证功能是否正确，并记录缺陷和风险。
```

- **设计 Agent**：

```text
负责页面结构、交互流程、视觉风格、组件规范和用户体验优化。
```

- **运维 Agent**：

```text
负责运行环境、部署流程、配置管理、日志排查、监控告警和上线风险控制。
```

### 任务提示词

发给 Leader Agent：

```text
请大家做一个自我介绍
```

```text
请组织团队分阶段协作，完成一个“待办清单”Web 项目。
目标：做成完整可用、适合快速演示的小功能，包含前端页面、后端接口和简单数据存储。页面风格是商务科技风格，风格要炫。使用未被占用的端口。
请严格分阶段执行：先只派产品 Agent 完成简短 PRD，并由 Leader review 通过后，才能派开发 Agent 实现前后端和存储；开发完成后再派测试 Agent 验证，测试 Agent 验证前必须先写测试用例文档再验证，再写测试报告。
完成标准：
1. 要有产品的 PRD 文档，开发的设计文档，开发的项目代码，测试的测试用例，和测试的测试报告。缺一不可，否则被定义为未完成
2. 务必在后台启动服务、确认可访问，并告诉我访问地址。
```

## 许可证

MIT

## 安全

安全注意事项见 [SECURITY.md](SECURITY.md)。

MCP headers/env 等敏感字段会在界面展示和导出时做脱敏处理；运行所需的真实凭据仍保存在本机 Hermes profile 配置中，请不要提交或公开这些本地配置文件。
