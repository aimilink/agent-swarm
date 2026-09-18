import logging
import threading

import pyte

from app.services.acp import (
    STUCK_HINT_SECONDS,
    _extract_selection,
    _is_non_interaction_text,
    _looks_ready_for_next_input,
    _log_terminal_debug,
    _should_show_stuck_hint,
    _terminal_preview,
)
from app.services.acp.helpers import _AnsiStreamSanitizer
from app.services.acp.session import HermesSession


def test_ready_prompt_without_symbol_is_detected():
    assert _looks_ready_for_next_input("leader ❯")


def test_ready_prompt_with_symbol_is_detected():
    assert _looks_ready_for_next_input("dev Ψ ❯")


def test_stuck_hint_waits_for_threshold():
    assert not _should_show_stuck_hint(
        active=True,
        pending_interaction=False,
        started_at=100.0,
        last_output_at=200.0,
        hint_sent=False,
        now=200.0 + STUCK_HINT_SECONDS - 1,
    )


def test_stuck_hint_does_not_repeat():
    assert not _should_show_stuck_hint(
        active=True,
        pending_interaction=False,
        started_at=100.0,
        last_output_at=200.0,
        hint_sent=True,
        now=200.0 + STUCK_HINT_SECONDS,
    )


def test_stuck_hint_after_threshold():
    assert _should_show_stuck_hint(
        active=True,
        pending_interaction=False,
        started_at=100.0,
        last_output_at=200.0,
        hint_sent=False,
        now=200.0 + STUCK_HINT_SECONDS,
    )


def test_selection_parser_uses_latest_input_prompt():
    text = """
╭─ Hermes needs your input ─╮
│ ❯ 1. 开发（agent_dev）      │
│   2. 开发者（agent_dev1）  │
╰───────────────────────────╯

⚡ mcp_agent_bus_create_kanban_worker_tasks  (0.0s)

╭─ Hermes needs your input ─╮
│   1. 开发（agent_dev）      │
│ ❯ 2. 开发者（agent_dev1）  │
╰───────────────────────────╯
"""

    selection = _extract_selection(text)

    assert selection == {
        "choices": ["1. 开发（agent_dev）", "2. 开发者（agent_dev1）"],
        "selected_index": 1,
    }


def test_selection_parser_ignores_stale_choice_fragments_without_prompt():
    text = """
  3. Other (type your answer)
  1. 开发（agent_dev）
❯ 2. 开发者（agent_dev1）
⚡ mcp_agent_bus_create_kanban_worker_tasks  (0.0s)
leader ❯
"""

    assert _extract_selection(text) is None


def test_welcome_tip_is_not_treated_as_interaction():
    text = """
Welcome to Hermes Agent! Type your message or /help for commands.
✦ Tip: Long dangerous commands (>70 chars) get a 'view' option in the approval prompt to see the full text first.
"""

    assert _is_non_interaction_text(text)

def test_terminal_preview_keeps_printable_unicode_and_escapes_controls():
    preview = _terminal_preview("\x1b[38;5;173m│⠀⠀⣿ 中文\x1b[0m\n")

    assert "│⠀⠀⣿ 中文" in preview
    assert "\\u2800" not in preview
    assert "\\u2502" not in preview
    assert "\\x1b" in preview
    assert preview.endswith("\\n")


def test_terminal_debug_log_keeps_braille_unicode(caplog):
    caplog.set_level(logging.DEBUG, logger="hermes.agent_state")
    _log_terminal_debug("chunk_sample", "agent_demo", "\x1b[0m⠀⣿\n")

    message = caplog.records[-1].getMessage()
    assert "⠀⣿" in message
    assert "\\u2800" not in message


def test_ansi_stream_sanitizer_handles_sequences_split_between_chunks():
    sanitizer = _AnsiStreamSanitizer()

    assert sanitizer.feed("\x1b[38;5") == ""
    assert sanitizer.feed(";173m│⠀⠀⣿") == "│⠀⠀⣿"
    assert sanitizer.feed("\x1b]0;Hermes") == ""
    assert sanitizer.feed("\x07ready") == "ready"


def test_terminal_chunk_samples_use_debug_log_level(caplog):
    caplog.set_level(logging.DEBUG, logger="hermes.agent_state")

    _log_terminal_debug("chunk_sample", "agent_demo", "banner")
    _log_terminal_debug("chunk_suspicious", "agent_demo", "\x00")

    records = [record for record in caplog.records if "[terminal-debug]" in record.getMessage()]
    assert records[-2].levelno == logging.DEBUG
    assert records[-1].levelno == logging.WARNING


def test_terminal_reconnect_snapshot_is_rendered_from_parsed_screen():
    session = object.__new__(HermesSession)
    session._lock = threading.Lock()
    session._terminal_screen = pyte.Screen(40, 4)
    stream = pyte.Stream(session._terminal_screen)
    stream.feed("\x1b[38;5")
    stream.feed(";173mHermes\x1b[0m")
    session._terminal_rows = 4
    session._terminal_columns = 40
    session._last_terminal_snapshot = "Hermes"
    session._terminal_subscribers = set()
    session._closed = False
    session.proc = type("AliveProcess", (), {"isalive": lambda self: True})()

    subscriber, state = session.open_terminal_stream()
    session.close_terminal_stream(subscriber)

    assert state["snapshot_ansi"].startswith("\x1b[0m\x1b[2J\x1b[H")
    assert "Hermes" in state["snapshot_ansi"]
    assert not state["snapshot_ansi"].startswith(";5;173m")
