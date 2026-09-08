# 项目工作区

项目工作区把团队协作的资料、代码和交付文件归到同一个项目。Agent 的 Profile、模型、技能和持久记忆继续独立保存；项目任务的执行目录统一指向项目目录。

## 使用流程

1. 重启服务并刷新页面，从侧栏进入“项目工作区”。新表在启动时自动创建。
2. 点击“新建项目”，填写名称以及目标、预期交付和验收标准。
3. 系统在 `PROJECTS_ROOT/<project_id>/` 下创建 `PROJECT.md`、`docs/`、`src/`、`tests/`、`deliverables/`。默认根目录为项目仓库的 `workspace/projects`。
4. 将已有资料复制到该项目目录，完善 `PROJECT.md`。项目页显示目录位置，可浏览和下载文件。
5. 在项目页“创建项目任务”选择 Agent 并填写目标、参考资料和预期交付路径；需要组织协作时选择 Leader。该入口沿用现有团队就绪、运行状态及 Worker 直派约束。
6. Leader 通过现有 MCP 工具派发 Worker 子任务。父任务、Worker、复盘、跨团队委派、人工输入及续接任务继承项目目录和项目 ID。
7. Agent 完成文件后调用 `register_project_artifact`，登记路径、任务、负责人、摘要和验证结果；无此工具的 Worker 在完成摘要中返回这些信息，由 Leader 代登记。用户也可以在项目页登记已有文件。
8. 项目页“交付产物”集中展示记录。登记表示文件已提交，Leader 仍需检查文件和验证结果，不能把登记当成验收通过。点击“刷新项目”获取最新任务、文件和产物。

普通看板入口创建的任务维持原有行为。需要项目归属的任务，请从项目页面创建；已有分散资料和历史任务不会自动迁移或绑定。

## 文件与协作约束

- 项目 ID 为系统生成的唯一 ID，同名项目不会覆盖目录。
- 列表最多返回 500 个文件；隐藏目录、隐藏文件、`node_modules`、`__pycache__` 和符号链接不展示。
- 下载和登记只接受项目内现存文件的相对路径，拒绝绝对路径、路径穿越和指向项目外的符号链接。
- 相同项目、相同路径再次登记会更新记录。文件被删除后，产物显示“文件已缺失”；记录不会自动删除。
- 登记必须关联当前项目中的 Kanban 任务；跨项目登记会被拒绝。
- 文件共享不提供写锁。Leader 必须按文件/目录分工；并行改同一份代码时自行建立 Git worktree，并安排集成任务。当前不自动创建 worktree、合并代码或执行验收。
- 本版不提供项目删除、文件上传、历史版本、自动归档或项目完成状态。资料可通过本地目录放入；页面提供浏览、下载和产物登记。
- 任务提示会要求使用项目目录，但不是文件系统沙箱，Agent 的实际工具权限仍由运行环境决定。

## API 与 MCP

API 使用现有 `/api/*` Bearer Token 认证规则。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET / POST | `/api/projects` | 列出项目 / 创建项目（`name`, `description`） |
| GET | `/api/projects/<project_id>` | 项目详情、关联任务和登记产物 |
| POST | `/api/projects/<project_id>/tasks` | 创建项目任务（`content`, `to_agent_id`） |
| GET | `/api/projects/<project_id>/files` | 列出项目文件，返回 `files`、`truncated` |
| GET | `/api/projects/<project_id>/file?path=docs/design.md` | 下载项目内文件 |
| POST | `/api/projects/<project_id>/artifacts` | 登记产物 |

产物请求示例：

```json
{
  "path": "docs/design.md",
  "title": "接口设计",
  "task_id": "当前项目的 Kanban 任务 ID",
  "agent_id": "提交 Agent ID（手动登记可省略）",
  "summary": "定义接口与数据结构",
  "validation": "已与需求逐项核对"
}
```

Agent Bus 新增 MCP 工具：

- `get_project(project_id)`：读取项目详情、任务和产物清单。
- `register_project_artifact(project_id, path, title, task_id, agent_id, summary, validation)`：登记或更新项目产物。

已有运行进程可能需要重启才能重新发现 MCP 工具。Worker 默认未必接入 Agent Bus，可由已接入的 Leader 代登记，或手动配置 Worker 的 MCP。

## 存储与备份

`projects` 表保存项目名称、目标、目录和创建时间；`project_artifacts` 保存登记记录。任务的 `kanban_task_links.metadata` 保存 `project_id` 和 `project_workspace`，沿用现有持久化机制。

备份需同时包含控制台数据库和 `PROJECTS_ROOT` 文件目录。现有团队导入导出不包含项目文件和产物登记。配置 `PROJECTS_ROOT` 只影响新建项目，不会迁移已有目录。

## 验证

```bash
python -m pytest tests/test_projects.py -q
node tests/projects.browser.cjs
```

浏览器测试依赖 Playwright 和 Microsoft Edge，按已有浏览器回归方式设置 `NODE_PATH` 和 `PYTHON`。测试使用模拟 Kanban/API；真实 Hermes 调用、模型遵守目录约定及产物登记需要在部署环境联调。
