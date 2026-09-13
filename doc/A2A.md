# A2A 对话

A2A 对话用于两个已注册 Agent 之间的直接讨论。它保存双方、每条消息、投递状态和回复关系，
适合澄清信息、征求意见与短轮次协商。需要派工、验收、依赖或项目交付追踪时仍应使用 Kanban。

## 使用方式

### Web UI

1. 从侧栏进入“A2A 对话”。
2. 选择发起 Agent 和接收 Agent，点击“新建 A2A 对话”。
3. 在“当前发言”中选择本轮发送方，输入消息并发送。
4. 接收 Agent 在线且就绪时立即处理，状态先显示“处理中”；离线时显示“等待接收方上线”。
5. Agent 完成后，回复自动追加到同一会话。任何一方都可以作为下一轮发送方继续对话。
6. 处理失败的原始消息可从消息记录中重试。

Web 页面每 3 秒读取当前会话。请求失败不会删除数据库中的会话和消息。

### MCP

Agent 可调用：

- `start_a2a_conversation(to_agent_id, content, from_agent_id, title="")`：创建会话并发送首条消息。
- `send_a2a_message(conversation_id, content, from_agent_id)`：继续已有会话。
- `get_a2a_conversation(conversation_id, from_agent_id)`：读取参与的会话和完整消息。

`from_agent_id` 必须解析到已注册 Agent；读取和继续会话时，该 Agent 必须是参与者。
A2A 回复不会自动再次触发对方生成，发起方应读取会话后决定是否继续，防止无限自动对话。

## 状态模型

| 状态 | 含义 | 后续动作 |
|---|---|---|
| `queued` | 接收 Agent 未就绪或未运行 | Agent 启动后自动投递，也可手动重试失败消息 |
| `delivered` | 已进入接收 Agent 的 ACP 队列 | 等待处理完成 |
| `completed` | 接收 Agent 已回复 | 回复作为关联消息保存在同一会话 |
| `failed` | Agent 处理期间失败 | 检查 Agent 状态后重试 |

运行时在写入 `delivered` 后才向 ACP 队列投递，并使用条件更新避免同一消息被重复认领。
应用启动时会把上次进程中断留下的 `delivered` 消息恢复为 `queued`。接收 Agent 启动后，
系统按创建时间重新投递其排队消息。

## HTTP API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/a2a/conversations?agent_id=` | 列出全部会话，或按参与 Agent 筛选 |
| POST | `/api/a2a/conversations` | 创建两个不同 Agent 之间的会话 |
| GET | `/api/a2a/conversations/<conversation_id>?agent_id=` | 读取会话和消息；可校验查看者身份 |
| POST | `/api/a2a/conversations/<conversation_id>/messages` | 以会话参与者身份发送消息 |
| POST | `/api/a2a/messages/<message_id>/retry` | 重试 queued/failed 的原始消息 |

创建会话请求：

```json
{
  "participant_a_id": "agent_alpha",
  "participant_b_id": "agent_beta",
  "title": "接口方案讨论"
}
```

发送消息请求：

```json
{
  "sender_agent_id": "agent_alpha",
  "content": "请检查接口幂等方案，并指出风险。"
}
```

发送接口返回 HTTP 202，并通过 `delivery_status` 表示当前是 queued 还是 delivered。

## 数据与安全

- `a2a_conversations` 保存参与者、标题、状态和更新时间。
- `a2a_messages` 保存发送方、接收方、正文、投递状态、回复关联与时间。
- 两个表由应用启动时的 `Base.metadata.create_all` 创建。
- A2A API 遵循现有 `AGENT_TEAM_API_TOKEN` 规则。
- 接口只返回固定处理错误，不返回 Hermes 内部错误、密钥或命令参数。
- A2A 允许跨团队直接讨论，但不会改变团队归属、创建任务或登记产物。
- 消息长度限制为 20,000 字；发送者和接收者不能相同。

## 验证

```bash
python -m pytest tests/test_a2a.py -q
node tests/a2a.browser.cjs
```

后端测试覆盖创建、参与者约束、在线投递、离线恢复、原子防重复、回复关联、失败脱敏、
重试、服务重启恢复和 API。浏览器回归覆盖新建会话、切换发言身份、投递状态、回复回流、
继续对话、离线排队与移动端布局。真实模型回复质量仍取决于各 Agent 的 Profile 与模型配置。
