const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const agent = {
  agent_id: 'tech_leader', profile_name: 'tech_leader', name: 'Tech Leader', role: 'leader',
  team_id: 'tech', runtime_status: 'running', readiness_status: 'ready', status: 'idle',
  current_task: '', queue_depth: 0, description: '', is_leader: true,
};
const teams = [{
  slug: 'tech', team_id: 'tech', name: '技术团队', description: '', board_name: 'team-tech',
  members: [agent], member_count: 1, lead_name: agent.name,
}];
const links = Array.from({ length: 48 }, (_, index) => ({
  kanban_task_id: `done-${index}`,
  kanban_status: 'done',
  kanban_role: 'worker',
  assignee_profile: agent.profile_name,
  created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  metadata: { board: 'team-tech', task_title: `已完成任务 ${index + 1}` },
}));

const rendered = spawnSync(process.env.PYTHON || 'python', ['-c', `
import json,sys
from flask import Flask,render_template
from pathlib import Path
app=Flask('board_fixture',root_path=str(Path('app').resolve()))
data=json.load(sys.stdin)
with app.test_request_context('/'):
    print(render_template('index.html',**data,events=[],stats=[],message_target=None,asset_version=lambda _: 'test'))
`], {
  cwd: root,
  input: JSON.stringify({ agents: [agent], teams, kanban_task_links: links }),
  encoding: 'utf8',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});
assert.equal(rendered.status, 0, rendered.stderr);

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('agentTeamApiToken', 'fixture'));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'board.local') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: rendered.stdout });
      if (url.pathname.startsWith('/static/')) {
        const name = decodeURIComponent(url.pathname.slice(8));
        const file = path.resolve(root, 'app/static', name);
        assert.ok(file.startsWith(path.join(root, 'app/static') + path.sep));
        const contentType = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'application/octet-stream';
        return route.fulfill({ contentType, body: fs.readFileSync(file) });
      }
      if (url.pathname.includes('/events/stream')) return route.fulfill({ contentType: 'text/event-stream', body: '' });
      if (url.pathname === '/api/projects') return route.fulfill({ json: { ok: true, projects: [] } });
      return route.fulfill({ json: { ok: true, settings: {}, configs: [], links, teams } });
    });

    await page.goto('http://board.local');
    await page.waitForFunction(() => window.__HERMES_UI__ && window.__HERMES_APP__);
    await page.locator('[data-view="board"]').click();

    const allCards = page.locator('#board-kanban-columns .kanban-ui-card');
    await allCards.first().waitFor();
    assert.equal(await allCards.count(), 48, 'all completed tasks are rendered');
    assert.equal(await page.locator('[aria-label="已完成 48 个任务"]').textContent(), '48');

    const doneColumn = page.locator('[data-board-column-scroll="done"]');
    const metrics = await doneColumn.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    assert.ok(metrics.clientHeight > 0 && metrics.clientHeight < metrics.viewportHeight, 'column is constrained to the viewport');
    assert.ok(metrics.scrollHeight > metrics.clientHeight, 'completed column scrolls independently');

    await doneColumn.evaluate(element => { element.scrollTop = 420; });
    const beforeRefresh = await doneColumn.evaluate(element => element.scrollTop);
    assert.ok(beforeRefresh > 0);
    await page.evaluate(() => window.__HERMES_UI__.onKanbanUpdate({ links: window.__BOOTSTRAP__.kanban_task_links }));
    const afterRefresh = await page.locator('[data-board-column-scroll="done"]').evaluate(element => element.scrollTop);
    assert.equal(afterRefresh, beforeRefresh, 'live refresh preserves the column scroll position');

    await page.locator('[data-board-scroll-top="done"]').click();
    await page.waitForFunction(() => document.querySelector('[data-board-column-scroll="done"]').scrollTop === 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
