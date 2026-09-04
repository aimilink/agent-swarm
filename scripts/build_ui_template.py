#!/usr/bin/env python3
"""Build Jinja2 index.html from agent-team-ui mockup."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOCKUP = Path("/www/agent-team-ui/index.html")
MODALS = ROOT / "app/templates/index.html.bak"
OUT = ROOT / "app/templates/index.html"


def main() -> None:
    html = MOCKUP.read_text(encoding="utf-8")

    # Asset paths
    html = html.replace('src="/tailwind.js"', 'src="{{ url_for(\'static\', filename=\'ui/tailwind.js\') }}"')
    html = html.replace(
        'href="/fonts/material-symbols.css"',
        'href="{{ url_for(\'static\', filename=\'ui/fonts/material-symbols.css\') }}"',
    )
    html = html.replace(
        'src="/img/img_0.png"',
        'src="{{ url_for(\'static\', filename=\'ui/img/img_0.png\') }}"',
    )

    # Remove duplicate script blocks at end
    html = re.sub(r"<script>\s*const VIEWS = \['overview'.*?</script>\s*", "", html, flags=re.DOTALL)
    html = re.sub(r"<script>\s*const VIEWS = \['overview'.*?</script>\s*$", "", html, flags=re.DOTALL)

    # Header buttons
    html = html.replace(
        '<button class="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-md hover:opacity-90 transition-opacity">\n                + New Staff\n            </button>',
        '<button id="open-create-agent" type="button" class="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-md hover:opacity-90 transition-opacity">+ 新员工</button>',
    )
    html = re.sub(
        r'(<div class="flex gap-2 text-primary">\s*)<button class="p-2[^"]*"[^>]*>.*?</button>\s*<button class="p-2[^"]*"[^>]*>',
        r'\1<button id="sidebar-toggle" type="button" class="md:hidden p-2 hover:bg-surface-container-high/50 rounded-full transition-colors"><span class="material-symbols-outlined msr" aria-hidden="true">menu</span></button>\n<button id="open-teams-page" type="button" class="p-2 hover:bg-surface-container-high/50 rounded-full transition-colors active:scale-95 transition-transform" aria-label="团队管理" title="团队管理"><span class="material-symbols-outlined msr" aria-hidden="true">groups</span></button>\n<button id="open-team-settings" type="button" class="p-2 hover:bg-surface-container-high/50 rounded-full transition-colors active:scale-95 transition-transform" aria-label="团队配置" title="团队配置"><span class="material-symbols-outlined msr" aria-hidden="true">settings</span></button>',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Nav id
    html = html.replace(
        '<nav class="bg-surface/70 backdrop-blur-xl fixed left-0 top-0 h-full w-[260px]',
        '<nav id="app-sidebar" class="bg-surface/70 backdrop-blur-xl fixed left-0 top-0 h-full w-[260px]',
    )

    html = re.sub(
        r'(<section id="view-overview".*?<button )(class="bg-primary text-on-primary px-4 py-2 rounded-xl[^"]*")',
        r'\1id="btn-create-task-overview" type="button" \2',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Overview stats grid
    html = re.sub(
        r'(<section id="view-overview".*?<div class="grid grid-cols-4 gap-md">).*?(</div>\s*</div>\s*<div class="flex-1 overflow-y-auto p-md grid grid-cols-5)',
        r'\1\n<div id="overview-stats-grid" class="contents"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Team health + activity (keep activity feed inside col-span-3 — only one </div> before 最新动态 card)
    html = re.sub(
        r'(<div class="p-4 grid grid-cols-3 gap-3">).*?(</div>\s*<div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">\s*<div class="p-4 border-b border-outline-variant/30 flex justify-between items-center">\s*<h3 class="font-title-lg text-title-lg text-on-surface">最新动态</h3>)',
        r'<div id="overview-team-health" class="p-4 grid grid-cols-3 gap-3"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )
    # Remove overflow-hidden from team health card so content is not clipped
    html = html.replace(
        '<div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">\n'
        '<div class="p-4 border-b border-outline-variant/30 flex justify-between items-center">\n'
        '<h3 class="font-title-lg text-title-lg text-on-surface">团队健康度</h3>',
        '<div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm">\n'
        '<div class="p-4 border-b border-outline-variant/30 flex justify-between items-center">\n'
        '<h3 class="font-title-lg text-title-lg text-on-surface">团队健康度</h3>',
        1,
    )
    html = html.replace(
        'class="flex-1 overflow-y-auto p-md grid grid-cols-5 gap-md"',
        'class="flex-1 min-h-0 overflow-y-auto p-md grid grid-cols-5 gap-md"',
        1,
    )
    html = re.sub(
        r'(<h3 class="font-title-lg text-title-lg text-on-surface">最新动态</h3>.*?<div class="px-4 divide-y divide-outline-variant/10">).*?(</div>\s*</div>\s*</div>\s*<div class="col-span-2)',
        r'\1\n<div id="overview-activity-feed" class="px-4 divide-y divide-outline-variant/10"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Task status sidebar in overview
    html = re.sub(
        r'(<h3 class="font-title-lg text-title-lg text-on-surface">今日任务状态</h3>\s*</div>\s*<div class="p-4 flex flex-col gap-3">).*?(</div>\s*</div>\s*<div class="bg-gradient-to-br)',
        r'\1\n<div id="overview-task-status" class="p-4 flex flex-col gap-3"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Board view
    html = html.replace(
        '<select class="bg-surface border border-outline-variant/50 rounded-lg px-3 py-2 text-on-surface font-label-md outline-none focus:border-primary"><option>全部团队</option>',
        '<select id="board-team-select" class="bg-surface border border-outline-variant/50 rounded-lg px-3 py-2 text-on-surface font-label-md outline-none focus:border-primary"><option value="">全部团队</option>',
        1,
    )
    html = html.replace(
        '<button class="bg-primary text-on-primary px-4 py-2 rounded-xl font-label-md shadow-sm hover:bg-primary/90">+ 新建任务</button>',
        '<button id="btn-create-task-board" type="button" class="bg-primary text-on-primary px-4 py-2 rounded-xl font-label-md shadow-sm hover:bg-primary/90">+ 新建任务</button>',
        1,
    )
    html = re.sub(
        r'(<section id="view-board".*?<div class="flex-1 overflow-x-auto flex gap-4 pb-2">).*?(</div>\s*</div>\s*</section>)',
        r'\1\n<div id="board-kanban-columns" class="contents flex gap-4"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Members view
    html = re.sub(
        r'(<section id="view-members".*?<p class="font-label-md text-on-surface-variant mt-1">).*?(</p>)',
        r'\1<span id="members-subtitle">加载中…</span>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )
    html = re.sub(
        r'(<section id="view-members".*?<button )(class="bg-primary text-on-primary px-4 py-2 rounded-xl[^"]*")',
        r'\1id="btn-create-agent-members" type="button" \2',
        html,
        count=1,
        flags=re.DOTALL,
    )
    html = re.sub(
        r'(<div class="flex gap-1 bg-surface-container rounded-xl p-1">).*?(</div>\s*<div class="flex-1"></div>)',
        r'<div id="members-filter-bar" class="flex gap-1 bg-surface-container rounded-xl p-1"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )
    html = re.sub(
        r'(<section id="view-members".*?<div class="flex-1 overflow-y-auto p-md">\s*<div class="grid grid-cols-2 xl:grid-cols-3 gap-3">).*?(</div>\s*</div>\s*</section>)',
        r'\1\n<div id="members-grid" class="contents"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Stats view
    html = re.sub(
        r'(<section id="view-stats".*?<p class="font-label-md text-on-surface-variant mt-1">).*?(</p>)',
        r'\1<span id="stats-subtitle">加载中…</span>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )
    html = re.sub(
        r'(<section id="view-stats".*?<div class="flex-1 overflow-y-auto p-md grid grid-cols-2 gap-md">).*?(</div>\s*</section>)',
        r'\1\n<div id="stats-content" class="contents col-span-2 grid grid-cols-2 gap-md"></div>\2',
        html,
        count=1,
        flags=re.DOTALL,
    )

    # Settings view - replace model list demo rows with empty mount point.
    # Consume only the inner demo <div>…</div> (ends at the dashed add-model button).
    # Do NOT also consume the model-config card closer, or later cards fall out of the scroll wrapper.
    html = re.sub(
        r'(<section id="view-settings".*?<h3 class="font-title-lg text-title-lg text-on-surface">模型配置</h3></div>\s*)'
        r'<div class="p-4 flex flex-col gap-3">.*?</button>\s*</div>',
        r'\1<div id="settings-model-list" class="p-4 flex flex-col gap-3"></div>',
        html,
        count=1,
        flags=re.DOTALL,
    )
    # First toggle in settings -> auto dispatch (linked to kanban dock toggle in ui-app.js)
    html = re.sub(
        r'(<section id="view-settings".*?<div class="font-label-md text-on-surface font-bold mb-0\.5">自动派发</div>.*?<input )(checked="" )?(class="toggle-checkbox)',
        r'\1id="settings-auto-dispatch" \2\3',
        html,
        count=1,
        flags=re.DOTALL,
    )
    # Import/export card (not in static mockup)
    html = html.replace(
        '<div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">\n'
        '<div class="p-4 border-b border-outline-variant/30"><h3 class="font-title-lg text-title-lg text-on-surface">危险区</h3>',
        '<div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden mb-4">\n'
        '<div class="p-4 border-b border-outline-variant/30"><h3 class="font-title-lg text-title-lg text-on-surface">团队导入/导出</h3></div>\n'
        '<div class="p-4 flex flex-wrap gap-3">\n'
        '<button type="button" id="settings-export-team" class="px-4 py-2 rounded-xl bg-primary-container/20 text-primary font-label-md hover:bg-primary-container/30 transition-colors">导出团队</button>\n'
        '<button type="button" id="settings-import-team" class="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high transition-colors">导入团队</button>\n'
        '</div>\n'
        '</div>\n'
        '<div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">\n'
        '<div class="p-4 border-b border-outline-variant/30"><h3 class="font-title-lg text-title-lg text-on-surface">危险区</h3>',
        1,
    )
    html = html.replace(
        '<div class="text-[13px] text-on-surface-variant">清空已完成 39 项任务与 deliverables 目录</div>',
        '<div id="settings-done-count" class="text-[13px] text-on-surface-variant">清空已完成任务与 deliverables 目录</div>',
        1,
    )
    html = html.replace(
        '<button class="px-4 py-2 rounded-xl bg-error-container/30 text-error font-label-md hover:bg-error-container/50">清空数据</button>',
        '<button type="button" id="settings-clear-done-tasks" data-kanban-clear-column="done" data-kanban-column-title="已完成" class="px-4 py-2 rounded-xl bg-error-container/30 text-error font-label-md hover:bg-error-container/50">清空数据</button>',
        1,
    )

    # Task dock
    html = html.replace(
        '<div id="task-dock" class="view-dock bg-surface border-t',
        '<form id="kanban-task-form" data-ui-dock="task-dock" class="view-dock bg-surface border-t',
        1,
    )
    html = html.replace(
        '<input class="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant/50 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-body-md" placeholder="发消息或输入任务，例如：让销售团队跟进客户A的报价需求…" type="text"/>',
        '<input id="kanban-task-input" class="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant/50 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none font-body-md" placeholder="发消息或输入任务，例如：让销售团队跟进客户A的报价需求…" type="text" rows="1"/>',
        1,
    )
    html = html.replace(
        '<select class="bg-surface border border-outline-variant/50 rounded-lg px-3 py-2 text-on-surface font-label-md outline-none focus:border-primary"><option>全部团队</option>',
        '<select id="kanban-team-select" class="bg-surface border border-outline-variant/50 rounded-lg px-3 py-2 text-on-surface font-label-md outline-none focus:border-primary"><option value="">全部团队</option>',
        1,
    )
    html = html.replace(
        '<input checked="" class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-secondary transition-transform duration-200 ease-in-out translate-x-5 z-10" type="checkbox"/>',
        '<input id="kanban-auto-dispatch" type="checkbox" class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-secondary transition-transform duration-200 ease-in-out z-10" aria-pressed="false"/>',
        1,
    )
    html = html.replace(
        '<button class="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-title-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2">创建任务',
        '<button id="kanban-dispatch" type="button" class="bg-surface-container text-primary px-4 py-2 rounded-xl font-label-md shadow-sm hover:bg-surface-container-high mr-2">派发</button>\n<button type="submit" class="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-title-lg text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2">创建任务',
        1,
    )
    # Close form tag
    html = html.replace(
        '</div>\n</main>',
        '<p id="kanban-task-status" class="font-label-sm text-secondary hidden" role="status" aria-live="polite"></p>\n</form>\n</main>',
        1,
    )

    # Extra styles + modals
    modals_src = MODALS.read_text(encoding="utf-8")
    modals_match = re.search(r"(<div class=\"terminal-drawer\".*)", modals_src, re.DOTALL)
    modals_html = modals_match.group(1) if modals_match else ""
    modals_html = modals_html.replace(
        "<script src=\"{{ url_for('static', filename='app.js')",
        "<!-- scripts moved -->",
    )
    modals_html = re.sub(r"<script>.*?</script>\s*<script src=.*?</script>\s*</body>\s*</html>\s*$", "", modals_html, flags=re.DOTALL)

    hidden = """
<!-- Hidden compatibility layer for app.js -->
<div class="sr-only" aria-hidden="true">
  <div id="agent-list"></div>
  <div id="kanban-task-list"></div>
  <div id="sidebar-stats"></div>
  <p id="agent-empty" hidden></p>
  <div id="kanban-team-picker" hidden><select id="kanban-team-select-hidden"></select></div>
  <button id="kanban-refresh" type="button" hidden></button>
  <button id="kanban-panels-toggle" type="button" hidden></button>
  <div id="kanban-team-ornament" hidden></div>
  <button id="kanban-assignee-trigger" type="button" hidden><span>Leader</span></button>
  <button id="open-history-drawer" type="button" hidden></button>
</div>
"""

    scripts = """
    <script>
      window.__BOOTSTRAP__ = {{ {"agents": agents, "teams": teams or [], "events": events, "kanban_task_links": kanban_task_links, "stats": stats}|tojson }};
    </script>
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
    <script src="{{ url_for('static', filename='app.js') }}?v={{ asset_version('app.js') }}"></script>
    <script src="{{ url_for('static', filename='ui-app.js') }}?v={{ asset_version('ui-app.js') }}"></script>
  </body></html>
"""

    html = html.replace("</body></html>", hidden + modals_html + scripts)

    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT} ({len(html)} bytes)")


if __name__ == "__main__":
    main()
