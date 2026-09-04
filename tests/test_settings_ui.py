from __future__ import annotations

import importlib.util
import re
from html.parser import HTMLParser
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "app/templates/index.html"
UI_APP = ROOT / "app/static/ui-app.js"
APP_JS = ROOT / "app/static/app.js"
BUILD_SCRIPT = ROOT / "scripts/build_ui_template.py"

VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


class _Node:
    def __init__(self, tag: str, attrs: list[tuple[str, str | None]]):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children: list[_Node] = []
        self.text = ""
        self.id = self.attrs.get("id")
        self.classes = (self.attrs.get("class") or "").split()

    def all_text(self) -> str:
        return self.text + "".join(child.all_text() for child in self.children)

    def find_id(self, value: str) -> _Node | None:
        if self.id == value:
            return self
        for child in self.children:
            found = child.find_id(value)
            if found is not None:
                return found
        return None


class _TreeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.root = _Node("root", [])
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = _Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        self.stack[-1].text += data


def _parse_settings(html: str) -> _Node:
    match = re.search(r'<section id="view-settings".*?</section>', html, re.DOTALL)
    assert match, "#view-settings section is missing"
    parser = _TreeParser()
    parser.feed(match.group(0))
    section = parser.root.find_id("view-settings")
    assert section is not None
    return section


def _assert_settings_layout(html: str) -> None:
    section = _parse_settings(html)
    orphans = [child for child in section.children if "bg-surface" in child.classes]
    assert orphans == [], "#view-settings must not have orphan .bg-surface cards"
    scroll = [
        child
        for child in section.children
        if "flex-1" in child.classes and "overflow-y-auto" in child.classes
    ]
    assert len(scroll) == 1, "#view-settings must have exactly one scroll container"
    cards = [child for child in scroll[0].children if "bg-surface" in child.classes]
    titles = [re.sub(r"\s+", "", card.all_text()) for card in cards]
    assert len(cards) == 4, f"expected 4 settings cards in scroll container, got {len(cards)}: {titles}"
    assert "协作编排" in titles[0]
    assert "模型配置" in titles[1]
    assert "团队导入/导出" in titles[2]
    assert "危险区" in titles[3]
    assert section.find_id("settings-model-list") is not None
    assert section.find_id("settings-auto-dispatch") is not None
    assert section.find_id("settings-export-team") is not None
    assert section.find_id("settings-import-team") is not None
    clear_button = section.find_id("settings-clear-done-tasks")
    assert clear_button is not None
    assert clear_button.attrs.get("data-kanban-clear-column") == "done"
    assert section.find_id("settings-done-count") is not None
    model_list = section.find_id("settings-model-list")
    assert model_list is not None
    assert model_list in cards[1].children


def test_settings_template_keeps_all_cards_in_scroll_container():
    _assert_settings_layout(TEMPLATE.read_text(encoding="utf-8"))


def test_settings_js_reads_items_and_wires_actions():
    ui = UI_APP.read_text(encoding="utf-8")
    app = APP_JS.read_text(encoding="utf-8")

    assert "data.items" in ui
    assert "暂无模型配置" in ui
    assert "settings-clear-done-tasks" in ui
    assert "clearDoneKanbanTasks" in ui
    assert "toggleKanbanAutoDispatch" in ui
    assert "settings-done-count" in ui
    assert "translate-x-5" in ui

    assert "async function clearDoneKanbanTasks" in app
    assert "/api/kanban/tasks/done" in app
    assert "clearDoneKanbanTasks," in app
    assert "toggleKanbanAutoDispatch," in app


def test_build_script_does_not_consume_model_card_closer():
    source = BUILD_SCRIPT.read_text(encoding="utf-8")
    assert ".*?</button>\\s*</div>" in source
    assert "settings-clear-done-tasks" in source
    assert "settings-done-count" in source
    assert r"</div>\s*</div>\s*<div class=\"bg-surface" not in source


def test_build_ui_template_keeps_settings_cards_in_scroll(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("build_ui_template", BUILD_SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not Path(module.MOCKUP).exists():
        pytest.skip("static mock /www/agent-team-ui/index.html is not available")
    out = tmp_path / "index.html"
    monkeypatch.setattr(module, "OUT", out)
    module.main()
    _assert_settings_layout(out.read_text(encoding="utf-8"))
