# 多团队 UX 检查记录

操作步骤见 [使用指南](USER-GUIDE.md)，团队规则见 [多团队说明](MULTI-TEAM.md)。

## 已修复

- 团队表单重复 DOM ID、双重提交监听，以及编辑后新建残留状态。团队编辑按原始 slug 保存，slug 只读。
- 团队页面的成员入口统一复用可增减成员的弹窗；成员操作防重复，加载失败可重试。
- 删除团队提示与后端规则一致：先移出成员，空团队才能删除，保留 Agent Profile。
- 新 Agent 接入可选择团队，角色提示改为每团队最多一个 Leader。
- 看板真正按团队 board 过滤；实时更新保留选中团队；成员筛选按 team_id 区分同名团队。
- 任务看板取消每列 30 条的截断；四列在页面可用高度内独立滚动，实时刷新保留滚动位置，并支持快速回到列顶部。
- 任务卡的“实时消息”改为持久的处理过程视图，展示提示词、运行摘要、Runs、Worker 日志和最终结果；轮询失败时保留上次记录，完成后可随时重新打开查看。
- 任务接收 Agent 选择器从隐藏区域移到发送栏；没有接收者时阻止提交。
- 修复提交反馈被 hidden 样式遮挡；发送失败保留内容，成功保留发送期间输入的新草稿，提交防重复。
- Agent 启停失败显示反馈；成员配置按钮可操作；成员搜索支持 Profile 与角色。
- 恢复 UI 覆盖样式加载；团队弹窗、小屏任务栏适配，任务卡支持 Enter/空格打开。

## 验证

Python 回归：`python -m pytest -q`。

浏览器回归：`node tests/team_ux.browser.cjs`；大量任务看板回归：`node tests/board_many_tasks.browser.cjs`。需要 Playwright Node 包、Flask Python 环境和 Edge；可用 `NODE_PATH` 指定包目录、`PYTHON` 指定 Python 可执行文件、`BROWSER_CHANNEL` 指定浏览器 channel（默认 msedge）。`UX_SCREENSHOT` 可指定截图输出路径。

浏览器测试实际渲染项目模板和前端脚本，拦截 API 使用模拟数据，不启动 Hermes，也不修改真实团队和 Profile。覆盖编辑/新建、重复提交、成员控件、同名团队过滤、实时筛选保留、任务处理记录刷新失败后的内容保留、失败重试、草稿保留、Agent 团队传参、DOM ID 唯一性、页面运行错误与 390px 布局。

### 最近一次验证记录

2026-09-06，UX 修复提交 `9080570`：Python 回归 158 通过、1 跳过；Edge 浏览器模拟 API 回归通过，JavaScript 语法检查和 Git 差异检查通过。此记录针对该提交，不代表之后所有修改都已验证。

### 运行环境示例

在仓库根目录运行。Playwright 是浏览器测试依赖，不包含在 Python requirements.txt 中；若安装在仓库外，设置 NODE_PATH 到包含 playwright 包的 node_modules 目录。测试默认使用已安装的 Edge，选择其他已安装浏览器可设置 BROWSER_CHANNEL。

PowerShell：

```powershell
$env:PYTHON = (Resolve-Path .venv/Scripts/python.exe).Path
$env:BROWSER_CHANNEL = "msedge"
node tests/team_ux.browser.cjs
```

Linux/macOS（虚拟环境与 Edge 已安装时）：

```bash
PYTHON="$PWD/.venv/bin/python" BROWSER_CHANNEL=msedge node tests/team_ux.browser.cjs
```

可选 UX_SCREENSHOT 为最终移动端团队弹窗截图文件路径，其父目录应已存在。测试完全拦截页面 HTTP 请求，不访问真实业务 API。

## 验证边界

真实 Hermes 进程启动、模型生成、跨团队执行回流尚未在浏览器中联调。本次浏览器验证覆盖 Edge；其他浏览器与真实移动设备仍需验收。统计页异步加载、全局鉴权输入体验和完整键盘焦点约束不在本轮修复范围内。
