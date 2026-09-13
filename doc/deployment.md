# 部署与安装教程

本文面向第一次安装、长期运行和版本升级。默认采用 `shared` 模式：
控制台直接编排当前用户的 Hermes Profile，单 Agent 与团队模式共享同一份数据。

## 1. 部署模型

推荐拓扑：

```text
浏览器
  -> HTTPS / 反向代理（可选）
  -> Hermes Agents Team :5050
       -> ~/.hermes/profiles/*       # SOUL、Skill、记忆、模型、MCP
       -> data/hermes_agent_team.db  # 团队、成员、任务、消息、编排状态
       -> workspace/*                # 团队任务工作区
       -> Hermes CLI / ACP / Kanban
```

部署原则：

- 使用日常运行 Hermes 的同一个操作系统用户启动控制台。
- `shared` 模式不要复制 Profile；控制台直接连接该用户的 `~/.hermes`。
- 不要让两个控制台进程同时写同一个 SQLite 数据库。
- 默认只监听 `127.0.0.1`；对外服务应增加 HTTPS、统一鉴权或 VPN。

## 2. 环境要求

- Linux 或 macOS；Windows 用户推荐 WSL2。
- Python 3.10+、Git、可用的 C/C++ 基础构建环境。
- 已配置模型并能正常对话的 Hermes Agent。
- Hermes CLI 支持 `profile`、`acp` 和 `kanban`。

Hermes Agent 自身支持原生 Windows，但本项目的嵌入式 Agent 终端依赖
`pexpect`/POSIX PTY，因此原生 Windows 不作为生产部署目标。

## 3. 安装 Hermes Agent

Linux、macOS 或 WSL2 使用官方安装器：

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
source ~/.bashrc  # zsh 用户改为 source ~/.zshrc
hermes setup
```

安装后逐项验证：

```bash
command -v hermes
hermes --help
hermes profile list
hermes acp --help
hermes kanban --help
hermes
```

最后一条命令用于确认单 Agent 模式可以正常调用模型。若这里失败，应先修复
Hermes 的模型或凭据配置，再继续安装控制台。

官方资料：

- [Hermes Quickstart](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/)
- [Hermes Agent GitHub](https://github.com/NousResearch/hermes-agent)

## 4. 安装 Hermes Agents Team

将 `<REPOSITORY_URL>` 替换为实际仓库地址：

```bash
mkdir -p ~/apps
cd ~/apps
git clone <REPOSITORY_URL> hermes-agent-team
cd hermes-agent-team

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

确认 Python 依赖：

```bash
python -c "import flask, uvicorn, pexpect, sqlalchemy; print('dependencies ok')"
```

## 5. 配置

复制样例：

```bash
cp .env.example .env
chmod 600 .env
```

应用不会自动读取 `.env`。前台运行时需要用 shell 加载；systemd 部署则由
`EnvironmentFile` 加载。

### 5.1 shared 模式（推荐）

最小配置：

```dotenv
HERMES_CONTROL_MODE=shared
HERMES_CLI=hermes
HOST=127.0.0.1
PORT=5050
FLASK_DEBUG=0
AUTO_START_AGENTS=1
KANBAN_AUTO_DISPATCH=0
```

建议不填写 `HERMES_HOME`，程序会使用运行用户的 `~/.hermes`。若 systemd
找不到 Hermes，执行 `command -v hermes` 并把结果作为绝对路径写入
`HERMES_CLI`。

### 5.2 isolated 模式

需要进行演示、测试或与日常 Profile 完全隔离时：

```dotenv
HERMES_CONTROL_MODE=isolated
HERMES_HOME=/home/your-user/apps/hermes-agent-team/hermes-home
AGENT_TEAM_WORKSPACE_ROOT=/home/your-user/apps/hermes-agent-team/workspace
```

`HERMES_HOME` 必须使用绝对路径。切换模式不会自动迁移 Profile 或数据库。

### 5.3 端口与 MCP 地址

`PORT` 与 `HERMES_AGENTS_MCP_URL` 必须一致：

```dotenv
PORT=5050
HERMES_AGENTS_MCP_URL=http://127.0.0.1:5050/mcp/
```

Agent 与控制台位于同一台主机时，应保留环回地址，避免 MCP 暴露到公网。

### 5.4 API Token

生成随机 Token：

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

写入：

```dotenv
AGENT_TEAM_API_TOKEN=替换为生成的随机值
```

页面首次访问会显示 Token 输入框：启用时输入对应值，未启用时可取消。输入值会
保存到浏览器 localStorage。该 Token 覆盖 `/api/*` REST 与 SSE 请求，但不能
替代整站反向代理鉴权。终端
WebSocket 与 `/mcp/` 仍应通过本机监听、防火墙、VPN 或反向代理限制访问。

### 5.5 Hermes Kanban

在 Hermes Profile 的 `config.yaml` 中关闭 gateway 内部 dispatch，避免和
控制台调度器重复派工：

```yaml
kanban:
  dispatch_in_gateway: false
```

## 6. 前台启动与首次验证

```bash
set -a
source .env
set +a
./start.sh
```

也可以在虚拟环境中直接运行：

```bash
source .venv/bin/activate
python run.py
```

浏览器打开 `http://127.0.0.1:5050`。然后：

1. 打开“新员工”。
2. 从 Hermes Profile 候选中选择已有 Profile，或输入新名称。
3. 将 Agent 加入团队并设置 Leader/Worker。
4. 在 Hermes CLI 单独打开同一 Profile，确认 Skill、记忆与配置仍然存在。
5. 从页面发送一个小任务，观察消息、看板和终端状态。

接口验证：

```bash
curl -fsS http://127.0.0.1:5050/
curl -fsS -H "Authorization: Bearer $AGENT_TEAM_API_TOKEN" http://127.0.0.1:5050/api/hermes/status
curl -fsS -H "Authorization: Bearer $AGENT_TEAM_API_TOKEN" http://127.0.0.1:5050/api/dashboard
```

未配置 `AGENT_TEAM_API_TOKEN` 时去掉 Authorization Header。

## 7. systemd 用户服务

用户服务能确保 `HOME`、Hermes Profile 所有者和 CLI 用户保持一致。假设项目位于
`~/apps/hermes-agent-team`：

```bash
mkdir -p ~/.config/systemd/user
```

创建 `~/.config/systemd/user/hermes-agent-team.service`：

```ini
[Unit]
Description=Hermes Agents Team
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/apps/hermes-agent-team
EnvironmentFile=%h/apps/hermes-agent-team/.env
ExecStart=%h/apps/hermes-agent-team/start.sh
Restart=on-failure
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=default.target
```

启用：

```bash
chmod +x ~/apps/hermes-agent-team/start.sh
systemctl --user daemon-reload
systemctl --user enable --now hermes-agent-team
systemctl --user status hermes-agent-team
journalctl --user -u hermes-agent-team -f
```

如需退出登录后仍保持运行，可由管理员执行：

```bash
sudo loginctl enable-linger "$USER"
```

## 8. Nginx 反向代理

仅在需要跨主机访问时使用。控制台仍监听 `127.0.0.1:5050`，Nginx 负责
TLS、访问控制以及 WebSocket/SSE 转发。

```nginx
location / {
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

不要把未配置 TLS、统一鉴权和网络访问控制的实例直接暴露到公网。

## 9. 备份与升级

### 9.1 备份

升级前至少备份：

- `data/hermes_agent_team.db`：团队、成员、消息和任务关系。
- `~/.hermes/profiles/`：共享 Profile 的 SOUL、Skill、记忆和配置。
- `workspace/` 或自定义 `AGENT_TEAM_WORKSPACE_ROOT`：任务产物。
- `.env`：部署参数和 Token；备份文件必须限制权限。

示例：

```bash
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "$HOME/backups/hermes-agent-team-$stamp"
cp data/hermes_agent_team.db "$HOME/backups/hermes-agent-team-$stamp/"
cp .env "$HOME/backups/hermes-agent-team-$stamp/env"
tar -czf "$HOME/backups/hermes-agent-team-$stamp/profiles.tar.gz" -C "$HOME/.hermes" profiles
```

### 9.2 升级

```bash
cd ~/apps/hermes-agent-team
systemctl --user stop hermes-agent-team
git status --short
git pull --ff-only
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pytest -q
systemctl --user start hermes-agent-team
systemctl --user status hermes-agent-team
```

如 `git status` 显示本地改动，先提交或备份，不要强制覆盖。

## 10. 常见问题

| 现象 | 检查与处理 |
|---|---|
| 页面提示找不到 Hermes CLI | 在服务用户下执行 `command -v hermes`，把绝对路径写入 `HERMES_CLI`。 |
| 页面没有已有 Profile | 检查服务用户是否正确，以及 `HERMES_HOME` 是否指向预期目录。 |
| Profile 在团队里新增 Skill 后，CLI 看不到 | 确认使用 `shared` 模式，并确保 CLI 与服务使用同一个 `HERMES_HOME`。 |
| Agent 无法启动终端 | 验证 `hermes acp --help`，并确认运行环境支持 POSIX PTY。 |
| 看板任务未派发 | 检查 `hermes kanban --help`、页面自动 Dispatch 设置和 `dispatch_in_gateway`。 |
| systemd 启动但 CLI 不可用 | systemd 的 PATH 较短；在 `.env` 中设置 `HERMES_CLI` 绝对路径。 |
| 端口已占用 | 修改 `PORT`，并同步修改 `HERMES_AGENTS_MCP_URL`。 |
| 浏览器持续 401 | 清除站点 localStorage 后重新输入 Token，或核对 `AGENT_TEAM_API_TOKEN`。 |
| SSE/终端在 Nginx 后断开 | 关闭代理缓冲、提高 read timeout，并保留 WebSocket Upgrade Header。 |
| SQLite 被锁定 | 确认同一个 `DATABASE_URL` 只运行一个控制台进程。 |

## 11. 卸载控制台

停止服务后可删除项目目录和 systemd 用户服务。`shared` 模式下，
`~/.hermes/profiles` 是 Hermes 的持久数据，不属于控制台临时文件，不应随控制台
一起删除。移除团队成员同样只解除编排关系，不删除 Profile。

## 系统健康检查

服务启动后，从工作台顶部查看数据库、Hermes CLI、Kanban、MCP、实时事件和
Agent 终端状态，也可以调用：

```bash
curl http://127.0.0.1:5050/api/system/health
curl "http://127.0.0.1:5050/api/system/health?refresh=1"
```

配置 `AGENT_TEAM_API_TOKEN` 时需按其他 API 的方式携带 Bearer Token。普通请求使用
30 秒服务端缓存；`refresh=1` 会执行新的只读检查。整体状态含义：

- `ready`：全部组件可用。
- `degraded`：控制台仍可访问，但一个或多个执行组件需要处理。
- `unavailable`：数据库不可用，核心数据读写不能保证。

页面刷新失败时保留上次成功结果并显示“数据可能已过期”。组件卡片提供固定的恢复建议，
不会返回 API Key、Header、完整命令或本机隐私路径。Hermes/Kanban 不可用时，先确认
`hermes profile list` 和 `hermes kanban boards list --json` 能在服务用户环境中运行。
MCP 显示未就绪时，重启服务并检查启动日志。终端状态不一致时，从“Agent 与团队”页面重启
对应 Agent。
