from __future__ import annotations

from sqlalchemy.exc import SQLAlchemyError

from ..config import KANBAN_AUTO_DISPATCH
from ..db import SQLitePersistence

KANBAN_AUTO_DISPATCH_KEY = "kanban_auto_dispatch_enabled"
KANBAN_MULTI_REVIEW_KEY = "kanban_multi_review_enabled"
KANBAN_BLOCK_HUMAN_INPUT_KEY = "kanban_block_human_input_enabled"
KANBAN_IDEMPOTENT_PROTECTION_KEY = "kanban_idempotent_protection_enabled"


def _bool_to_setting(value: bool) -> str:
    return "1" if value else "0"


def _setting_to_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    return value == "1"


class SettingsService:
    def __init__(self, persistence: SQLitePersistence | None = None) -> None:
        self.persistence = persistence or SQLitePersistence()

    def _get_bool(self, key: str, *, default: bool) -> bool:
        try:
            value = self.persistence.get_setting(key)
        except SQLAlchemyError:
            # Modules can be used by workers or tests before the Flask app has
            # initialized the database. Environment defaults remain usable.
            value = None
        return _setting_to_bool(value, default=default)

    def get_kanban_auto_dispatch_enabled(self) -> bool:
        return self._get_bool(
            KANBAN_AUTO_DISPATCH_KEY,
            default=KANBAN_AUTO_DISPATCH,
        )

    def set_kanban_auto_dispatch_enabled(self, enabled: bool) -> bool:
        self.persistence.set_setting(KANBAN_AUTO_DISPATCH_KEY, _bool_to_setting(enabled))
        return enabled

    def get_kanban_multi_review_enabled(self) -> bool:
        return self._get_bool(
            KANBAN_MULTI_REVIEW_KEY,
            default=True,
        )

    def set_kanban_multi_review_enabled(self, enabled: bool) -> bool:
        self.persistence.set_setting(KANBAN_MULTI_REVIEW_KEY, _bool_to_setting(enabled))
        return enabled

    def get_kanban_block_human_input_enabled(self) -> bool:
        return self._get_bool(
            KANBAN_BLOCK_HUMAN_INPUT_KEY,
            default=True,
        )

    def set_kanban_block_human_input_enabled(self, enabled: bool) -> bool:
        self.persistence.set_setting(KANBAN_BLOCK_HUMAN_INPUT_KEY, _bool_to_setting(enabled))
        return enabled

    def get_kanban_idempotent_protection_enabled(self) -> bool:
        return self._get_bool(
            KANBAN_IDEMPOTENT_PROTECTION_KEY,
            default=True,
        )

    def set_kanban_idempotent_protection_enabled(self, enabled: bool) -> bool:
        self.persistence.set_setting(KANBAN_IDEMPOTENT_PROTECTION_KEY, _bool_to_setting(enabled))
        return enabled

    def kanban_settings_snapshot(self) -> dict:
        return {
            "auto_dispatch_enabled": self.get_kanban_auto_dispatch_enabled(),
            "auto_dispatch_interval_ms": 2000,
            "multi_review_enabled": self.get_kanban_multi_review_enabled(),
            "block_human_input_enabled": self.get_kanban_block_human_input_enabled(),
            "idempotent_protection_enabled": self.get_kanban_idempotent_protection_enabled(),
        }


settings_service = SettingsService()
