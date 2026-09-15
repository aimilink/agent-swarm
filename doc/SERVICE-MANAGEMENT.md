# AgentSwarm 服务管理

项目根目录的 `agentswarm` 命令用于管理 Web 服务：

```bash
agentswarm start
agentswarm stop
agentswarm status
agentswarm restart
```

未安装全局命令时，可以在项目根目录执行 `./agentswarm <command>`。原
`agentweave` 命令作为兼容入口保留，会提示更名并转发全部参数。

## 1. 安装命令

在项目根目录执行：

```bash
chmod +x agentswarm start.sh
sudo ln -sf "$(pwd)/agentswarm" /usr/local/bin/agentswarm
```

命令可以通过软链接定位真实项目目录。若不能写入 `/usr/local/bin`，直接使用
`./agentswarm`，或将项目目录加入 `PATH`。

## 2. 命令行为

| 命令 | 行为 |
|---|---|
| `start` | 加载 `.env`，后台启动服务并写入 PID；服务已经运行时直接返回成功。 |
| `stop` | 发送 TERM 并等待最多 15 秒；超时后强制结束；服务未运行时直接返回成功。 |
| `status` | 显示运行状态、PID、访问地址和日志路径。 |
| `restart` | 在同一把管理锁内依次停止和启动，避免并发命令产生重复进程。 |

`status` 在运行时返回 0，停止时返回 3。参数错误返回 2，启动失败返回 1。

## 3. 普通进程模式

没有检测到用户级 `agentswarm.service` 时，命令直接管理项目进程：

```text
agentswarm
  -> 加载 <项目>/.env
  -> 调用 <项目>/start.sh
  -> .venv/bin/python run.py
```

默认运行文件：

| 路径 | 用途 |
|---|---|
| `.run/agentswarm.pid` | 当前服务 PID。 |
| `.run/agentswarm.log` | 标准输出与错误日志。 |
| `.run/control.lock` | start、stop、restart 的短期互斥锁。 |

`.run/` 已加入 `.gitignore`。进程异常退出后，下一次命令会自动清理失效 PID。

查看日志：

```bash
tail -f .run/agentswarm.log
```

## 4. systemd 模式

如果 `systemctl --user cat agentswarm.service` 成功，管理命令会自动转交给用户级
systemd。若新单元不存在但检测到旧 `agentweave.service`，也会继续管理旧单元：

```text
agentswarm start    -> systemctl --user start agentswarm.service
agentswarm stop     -> systemctl --user stop agentswarm.service
agentswarm status   -> systemctl --user --no-pager status agentswarm.service
agentswarm restart  -> systemctl --user restart agentswarm.service
```

systemd 服务的安装方式见[部署与安装教程](deployment.md#7-systemd-用户服务)。此模式
由 systemd 维护进程状态，不使用项目内 PID 文件。日志通过以下命令查看：

```bash
journalctl --user -u agentswarm -f
```

## 5. 路径与环境变量

命令启动前自动以 shell 方式读取项目根目录的 `.env`。现有的 `HOST`、`PORT`、
`HERMES_HOME`、`DATABASE_URL` 等服务变量继续由 `start.sh` 使用。

管理命令还支持：

| 变量 | 默认值 | 用途 |
|---|---|---|
| `AGENTSWARM_HOME` | 命令文件所在项目目录 | 显式指定项目根目录。 |
| `AGENTSWARM_RUN_DIR` | `<项目>/.run` | 修改 PID 和锁目录。 |
| `AGENTSWARM_LOG_FILE` | `<运行目录>/agentswarm.log` | 修改普通进程日志路径。 |

升级时仍兼容 `AGENTWEAVE_HOME`、`AGENTWEAVE_RUN_DIR` 和
`AGENTWEAVE_LOG_FILE`；同名的新变量优先。检测到旧
`.run/agentweave.pid` 时会自动迁移并继续管理该进程。

## 6. 常见问题

| 现象 | 处理 |
|---|---|
| 提示找不到 `.venv/bin/python` | 在项目目录创建虚拟环境并安装 `requirements.txt`。 |
| 启动后立即失败 | 查看 `.run/agentswarm.log`，检查端口、依赖和 `.env`。 |
| `status` 显示停止，但页面仍可访问 | 可能存在 systemd 之外手工启动的旧进程；核对监听端口和启动用户。 |
| 提示另一个管理命令正在运行 | 等待当前 start、stop 或 restart 完成后重试。 |
| systemd 模式状态异常 | 执行 `systemctl --user status agentswarm` 和 `journalctl --user -u agentswarm -n 100`。 |
