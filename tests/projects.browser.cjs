const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'..');
const rendered=spawnSync(process.env.PYTHON || 'python',['-c',`
from flask import Flask,render_template
from pathlib import Path
app=Flask('fixture',root_path=str(Path('app').resolve()))
with app.test_request_context('/'):
 print(render_template('index.html',agents=[dict(agent_id='lead',name='负责人',profile_name='lead',role='leader',runtime_status='running',readiness_status='ready')],teams=[],events=[],stats=[],kanban_task_links=[],message_target=None,asset_version=lambda _: 'test'))
`],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
assert.equal(rendered.status,0,rendered.stderr);
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('agentTeamApiToken','fixture'));
  let projects=[],tasks=[],artifacts=[],fail=true;
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname!=='projects.local') return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:rendered.stdout});
   if(url.pathname.startsWith('/static/')) {
    const name=url.pathname.slice(8),file=path.resolve(root,'app/static',name);
    assert.ok(file.startsWith(path.join(root,'app/static')+path.sep));
    return route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'application/octet-stream'});
   }
   if(url.pathname.includes('/events/stream'))return route.fulfill({contentType:'text/event-stream',body:''});
   if(url.pathname==='/api/projects') {
    if(req.method()==='POST')projects.push({...req.postDataJSON(),project_id:String(projects.length+1),workspace_path:'/workspace/projects/demo'});
    return route.fulfill({json:{ok:true,projects,project:projects.at(-1)}});
   }
   if(url.pathname.startsWith('/api/projects/')) {
    const parts=url.pathname.split('/'),pid=parts[3];
    if(parts[4]==='files')return route.fulfill({json:{ok:true,files:['PROJECT.md','docs/design.md']}});
    if(parts[4]==='tasks') {
     if(fail){fail=false;return route.fulfill({status:400,json:{ok:false,error:'Agent 尚未运行'}});}
     tasks.push({kanban_task_id:'kb_1',pid,kanban_status:'ready',assignee_profile:'lead',metadata:{task_title:req.postDataJSON().content}});
     return route.fulfill({json:{ok:true,message:{}}});
    }
    if(parts[4]==='artifacts') {artifacts.push({...req.postDataJSON(),pid,exists:true});return route.fulfill({json:{ok:true}});}
    return route.fulfill({json:{ok:true,project:projects.find(p=>p.project_id===pid),tasks:tasks.filter(t=>t.pid===pid),artifacts:artifacts.filter(a=>a.pid===pid)}});
   }
   return route.fulfill({json:{ok:true,links:[],teams:[],configs:[],settings:{}}});
  });
  await page.goto('http://projects.local');
  await page.locator('[data-view=projects]').click();
  assert.equal(await page.locator('[data-ui-dock=task-dock]').isVisible(),false);
  await page.locator('summary').filter({hasText:'新建项目'}).click();
  await page.locator('#project-create [name=name]').fill('协作项目');
  await page.locator('#project-create [name=description]').fill('交付需求、代码与测试报告');
  await page.locator('#project-create [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#project-title').textContent==='协作项目');
  await page.locator('summary').filter({hasText:'创建项目任务'}).click();
  await page.selectOption('#project-agent','lead');
  await page.locator('#project-task-form textarea').fill('开发 API');
  await page.locator('#project-task-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#project-error').textContent==='Agent 尚未运行');
  assert.equal(await page.locator('#project-task-form textarea').inputValue(),'开发 API');
  await page.locator('#project-task-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-project-task]').length===1);
  await page.locator('summary').filter({hasText:'登记已有产物'}).click();
  await page.locator('#project-artifact-form [name=title]').fill('设计文档');
  await page.locator('#project-artifact-form [name=path]').fill('docs/design.md');
  await page.selectOption('#artifact-task','kb_1');
  await page.locator('#project-artifact-form [name=validation]').fill('已核对接口');
  await page.locator('#project-artifact-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-artifacts article').length===1);
  assert.ok((await page.locator('#project-artifacts').innerText()).includes('已核对接口'));
  await page.locator('#project-create [name=name]').fill('第二项目');
  await page.locator('#project-create [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#project-title').textContent==='第二项目');
  assert.equal(await page.locator('[data-project-task]').count(),0);
  await page.locator('[data-project="1"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-artifacts article').length===1);
  if(process.env.PROJECT_SCREENSHOT)await page.screenshot({path:process.env.PROJECT_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#view-projects').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);
  console.log('PASS: project creation, task retry, artifact registration, project isolation, mobile layout');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
