from __future__ import annotations

import os
import subprocess
import threading
import time
from pathlib import Path

import yaml

from ..config import (
    HERMES_CLI,
    HERMES_CONTROL_MODE,
    HERMES_HOME,
    PROFILE_NAME_RE,
)


class ProfileError(RuntimeError):
    """Raised when the hermes CLI fails for a non-business reason."""


_PROFILE_LOCKS: dict[str, threading.RLock] = {}
_PROFILE_LOCKS_GUARD = threading.Lock()
_MODEL_SUMMARY_CACHE: dict[str, tuple[float, int, int, dict]] = {}
_MODEL_SUMMARY_CACHE_LOCK = threading.Lock()
_MODEL_SUMMARY_CACHE_TTL_SECONDS = 2.0


def _profile_lock(profile_name: str) -> threading.RLock:
    """Serialize read-modify-write operations for one shared profile."""
    key = str(_profile_config_path(profile_name).resolve(strict=False))
    with _PROFILE_LOCKS_GUARD:
        return _PROFILE_LOCKS.setdefault(key, threading.RLock())


def hermes_command_env(extra: dict[str, str] | None = None) -> dict[str, str]:
    """Return a process-local Hermes environment without changing the user's shell."""
    env = os.environ.copy()
    env["HERMES_HOME"] = str(HERMES_HOME)
    if extra:
        env.update(extra)
    return env


def check_hermes_ready() -> dict:
    """Return whether the local Hermes CLI is usable for profile cloning."""
    try:
        result = subprocess.run(
            [HERMES_CLI, "profile", "list"],
            capture_output=True,
            text=True,
            timeout=15,
            env=hermes_command_env(),
        )
    except FileNotFoundError:
        return {
            "ok": False,
            "reason": "not_found",
            "message": "未检测到 hermes CLI，请先安装并配置 Hermes Agent。",
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "reason": "timeout",
            "message": "Hermes 响应超时，请确认 Hermes Agent 已正确配置。",
        }

    output = (result.stdout or result.stderr or "").strip()
    if result.returncode != 0:
        return {
            "ok": False,
            "reason": "command_failed",
            "message": "Hermes 当前不可用，请先完成 Hermes Agent 配置。",
            "detail": output,
        }

    profiles = sorted(
        set(_parse_profile_list(result.stdout or "")) | set(_profile_names_on_disk())
    )
    if not profiles:
        return {
            "ok": False,
            "reason": "no_profiles",
            "message": "未检测到可用 Hermes profile，请先配置 Hermes Agent。",
        }

    return {
        "ok": True,
        "profiles": profiles,
        "control_mode": HERMES_CONTROL_MODE,
        "hermes_home": str(HERMES_HOME),
        "message": "Hermes 已就绪",
    }


def _profile_config_path(profile_name: str) -> Path:
    return HERMES_HOME / "profiles" / profile_name / "config.yaml"


def create_hermes_profile(profile_name: str) -> bool:
    """Invoke `hermes profile create <name> --clone --no-alias`.

    `--clone` inherits the active profile's model/config so the new profile
    is immediately usable (otherwise Model is empty and chat won't run).
    Existing profiles are attached in place so standalone and team modes share
    the same skills, memories and experience. Returns True only when created.
    """
    if profile_name in list_hermes_profiles() or _profile_config_path(profile_name).exists():
        return False
    cmd = [HERMES_CLI, "profile", "create", profile_name, "--clone", "--no-alias"]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            env=hermes_command_env(),
        )
    except FileNotFoundError as exc:
        raise ProfileError("hermes CLI not found in PATH") from exc
    except subprocess.TimeoutExpired as exc:
        raise ProfileError("hermes profile create timed out") from exc
    if result.returncode == 0:
        return True
    stderr = (result.stderr or result.stdout or "").strip()
    if "already exists" in stderr.lower():
        return False
    raise ProfileError(stderr or "hermes profile create failed")


def list_hermes_profiles() -> list[str]:
    """Read current profile names from both Hermes CLI and Hermes Home."""
    cli_profiles: list[str] = []
    try:
        result = subprocess.run(
            [HERMES_CLI, "profile", "list"],
            capture_output=True,
            text=True,
            timeout=15,
            env=hermes_command_env(),
        )
        if result.returncode == 0:
            cli_profiles = _parse_profile_list(result.stdout or "")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return sorted(set(cli_profiles) | set(_profile_names_on_disk()))


def _profile_names_on_disk() -> list[str]:
    profiles_dir = HERMES_HOME / "profiles"
    try:
        children = list(profiles_dir.iterdir())
    except OSError:
        return []
    return sorted(
        child.name
        for child in children
        if child.is_dir() and PROFILE_NAME_RE.fullmatch(child.name)
    )


def _parse_profile_list(output: str) -> list[str]:
    names: list[str] = []
    for line in output.splitlines():
        stripped = line.strip().lstrip("◆").strip()
        if not stripped:
            continue
        first = stripped.split()[0]
        if first.lower() == "profile" or set(first) <= {"─", "-"}:
            continue
        if PROFILE_NAME_RE.match(first):
            names.append(first)
    return names


def delete_hermes_profile(profile_name: str) -> None:
    """Compatibility no-op: dismissing a team member must retain Hermes data."""
    return None


def attach_mcp_server(profile_name: str, *, name: str, url: str) -> None:
    """Inject an HTTP MCP server entry into a profile's config.yaml.

    Hermes reads `mcp_servers.<name> = {url, enabled}` from the profile config
    (see hermes_cli/mcp_config.py). We merge in place so the rest of the file
    (model, providers, …) is preserved.
    """
    upsert_mcp_server(profile_name, name, {"url": url, "enabled": True})


def read_profile_config(profile_name: str) -> dict:
    cfg_path = _profile_config_path(profile_name)
    if not cfg_path.exists():
        raise ProfileError(f"profile config not found: {cfg_path}")
    data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    return data if isinstance(data, dict) else {}


def write_profile_config(profile_name: str, data: dict) -> None:
    cfg_path = _profile_config_path(profile_name)
    with _profile_lock(profile_name):
        if not cfg_path.exists():
            raise ProfileError(f"profile config not found: {cfg_path}")
        tmp_path = cfg_path.with_name(
            f".{cfg_path.name}.{os.getpid()}.{threading.get_ident()}.tmp"
        )
        content = yaml.safe_dump(data, allow_unicode=True, sort_keys=False)
        try:
            with tmp_path.open("w", encoding="utf-8") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            for attempt in range(6):
                try:
                    os.replace(tmp_path, cfg_path)
                    _invalidate_model_summary_cache(profile_name)
                    break
                except PermissionError:
                    if attempt == 5:
                        raise
                    time.sleep(0.05 * (attempt + 1))
        except OSError as exc:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
            raise ProfileError(f"profile config write failed: {exc}") from exc


def read_model_summary(profile_name: str) -> dict:
    cfg_path = _profile_config_path(profile_name)
    cache_key = os.path.normcase(os.path.abspath(cfg_path))
    now = time.monotonic()
    with _MODEL_SUMMARY_CACHE_LOCK:
        cached = _MODEL_SUMMARY_CACHE.get(cache_key)
        if cached and cached[0] > now:
            return dict(cached[3])

    stat = cfg_path.stat()
    with _MODEL_SUMMARY_CACHE_LOCK:
        cached = _MODEL_SUMMARY_CACHE.get(cache_key)
        if cached and cached[1:3] == (stat.st_mtime_ns, stat.st_size):
            _MODEL_SUMMARY_CACHE[cache_key] = (
                now + _MODEL_SUMMARY_CACHE_TTL_SECONDS,
                cached[1],
                cached[2],
                cached[3],
            )
            return dict(cached[3])

    # Serialize a cache-miss read with config writes. Otherwise a replace
    # between reading YAML and statting the file could cache old data under
    # the new file signature.
    with _profile_lock(profile_name):
        data = read_profile_config(profile_name)
        model = data.get("model")
        if not isinstance(model, dict):
            model = {}
        summary = {
            "default": str(model.get("default") or ""),
            "provider": str(model.get("provider") or ""),
            "base_url": str(model.get("base_url") or ""),
        }
        stat = cfg_path.stat()
    with _MODEL_SUMMARY_CACHE_LOCK:
        _MODEL_SUMMARY_CACHE[cache_key] = (
            now + _MODEL_SUMMARY_CACHE_TTL_SECONDS,
            stat.st_mtime_ns,
            stat.st_size,
            summary,
        )
    return dict(summary)


def _invalidate_model_summary_cache(profile_name: str) -> None:
    cache_key = os.path.normcase(os.path.abspath(_profile_config_path(profile_name)))
    with _MODEL_SUMMARY_CACHE_LOCK:
        _MODEL_SUMMARY_CACHE.pop(cache_key, None)


def apply_model_config(profile_name: str, model_config: dict) -> dict:
    with _profile_lock(profile_name):
        data = read_profile_config(profile_name)
        data["model"] = {
            "default": model_config["model"],
            "provider": "custom",
            "base_url": model_config["base_url"],
            "api_key": model_config["api_key"],
        }
        write_profile_config(profile_name, data)
        return read_model_summary(profile_name)


def upsert_mcp_server(profile_name: str, name: str, spec: dict) -> None:
    with _profile_lock(profile_name):
        data = read_profile_config(profile_name)
        servers = data.setdefault("mcp_servers", {})
        if not isinstance(servers, dict):
            servers = {}
            data["mcp_servers"] = servers
        next_spec = dict(spec)
        next_spec["enabled"] = True
        servers[name] = next_spec
        write_profile_config(profile_name, data)


def remove_mcp_server(profile_name: str, name: str) -> None:
    with _profile_lock(profile_name):
        data = read_profile_config(profile_name)
        servers = data.get("mcp_servers")
        if isinstance(servers, dict):
            servers.pop(name, None)
        write_profile_config(profile_name, data)


# Hermes built-in toolsets that conflict with our agent_bus-based team
# delegation. When enabled on a leader profile they cause the LLM to route
# "让 X 做 Y" 类指令到内部的子 agent（delegation）或者 iMessage/SMS 工具
# （messaging），从而绕过 agent_bus.delegate_task，使 worker 不会真正收到消息。
LEADER_CONFLICTING_TOOLSETS = ("delegation", "messaging")


def disable_conflicting_toolsets(profile_name: str) -> None:
    """Disable built-in toolsets on a profile that conflict with agent_bus."""
    for toolset in LEADER_CONFLICTING_TOOLSETS:
        try:
            subprocess.run(
                [HERMES_CLI, "-p", profile_name, "tools", "disable", toolset],
                capture_output=True,
                text=True,
                timeout=15,
                env=hermes_command_env(),
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            # Best-effort: SOUL.md guidance still steers the LLM.
            pass
