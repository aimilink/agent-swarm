from __future__ import annotations

import os
import time

import pytest

from app.services.workspace_shell import WorkspaceShell


def test_workspace_shell_is_explicitly_linux_only(tmp_path):
    shell = WorkspaceShell(tmp_path, rows=1, cols=999)
    assert shell.rows == 4
    assert shell.cols == 400
    if os.name != "posix":
        with pytest.raises(RuntimeError, match="Linux/Unix"):
            shell.start()


@pytest.mark.skipif(os.name != "posix", reason="Linux PTY integration")
def test_workspace_shell_runs_commands_in_project_directory(tmp_path):
    (tmp_path / "marker.txt").write_text("workspace-ok", encoding="utf-8")
    shell = WorkspaceShell(tmp_path)
    shell.start()
    try:
        shell.write("printf 'cwd=%s\\n' \"$PWD\"; cat marker.txt; printf '\\n'; exit\\n")
        chunks = []
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            chunk = shell.read(0.2)
            if chunk:
                chunks.append(chunk)
            if shell.poll() is not None:
                break
        output = b"".join(chunks).decode("utf-8", errors="replace")
        assert f"cwd={tmp_path}" in output
        assert "workspace-ok" in output
    finally:
        shell.close()
