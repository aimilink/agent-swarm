# 单 Agent 聊天

## 使用方法

1. 从侧栏进入“单 Agent 聊天”，或点击成员卡片上的“聊天”。
2. 选择聊天对象，点击“新建聊天”。Agent 需要已经注册；发送消息时需要处于已就绪状态。
3. 输入消息后点击“发送”或按 Enter；Shift+Enter 换行。中文输入法确认候选词时不会发送。
4. 在左侧“历史聊天”选择已有会话，查看消息并继续交流。列表按最近更新时间排序，标题默认取首条消息的前 60 个字符。
5. 切换 Agent 可查看该 Agent 的会话；新建聊天从空白记录开始。刷新页面后，重新选择历史会话即可继续。

本入口直接调用所选 Profile 的 Hermes CLI，无需先启动控制台中的 ACP 终端，也不要求团队 Leader 运行。控制台不会为这些消息自动创建 Kanban 任务。Profile 原有的模型、人设、记忆和工具配置仍会生效。

## 保存与上下文

- 会话保存在 `DATABASE_URL` 指向的数据库的 `agent_chats` 表；应用启动时自动创建新表。升级后重启服务并刷新页面。
- 每个会话保存 `chat_id`、`agent_id`、标题、消息 JSON、忙碌标记和更新时间。消息包含 `role`、`content`、`created_at`。
- 每次发送会启动独立 CLI 调用，将当前会话的用户消息和助手回复组成 JSON 文本传入提示词；错误提示不进入上下文。
- 新会话不携带其他 Web 会话的聊天记录，但仍共享同一 Profile 的持久记忆。这不是恢复 Hermes 原生会话 ID，也不导入已有 CLI/终端聊天记录。
- 当前没有历史分页、删除、重命名或聊天导出入口；团队导入导出不包含这些会话，保留记录需备份控制台数据库。

## 接口

所有路径均受现有 `/api/*` 认证规则保护。设置 `AGENT_TEAM_API_TOKEN` 时，请携带 `Authorization: Bearer <token>`。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/agents/<agent_id>/chats` | 返回该 Agent 的会话列表 |
| POST | `/api/agents/<agent_id>/chats` | 创建空会话，返回 HTTP 201 |
| GET | `/api/agents/<agent_id>/chats/<chat_id>` | 返回会话及消息 |
| POST | `/api/agents/<agent_id>/chats/<chat_id>/messages` | 发送消息并等待本次回复保存 |

发送请求体：

```json
{"content": "请介绍一下你的能力"}
```

列表响应为 `{"ok": true, "chats": [...]}`，创建、详情和发送响应为 `{"ok": true, "chat": {...}}`。会话字段为 `chat_id`、`agent_id`、`title`、`busy`、`updated_at`；详情额外包含 `messages`。

非法或空消息、超过 20000 字符返回 400；Agent/会话不存在或会话不属于路径中的 Agent 返回 404；Agent 未就绪或同会话正在回复返回 409。错误响应包含 `ok: false` 和 `error`。

CLI 调用失败会保存一条 `role: "error"` 消息并释放忙碌状态，此时 HTTP 响应仍为 200、`ok: true`，表示会话记录已保存；调用方需检查消息角色。

## 等待与异常恢复

- 当前回复为整段返回，不提供流式 Token 输出；单次 CLI 调用超时为 300 秒。
- 同一会话回复期间拒绝重复发送。页面显示“Agent 正在回复…”。
- 重新打开仍在回复的会话时，页面每 3 秒查询状态。忙碌记录超过 360 秒后，在下一次读取列表或详情时标记中断并解除锁定。
- 回复失败时检查 Hermes CLI 路径和 Profile 模型配置，再重新发送。网络错误后先查看历史记录，确认消息是否已保存。
- 当前会话全文通过命令行参数传递，长会话受操作系统参数长度和模型上下文限制；遇到长度限制时新建聊天。

## 验证

```bash
python -m pytest tests/test_agent_chats.py -q
node tests/agent_chat.browser.cjs
```

浏览器脚本需要 Node.js、可通过 `NODE_PATH` 解析的 `playwright` 包和本机 Microsoft Edge。测试使用模拟 API，不调用真实模型。

本次验证：项目 pytest 为 161 项通过、1 项跳过；聊天浏览器回归通过，覆盖新建、发送、历史切换、Agent 隔离及 HTML 转义。当前验证环境没有可用 Hermes CLI，真实模型回复尚未联调。

实现位置：`app/controllers/agent_chats.py`、`app/db/models.py`、`app/static/agent-chat.js`、`app/static/agent-chat.css`；CLI 执行复用 `app/services/chat.py`。
