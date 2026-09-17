// Run with NODE_PATH pointing to Playwright and PYTHON pointing to the project venv.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const agents = ['sales', 'tech'].flatMap(slug => ['leader', 'worker'].map(role => ({
  agent_id: `${slug}_${role}`, profile_name: `${slug}_${role}`, name: `${slug} ${role}`,
  role, team_id: slug, runtime_status: 'running', readiness_status: 'ready', status: 'idle',
  current_task: '', queue_depth: 0, description: '', is_leader: role === 'leader',
})));
let teams = ['sales','tech'].map(slug => ({slug, team_id: slug, name: slug, description: '',
  board_name: `team-${slug}`, members: agents.filter(a => a.team_id === slug), member_count: 2,
  lead_name: `${slug} leader`}));
const links = teams.map(t => ({kanban_task_id: t.slug, kanban_status:'ready', kanban_role:'parent',
  assignee_profile:`${t.slug}_leader`, metadata:{board:t.board_name,task_title:`${t.slug} task`}}));
const rendered = spawnSync(process.env.PYTHON || 'python', ['-c', `
import json,sys
from flask import Flask,render_template
from pathlib import Path
app=Flask('ux_fixture',root_path=str(Path('app').resolve()))
data=json.load(sys.stdin)
with app.test_request_context('/'):
    print(render_template('index.html',**data,events=[],stats=[],message_target=None,asset_version=lambda _: 'test'))
`], {cwd:root,input:JSON.stringify({agents,teams,kanban_task_links:links}),encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
assert.equal(rendered.status,0,rendered.stderr);
(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[]; const writes=[]; const messages=[]; const agentCreates=[]; let failMessage=true; let detailReads=0; let healthCalls=0; let failHealth=false; let profileReads=0; let profileStatusReads=0;
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',d=>d.accept());
    await page.addInitScript(()=>localStorage.setItem('agentTeamApiToken','fixture'));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='ux.local') return route.abort();
      if(url.pathname==='/') return route.fulfill({contentType:'text/html',body:rendered.stdout});
      if(url.pathname.startsWith('/static/')) {
        const name=decodeURIComponent(url.pathname.slice(8));
        const file=path.resolve(root,'app/static',name);
        assert.ok(file.startsWith(path.join(root,'app/static')+path.sep));
        const contentType=name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'application/octet-stream';
        return route.fulfill({contentType,body:fs.readFileSync(file)});
      }
      if(url.pathname.includes('/events/stream')) return route.fulfill({contentType:'text/event-stream',body:''});
      let body={ok:true,settings:{},configs:[],links};
      if(url.pathname==='/api/hermes/status') {
        profileStatusReads += 1;
        return route.fulfill({json:{ok:true,profiles:['status_profile'],message:'Hermes 已就绪'}});
      }
      if(url.pathname==='/api/profiles') {
        profileReads += 1;
        return route.fulfill({json:{ok:true,profiles:['live_profile_' + profileReads],fetched_at:'2026-09-13T10:00:00Z'}});
      }
      if(url.pathname==='/api/system/health') {
        healthCalls += 1;
        if(failHealth) return route.fulfill({status:503,json:{ok:false,error:'fixture health failure'}});
        return route.fulfill({json:{
          ok:true,checked_at:'2026-09-13T10:00:00Z',overall_status:'degraded',cached:false,
          components:{
            database:{status:'ready',message:'数据库连接正常',latency_ms:2,recovery_action:'无需处理',action_view:'settings'},
            hermes_cli:{status:'ready',message:'Hermes CLI 已就绪',latency_ms:8,recovery_action:'无需处理',action_view:'members'},
            kanban:{status:'degraded',message:'Kanban 响应较慢',latency_ms:120,recovery_action:'检查 Kanban',action_view:'board'},
            mcp:{status:'ready',message:'MCP 会话管理器已就绪',latency_ms:1,recovery_action:'无需处理',action_view:'settings'},
            event_stream:{status:'ready',message:'事件服务正常',latency_ms:1,recovery_action:'无需处理',action_view:'overview'},
            terminal:{status:'ready',message:'2 个终端运行中',latency_ms:1,recovery_action:'无需处理',action_view:'members'},
          },
        }});
      }
      if(url.pathname==='/api/teams/tech/usage') return route.fulfill({json:{ok:true,usage:{total:{calls:3,in_tokens:10000,out_tokens:2345,total_tokens:12345},by_member:{tech_leader:{calls:3,in_tokens:10000,out_tokens:2345,total_tokens:12345}},by_model:[]}}});
      if(url.pathname==='/api/teams/sales/usage') return route.fulfill({json:{ok:true,usage:{total:{calls:0,in_tokens:0,out_tokens:0,total_tokens:0},by_member:{},by_model:[]}}});
      if(url.pathname==='/api/kanban/tasks/tech/details') {
        detailReads += 1;
        if(detailReads===1) return route.fulfill({json:{
          ok:true,
          task:{task:{id:'tech',status:'running',body:'实现技术任务',result:''},latest_summary:'正在分析需求'},
          runs:[{id:'run-1',profile:'tech_leader',status:'running',summary:'已读取项目资料'}],
          context:'先读取资料，再实现并测试。',
          log:'步骤 1：读取资料\n步骤 2：实现功能',
          link:links.find(item=>item.kanban_task_id==='tech'),
          errors:{},
        }});
        return route.fulfill({status:500,json:{ok:false,error:'temporary details failure'}});
      }
      if(url.pathname==='/api/messages') {
        messages.push(route.request().postDataJSON());
        await new Promise(r=>setTimeout(r,250));
        if(failMessage) { failMessage=false; return route.fulfill({status:400,json:{ok:false,error:'fixture send failed'}}); }
        body={ok:true,message:{kanban_task_id:'sent-task'}};
      } else if(url.pathname==='/api/agents' && route.request().method()==='POST') {
        agentCreates.push(route.request().postDataJSON());
        return route.fulfill({status:400,json:{ok:false,error:'fixture agent rejected'}});
      } else if(url.pathname==='/api/teams') {
        if(route.request().method()==='POST') {
          const payload=route.request().postDataJSON(); writes.push(['POST',payload.slug]);
          const team={...payload,team_id:payload.slug,board_name:`team-${payload.slug}`,members:[],member_count:0};
          teams.push(team); body={ok:true,team};
          await new Promise(r=>setTimeout(r,100));
        } else body={ok:true,teams};
      } else if(url.pathname.startsWith('/api/teams/') && route.request().method()==='PATCH') {
        const slug=url.pathname.split('/')[3]; writes.push(['PATCH',slug]);
        Object.assign(teams.find(t=>t.slug===slug),route.request().postDataJSON());
        body={ok:true,team:teams.find(t=>t.slug===slug)};
      }
      return route.fulfill({json:body});
    });
    await page.goto('http://ux.local');
    assert.match(await page.title(), /AgentSwarm/);
    assert.doesNotMatch(await page.title(), /AgentWeave/);
    await page.waitForFunction(()=>window.__HERMES_UI__ && window.__HERMES_APP__);
    await page.waitForFunction(()=>document.querySelector('#overview-system-health-badge').textContent==='部分降级');
    assert.equal(await page.locator('#overview-system-health-components > div').count(),6);
    assert.match(await page.locator('#overview-system-health-components').innerText(),/Kanban 响应较慢/);
    failHealth=true;
    await page.locator('#overview-system-health-refresh').click();
    await page.waitForFunction(()=>document.querySelector('#overview-system-health-notice').textContent.includes('数据可能已过期'));
    assert.match(await page.locator('#overview-system-health-components').innerText(),/Kanban 响应较慢/);
    assert.ok(healthCalls>=2,'system health supports manual refresh');
    await page.locator('[data-view="teams"]').click();
    await page.locator('[data-edit-team="tech"]').click();
    await page.waitForFunction(()=>document.querySelector('#create-team-form').dataset.editSlug==='tech');
    assert.equal(await page.locator('#create-team-form [name="slug"]').getAttribute('readonly'),'');
    await page.locator('#create-team-form [name="name"]').fill('Technology');
    await page.locator('#create-team-form button[type="submit"]').click();
    await page.waitForFunction(()=>!document.querySelector('#create-team-form button[type="submit"]').disabled);
    assert.deepEqual(writes,[['PATCH','tech']]);
    await page.keyboard.press('Escape');
    await page.locator('#teams-manage-modal').waitFor({state:'hidden'});
    await page.locator('#btn-create-team').click();
    await page.waitForFunction(()=>!document.querySelector('#create-team-form button[type="submit"]').disabled);
    assert.equal(await page.locator('#create-team-form [name="slug"]').getAttribute('readonly'),null);
    await page.locator('#create-team-form [name="slug"]').fill('design');
    await page.locator('#create-team-form [name="name"]').fill('Design');
    await page.locator('#create-team-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
    await page.waitForFunction(()=>!document.querySelector('#create-team-form button[type="submit"]').disabled);
    assert.deepEqual(writes,[['PATCH','tech'],['POST','design']]);
    await page.keyboard.press('Escape');
    await page.locator('#teams-manage-modal').waitFor({state:'hidden'});
    await page.locator('[data-view-team="tech"]').click();
    await page.locator('#team-join-form').waitFor();
    assert.equal(await page.locator('[data-team-remove]').count(),2);
    await page.keyboard.press('Escape');
    await page.locator('#teams-manage-modal').waitFor({state:'hidden'});
    await page.locator('[data-view="board"]').click();
    await page.locator('#board-team-select').selectOption('tech');
    await page.waitForFunction(()=>document.querySelectorAll('#board-kanban-columns .kanban-ui-card').length===1);
    assert.match(await page.locator('#board-kanban-columns').innerText(),/tech task/);
    await page.locator('#board-kanban-columns .kanban-ui-card').click();
    await page.locator('#kanban-process-view').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#kanban-process-content').textContent.includes('步骤 2：实现功能'));
    const processBeforeFailure=await page.locator('#kanban-process-content').innerText();
    await page.waitForTimeout(3000);
    assert.ok(detailReads>=2,'task process refreshes while running');
    assert.equal(await page.locator('#kanban-process-content').innerText(),processBeforeFailure);
    assert.match(await page.locator('#kanban-process-status').innerText(),/已保留上次记录/);
    await page.keyboard.press('Escape');
    await page.locator('#terminal-drawer').waitFor({state:'hidden'});
    await page.evaluate(()=>window.__HERMES_UI__.onAgentsUpdate(window.__BOOTSTRAP__.agents,[]));
    assert.equal(await page.locator('#board-team-select').inputValue(),'tech');
    assert.equal(await page.locator('#kanban-team-select').inputValue(),'tech');
    await page.locator('#kanban-team-select').selectOption('design');
    await page.locator('#kanban-task-input').fill('No agents');
    await page.locator('#kanban-task-form button[type="submit"]').click();
    await page.locator('#kanban-task-status').waitFor({state:'visible'});
    assert.equal(messages.length,0);
    await page.locator('#kanban-team-select').selectOption('tech');
    await page.locator('#kanban-assignee-trigger').waitFor({state:'visible'});
    assert.match(await page.locator('#kanban-assignee-trigger').innerText(),/tech leader/);
    await page.locator('#kanban-task-input').fill('First task');
    await page.locator('#kanban-task-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
    await page.waitForFunction(()=>document.querySelector('#kanban-task-status').textContent==='fixture send failed');
    assert.equal(messages.length,1);
    assert.equal(await page.locator('#kanban-task-input').inputValue(),'First task');
    await page.locator('#kanban-task-form button[type="submit"]').click();
    await page.locator('#kanban-task-input').fill('Next draft');
    await page.waitForFunction(()=>!document.querySelector('#kanban-task-form button[type="submit"]').disabled);
    assert.equal(messages.length,2);
    assert.equal(messages[1].to_agent_id,'tech_leader');
    assert.equal(await page.locator('#kanban-task-input').inputValue(),'Next draft');
    await page.locator('#open-create-agent').click();
    await page.locator('#create-agent-team').waitFor({state:'visible'});
    assert.equal(await page.locator('#create-agent-team').inputValue(),'tech');
    const firstProfileRead = profileReads;
    assert.equal(
      await page.locator('#hermes-profile-options option').first().getAttribute('value'),
      'live_profile_' + firstProfileRead,
    );
    await page.locator('#refresh-hermes-profiles').click();
    await page.waitForFunction(
      (previous) => document.querySelector('#hermes-profile-options option')?.value !== 'live_profile_' + previous,
      firstProfileRead,
    );
    const manualProfileRead = profileReads;
    assert.match(await page.locator('#hermes-profile-status').innerText(), /已读取 1 个 Profile/);
    await page.waitForTimeout(3200);
    assert.equal(profileReads, manualProfileRead, 'open Agent dialog does not poll Hermes profiles');
    assert.equal(
      await page.locator('#hermes-profile-options option').first().getAttribute('value'),
      'live_profile_' + manualProfileRead,
    );
    assert.ok(profileStatusReads >= 1);
    await page.locator('#create-agent-form [name="name"]').fill('New worker');
    await page.locator('#create-agent-form [name="profile_name"]').fill('new_worker');
    await page.locator('#create-agent-form button[type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#create-agent-error').textContent==='fixture agent rejected');
    assert.equal(agentCreates[0].team,'tech');
    await page.keyboard.press('Escape');
    await page.locator('#create-agent-modal').waitFor({state:'hidden'});
    await page.locator('#open-create-agent').click();
    await page.locator('#create-agent-team').waitFor({state:'visible'});
    assert.ok(profileReads > firstProfileRead, 'reopening Agent dialog refetches Hermes profiles');
    assert.equal(
      await page.locator('#hermes-profile-options option').first().getAttribute('value'),
      'live_profile_' + profileReads,
    );
    await page.keyboard.press('Escape');
    await page.locator('#create-agent-modal').waitFor({state:'hidden'});
    await page.evaluate(()=>{
      window.__BOOTSTRAP__.teams.forEach(team=>{team.name='Same name'});
      window.__HERMES_UI__.onTeamsUpdate();
    });
    await page.locator('[data-view="members"]').click();
    await page.locator('#members-filter-bar [data-filter="tech"]').click();
    assert.equal(await page.locator('#members-grid [data-session-action]').count(),2);
    assert.equal(await page.locator('#members-grid [data-session-action][data-agent-id^="sales"]').count(),0);
    const memberConfigButtons = page.locator('#members-grid [data-agent-config]');
    await memberConfigButtons.nth(0).click();
    const firstMenuPosition = await page.evaluate(() => {
      const trigger = document.querySelectorAll('#members-grid [data-agent-config]')[0].getBoundingClientRect();
      const menu = document.querySelector('.agent-context-menu:not([hidden])').getBoundingClientRect();
      return {triggerRight: trigger.right, menuRight: menu.right, menuLeft: menu.left, menuTop: menu.top};
    });
    assert.ok(Math.abs(firstMenuPosition.triggerRight - firstMenuPosition.menuRight) < 2, 'member menu aligns to visible trigger');
    await page.keyboard.press('Escape');
    await memberConfigButtons.nth(1).click();
    const secondMenuPosition = await page.locator('.agent-context-menu:not([hidden])').boundingBox();
    assert.notEqual(Math.round(firstMenuPosition.menuTop), Math.round(secondMenuPosition.y), 'member menu follows the clicked member row');
    await page.locator('[data-view="stats"]').click();
    await page.waitForFunction(()=>document.querySelector('#stats-content').textContent.includes('12.3K'));
    assert.match(await page.locator('#stats-content').innerText(),/技术|tech/i);
    assert.match(await page.locator('#stats-content').innerText(),/3 次调用/);
    const usagePanel=page.locator('#stats-content h3').filter({hasText:'团队 Token 用量'}).locator('..');
    assert.equal(await usagePanel.locator('.rounded-xl.bg-surface-container-low').count(),2);
    assert.match(await usagePanel.innerText(),/0\s+0 次调用/);
    assert.doesNotMatch(await usagePanel.innerText(),/暂无用量数据/);
    await page.locator('[data-view="board"]').click();
    assert.equal(await page.locator('.nav-link[aria-current="page"]').getAttribute('data-view'), 'board');
    assert.equal(new URL(page.url()).hash, '#board');
    await page.locator('[data-view="members"]').click();
    await page.goBack();
    await page.waitForFunction(()=>document.body.dataset.view==='board');
    assert.equal(await page.locator('#swarm-page-title').innerText(), '任务板');
    await page.locator('#swarm-open-help').click();
    assert.ok(await page.locator('#swarm-help').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#swarm-help').isVisible(),false);
    if(process.env.SWARM_SCREENSHOT) {
      await page.locator('[data-view="overview"]').click();
      await page.waitForTimeout(200);
      assert.ok(await page.locator('#overview-system-health').evaluate(el=>el.scrollHeight<=el.clientHeight+2), 'health components must not be clipped');
      await page.screenshot({path:process.env.SWARM_SCREENSHOT});
      await page.locator('[data-view="board"]').click();
    }
    const pageViews=['overview','board','members','stats','teams','settings'];
    for (const view of pageViews) {
      await page.locator('[data-view="'+view+'"]').click();
      await page.waitForFunction(name=>document.body.dataset.view===name,view);
      assert.ok(await page.locator('#view-'+view).isVisible(),view+' page is visible');
      if(process.env.SWARM_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.SWARM_SCREENSHOT_DIR,view+'.png'),fullPage:true});
    }
    await page.locator('[data-view="board"]').click();
    await page.setViewportSize({width:390,height:844});
    await page.locator('#kanban-task-form button[type="submit"]').scrollIntoViewIfNeeded();
    const submitRect=await page.locator('#kanban-task-form button[type="submit"]').boundingBox();
    assert.ok(submitRect.x>=0 && submitRect.x+submitRect.width<=390,'mobile submit stays within viewport');
    await page.locator('#open-teams-page').click();
    await page.waitForFunction(()=>!document.querySelector('#create-team-form button[type="submit"]').disabled);
    const panel=page.locator('#teams-manage-modal .modal__panel');
    const panelRect=await panel.boundingBox();
    assert.ok(panelRect.x>=0 && panelRect.x+panelRect.width<=390,'mobile team dialog fits viewport');
    assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'mobile team dialog has no horizontal overflow');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#teams-manage-modal .modal__panel')).opacity==='1');
    if(process.env.UX_SCREENSHOT) await page.screenshot({path:process.env.UX_SCREENSHOT});
    const duplicateIds=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)});
    assert.deepEqual(duplicateIds,[]);
    assert.deepEqual(errors,[]);
    console.log('PASS: edit/create reset, single submit, member controls, anchored member menu, team filtering, realtime selection, persistent task process, retained system health, nested team usage response, unique IDs, send failure/retry, draft preservation, Agent team selection, initial and manual Hermes profile refresh, mobile layout, no page errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
