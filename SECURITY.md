# Security Policy

本项目当前定位为本地开发与实验工具，仅建议在本机或可信内网环境运行。不要在未加鉴权、访问控制和 HTTPS 保护的情况下直接暴露到公网。

## 敏感信息

请不要提交或公开以下内容：

- `.env` 或任何包含真实环境变量的配置文件
- `data/` 下的数据库文件，例如 SQLite 运行时数据库
- Hermes profile 配置、记忆、工作区内容或 `config.yaml`
- MCP server 的 URL、headers、env、token、API key、password、secret 等凭据
- 任何真实用户数据、对话记录、日志或终端输出中的敏感片段

## 建议

- 使用 `.env.example` 作为配置模板，不要把真实 `.env` 加入版本控制。
- `shared` 模式直接读写运行用户的 `~/.hermes`；只使用同一受信任用户运行服务，
  并将 Profile、SQLite 与 workspace 一起备份。
- 设置高强度 `AGENT_TEAM_API_TOKEN`。它保护 `/api/*` 与 SSE，但不覆盖
  整站页面、终端 WebSocket 和 `/mcp/`。
- 默认保持 `HOST=127.0.0.1`。需要远程访问时，通过 VPN 或带 TLS 与统一鉴权的
  反向代理开放，不要直接监听公网地址。
- 同一个 SQLite 数据库只运行一个控制台写进程。
- 发布前检查 `git status` 和 `git diff`，确认没有敏感文件或凭据。
- 如果需要部署到共享环境，请先增加认证、权限控制、CSRF 防护、HTTPS 和 secret 加密存储。

完整部署加固说明见 [部署与安装教程](doc/deployment.md)。
