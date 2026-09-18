"""Feishu notifier for user-task lifecycle events.

Two delivery modes (auto-detected):
1. Webhook bot:  set AGENTSWARM_FEISHU_WEBHOOK (custom-bot hook URL).
2. App API:      set FEISHU_APP_ID + FEISHU_APP_SECRET (+ optional
   AGENTSWARM_FEISHU_CHAT_ID / AGENTSWARM_FEISHU_OPEN_ID). Sends via
   open.feishu.cn im/v1/messages using a tenant_access_token.

Event selection via AGENTSWARM_FEISHU_NOTIFY_EVENTS (comma separated),
default: user_task.completed, user_task.blocked, agent.interaction.required.

Fire-and-forget: notifier failures never affect the task pipeline.
"""
from __future__ import annotations

import json
import os
import subprocess
import threading
import time
import urllib.request

_log_lock = threading.Lock()


def _log(msg: str) -> None:
    line = f"[feishu-notifier {time.strftime('%m-%d %H:%M:%S')}] {msg}"
    with _log_lock:
        print(line, flush=True)


def _env(k: str, d: str = "") -> str:
    return (os.environ.get(k) or d).strip()


def _load_event_types() -> set[str]:
    raw = _env("AGENTSWARM_FEISHU_NOTIFY_EVENTS")
    if raw:
        return {x.strip() for x in raw.split(",") if x.strip()}
    return {"user_task.completed", "user_task.blocked", "agent.interaction.required"}


EVENT_TITLES = {
    "user_task.completed": "✅ 任务完成",
    "user_task.blocked": "⛔ 任务阻塞，需要处理",
    "agent.interaction.required": "🙋 智能体等待人工输入",
}
MENTION_ALL = {"user_task.blocked", "agent.interaction.required"}


def format_event(event: dict) -> str | None:
    """Render a store event into message text, or None to skip."""
    et = event.get("event_type", "")
    if et not in EVENT_TITLES:
        return None
    data = event.get("data") or {}
    lines = [f"{EVENT_TITLES[et]}"]
    if data.get("text"):
        lines.append(str(data["text"]))
    ut_id = data.get("user_task_id") or event.get("task_id") or ""
    if ut_id:
        lines.append(f"任务: {ut_id}")
    if event.get("agent_id"):
        lines.append(f"负责人: {event['agent_id']}")
    result = str(data.get("result") or data.get("summary") or "").strip()
    if result:
        lines.append("摘要: " + (result[:500] + ("…" if len(result) > 500 else "")))
    return "\n".join(x for x in lines if x)


class FeishuNotifier:
    def __init__(self, store) -> None:
        self.store = store
        self.webhook = _env("AGENTSWARM_FEISHU_WEBHOOK")
        self.app_id = _env("FEISHU_APP_ID")
        self.app_secret = _env("FEISHU_APP_SECRET")
        self.chat_id = _env("AGENTSWARM_FEISHU_CHAT_ID")
        self.open_id = _env("AGENTSWARM_FEISHU_OPEN_ID")
        self.event_types = _load_event_types()
        self.mode = "webhook" if self.webhook else ("app" if self.app_id and self.app_secret and (self.chat_id or self.open_id) else "off")
        self.enabled = self.mode != "off"
        self._token_cache: tuple[str, float] = ("", 0.0)
        if not self.enabled:
            _log("disabled (no AGENTSWARM_FEISHU_WEBHOOK and no FEISHU_APP_ID/SECRET+chat target)")
            return
        _log(f"mode={self.mode} events={sorted(self.event_types)}")
        threading.Thread(target=self._run, name="feishu-notifier", daemon=True).start()

    # ---- delivery backends -------------------------------------------------
    def _app_token(self) -> str:
        tok, ts = self._token_cache
        if tok and time.time() - ts < 90:
            return tok
        body = json.dumps({"app_id": self.app_id, "app_secret": self.app_secret}).encode()
        req = urllib.request.Request(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        tok = data.get("tenant_access_token") or ""
        self._token_cache = (tok, time.time())
        return tok

    def _send_webhook(self, text: str, mention_all: bool) -> bool:
        if mention_all:
            body = f'<at user_id="all">所有人</at> {text}'
        else:
            body = text
        payload = {"msg_type": "text", "content": {"text": body}}
        req = urllib.request.Request(self.webhook, data=json.dumps(payload, ensure_ascii=False).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return 200 <= resp.status < 300
        except Exception as exc:
            _log(f"webhook failed: {type(exc).__name__}: {exc}")
            return False

    def _send_app(self, text: str, mention_all: bool) -> bool:
        payload: dict = {"msg_type": "text", "content": {"text": text}}
        if self.chat_id:
            payload["receive_id"] = self.chat_id
            url = "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id"
        else:
            payload["receive_id"] = self.open_id
            url = "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id"
        if mention_all:
            payload["content"]["text"] = '<at user_id="all">所有人</at>\n' + text
        try:
            req = urllib.request.Request(
                url, data=json.dumps(payload, ensure_ascii=False).encode(),
                headers={"Content-Type": "application/json",
                         "Authorization": f"Bearer {self._app_token()}"}, method="POST")
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                if data.get("code") == 0:
                    return True
                _log(f"app send api error: {data.get('code')} {data.get('msg')}")
        except Exception as exc:
            _log(f"app send urllib failed ({type(exc).__name__}), trying curl fallback")
        try:
            body = json.dumps(payload, ensure_ascii=False)
            r = subprocess.run(["curl", "-s", "--noproxy", "*", "-m", "10", "-X", "POST", url,
                                "-H", f"Authorization: Bearer {self._app_token()}",
                                "-H", "Content-Type: application/json", "-d", body],
                               capture_output=True, text=True, timeout=15)
            ok = '"code":0' in (r.stdout or "")
            if not ok:
                _log(f"app send curl fallback failed: {(r.stdout or '')[:120]}")
            return ok
        except Exception as exc2:
            _log(f"app send failed: {exc2}")
            return False

    # ---- event loop --------------------------------------------------------
    def _deliver(self, text: str, mention_all: bool) -> bool:
        if self.mode == "webhook":
            return self._send_webhook(text, mention_all)
        return self._send_app(text, mention_all)

    def _run(self) -> None:
        try:
            q = self.store.subscribe()
        except Exception as exc:
            _log(f"subscribe failed: {exc}")
            return
        while True:
            try:
                raw = q.get()
                for line in (raw or "").splitlines():
                    if not line.startswith("data: "):
                        continue
                    try:
                        event = json.loads(line[len("data: "):])
                    except json.JSONDecodeError:
                        continue
                    if event.get("event_type") not in self.event_types:
                        continue
                    text = format_event(event)
                    if not text:
                        continue
                    ok = self._deliver(text, event["event_type"] in MENTION_ALL)
                    _log(f"{event.get('event_type')} -> {'sent' if ok else 'FAILED'}")
            except Exception as exc:
                _log(f"loop error: {type(exc).__name__}: {exc}")
