from __future__ import annotations

import os
import select
import shutil
import signal
import struct
import subprocess
from pathlib import Path


class WorkspaceShell:
    def __init__(self, cwd: str | Path, rows: int = 28, cols: int = 100) -> None:
        self.cwd = Path(cwd).resolve()
        self.rows = max(4, min(int(rows), 200))
        self.cols = max(20, min(int(cols), 400))
        self.master_fd: int | None = None
        self.process: subprocess.Popen | None = None

    def start(self) -> None:
        if os.name != "posix":
            raise RuntimeError("工作区 Linux 终端只能在 Linux/Unix 服务端运行")
        if not self.cwd.is_dir():
            raise RuntimeError("项目工作目录不存在")
        import pty

        shell = (os.environ.get("AGENT_TEAM_WORKSPACE_SHELL") or "/bin/bash").strip()
        executable = shutil.which(shell) if not Path(shell).is_absolute() else shell
        if not executable or not Path(executable).exists():
            executable = shutil.which("bash") or shutil.which("sh")
        if not executable:
            raise RuntimeError("服务端未找到可用的 Linux Shell")
        master_fd, slave_fd = pty.openpty()
        self.master_fd = master_fd
        self._resize_fd(slave_fd, self.rows, self.cols)
        env = os.environ.copy()
        env.update({"TERM": "xterm-256color", "COLORTERM": "truecolor"})
        argv = [executable, "-l"] if Path(executable).name in {"bash", "zsh"} else [executable]
        try:
            self.process = subprocess.Popen(
                argv,
                cwd=self.cwd,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                env=env,
                start_new_session=True,
                close_fds=True,
            )
        except OSError as exc:
            os.close(master_fd)
            self.master_fd = None
            raise RuntimeError(f"无法启动工作区 Shell: {exc}") from exc
        finally:
            os.close(slave_fd)

    @staticmethod
    def _resize_fd(fd: int, rows: int, cols: int) -> None:
        import fcntl
        import termios

        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    def resize(self, rows: int, cols: int) -> None:
        self.rows = max(4, min(int(rows), 200))
        self.cols = max(20, min(int(cols), 400))
        if self.master_fd is not None:
            self._resize_fd(self.master_fd, self.rows, self.cols)

    def write(self, data: str) -> None:
        if self.master_fd is not None and data:
            os.write(self.master_fd, data.encode("utf-8", errors="replace"))

    def read(self, timeout: float = 0.25) -> bytes:
        if self.master_fd is None:
            return b""
        ready, _, _ = select.select([self.master_fd], [], [], timeout)
        if not ready:
            return b""
        try:
            return os.read(self.master_fd, 65536)
        except OSError:
            return b""

    def poll(self) -> int | None:
        return self.process.poll() if self.process is not None else 0

    def close(self) -> None:
        process, self.process = self.process, None
        master_fd, self.master_fd = self.master_fd, None
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=2)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except OSError:
                    pass
        if master_fd is not None:
            try:
                os.close(master_fd)
            except OSError:
                pass
