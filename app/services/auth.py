from __future__ import annotations

import os

from werkzeug.security import check_password_hash, generate_password_hash

from ..db import SQLitePersistence

AUTH_PASSWORD_HASH_KEY = "auth.password_hash"
AUTH_PASSWORD_CHANGED_KEY = "auth.password_changed"
MIN_PASSWORD_LENGTH = 8


class AuthService:
    def __init__(self, persistence: SQLitePersistence | None = None) -> None:
        self.persistence = persistence or SQLitePersistence()
        self.default_username = (os.environ.get("AGENT_TEAM_DEFAULT_USERNAME") or "admin").strip() or "admin"
        self.default_password = os.environ.get("AGENT_TEAM_DEFAULT_PASSWORD") or "agentswarm"

    def ensure_initialized(self) -> None:
        if self.persistence.get_setting(AUTH_PASSWORD_HASH_KEY):
            return
        self.persistence.set_setting(AUTH_PASSWORD_HASH_KEY, generate_password_hash(self.default_password))
        self.persistence.set_setting(AUTH_PASSWORD_CHANGED_KEY, "0")

    def password_changed(self) -> bool:
        self.ensure_initialized()
        return self.persistence.get_setting(AUTH_PASSWORD_CHANGED_KEY) == "1"

    def verify(self, username: str, password: str) -> bool:
        self.ensure_initialized()
        if username.strip() != self.default_username:
            return False
        stored = self.persistence.get_setting(AUTH_PASSWORD_HASH_KEY) or ""
        return bool(stored) and check_password_hash(stored, password)

    def change_password(self, current_password: str, new_password: str, confirmation: str) -> None:
        if not self.verify(self.default_username, current_password):
            raise ValueError("当前密码不正确")
        if len(new_password) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"新密码至少需要 {MIN_PASSWORD_LENGTH} 个字符")
        if new_password != confirmation:
            raise ValueError("两次输入的新密码不一致")
        if new_password == self.default_password:
            raise ValueError("新密码不能继续使用默认密码")
        if new_password == current_password:
            raise ValueError("新密码不能与当前密码相同")
        self.persistence.set_setting(AUTH_PASSWORD_HASH_KEY, generate_password_hash(new_password))
        self.persistence.set_setting(AUTH_PASSWORD_CHANGED_KEY, "1")
