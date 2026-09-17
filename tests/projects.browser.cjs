const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'..');
const agents = [
  {agent_id:'lead',name:'工程负责人',profile_name:'lead',role:'leader',runtime_status:'running',readiness_status:'ready',team_id:'team-eng'},
  {agent_id:'designer',name:'设计负责人',profile_name:'designer',role:'leader',runtime_status:'running',readiness_status:'ready',team_id:'team-design'},
];
const teams = [
  {team_id:'team-eng',slug:'engineering',name:'工程团队',member_count:1},
  {team_id:'team-design',slug:'design',name:'设计团队',member_count:1},
];
const renderScript = [
  'import json,sys',
  'from flask import Flask,render_template',
  'from pathlib import Path',
  "app=Flask('fixture',root_path=str(Path('app').resolve()))",
  'data=json.load(sys.stdin)',
  "with app.test_request_context('/'):",
  " print(render_template('index.html',agents=data['agents'],teams=data['teams'],events=[],stats=[],kanban_task_links=[],message_target=None,asset_version=lambda _: 'test'))",
].join('\n');
const rendered=spawnSync(process.env.PYTHON || 'python',['-c',renderScript],{cwd:root,input:JSON.stringify({agents,teams}),encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
assert.equal(rendered.status,0,rendered.stderr);

(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('agentTeamApiToken','fixture'));
  let projects=[],tasks=[],artifacts=[],fail=true,workspaceReads=0,designPreviewReads=0;
  const enrich = project => ({
    ...project,
    team_ids: project.team_ids || [],
    teams: (project.team_ids || []).map(id => {
      const team=teams.find(item=>item.team_id===id);
      return {team_id:id,slug:team?.slug || '',name:team?.name || '已删除团队'};
    }),
  });
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname!=='projects.local') return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:rendered.stdout});
   if(url.pathname.startsWith('/static/')) {
    const name=decodeURIComponent(url.pathname.slice(8)),file=path.resolve(root,'app/static',name);
    assert.ok(file.startsWith(path.join(root,'app/static')+path.sep));
    return route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'application/octet-stream'});
   }
   if(url.pathname.includes('/events/stream'))return route.fulfill({contentType:'text/event-stream',body:''});
   if(url.pathname==='/api/projects') {
    if(req.method()==='POST'){
      const payload=req.postDataJSON();
      projects.push({...payload,project_id:String(projects.length+1),workspace_path:'/workspace/projects/'+String(projects.length+1)});
    }
    return route.fulfill({json:{ok:true,projects:projects.map(enrich),project:projects.length?enrich(projects.at(-1)):null}});
   }
   if(url.pathname.startsWith('/api/projects/')) {
    const parts=url.pathname.split('/'),pid=parts[3];
    if(parts[4]==='files')return route.fulfill({json:{ok:true,files:['PROJECT.md','docs/design.md'],truncated:false}});
    if(parts[4]==='workspace'){
      workspaceReads+=1;
      const taskId=url.searchParams.get('task_id') || '';
      const allFiles=[
        {path:'PROJECT.md',name:'PROJECT.md',size:8000,modified_ns:1,preview_type:'text',mime_type:'text/markdown',is_artifact:false,artifact:null},
        {path:'docs/design.md',name:'design.md',size:16,modified_ns:designPreviewReads?2:1,preview_type:'text',mime_type:'text/markdown',is_artifact:artifacts.length>0,artifact:artifacts[0] || null},
        {path:'docs/demo.html',name:'demo.html',size:80,modified_ns:1,preview_type:'text',mime_type:'text/html',is_artifact:false,artifact:null},
        {path:'docs/pixel.png',name:'pixel.png',size:68,modified_ns:1,preview_type:'image',mime_type:'image/png',is_artifact:false,artifact:null},
      ];
      const files=taskId ? allFiles.filter(file=>file.path==='docs/design.md' && artifacts.some(item=>item.task_id===taskId)) : allFiles;
      return route.fulfill({json:{ok:true,project:enrich(projects.find(p=>p.project_id===pid)),scope:taskId?'task':'project',task:tasks.find(item=>item.kanban_task_id===taskId) || null,files,artifacts:taskId?artifacts.filter(item=>item.task_id===taskId):artifacts,all_artifacts:artifacts,truncated:false}});
    }
    if(parts[4]==='raw'){
      const rawPath=parts.slice(5).join('/');
      if(rawPath==='docs/demo.html')return route.fulfill({contentType:'text/html',body:'<h1>HTML 页面</h1><p>安全预览</p>'});
      if(rawPath==='docs/pixel.png')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64')});
    }
    if(parts[4]==='preview'){
      const requested=url.searchParams.get('path');
      if(requested==='PROJECT.md')return route.fulfill({json:{ok:true,path:requested,preview_type:'text',mime_type:'text/markdown',size:8000,modified_ns:1,encoding:'utf-8',content:'# 项目说明\n\n**重点内容**\n\n| 功能 | 状态 | 负责人 |\n| :--- | :---: | ---: |\n| 文件预览 | **已完成** | Hermes |\n| 转义内容 | `a\\|b` | C:\\work |\n\n'+Array.from({length:100},(_,i)=>`第 ${i+1} 行工作说明`).join('\n\n')}});
      if(requested==='docs/demo.html')return route.fulfill({json:{ok:true,path:requested,preview_type:'text',mime_type:'text/html',size:80,modified_ns:1,encoding:'utf-8',content:'<h1>HTML 页面</h1><p>安全预览</p>'}});
      if(requested==='docs/pixel.png')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64')});
      designPreviewReads+=1;
      return route.fulfill({json:{ok:true,path:requested,preview_type:'text',mime_type:'text/markdown',size:16,modified_ns:designPreviewReads>1?2:1,encoding:'utf-8',content:designPreviewReads>1?'设计内容 v2':'设计内容 v1'}});
    }
    if(parts[4]==='teams' && req.method()==='PUT'){
      projects.find(item=>item.project_id===pid).team_ids=req.postDataJSON().team_ids;
      return route.fulfill({json:{ok:true,project:enrich(projects.find(item=>item.project_id===pid))}});
    }
    if(parts[4]==='tasks') {
     if(fail){fail=false;return route.fulfill({status:400,json:{ok:false,error:'Agent 尚未运行'}});}
     const iteration=tasks.filter(t=>t.pid===pid).length+1;
     tasks.push({kanban_task_id:'kb_1',pid,local_type:'user_task',kanban_role:'parent',kanban_status:'ready',assignee_profile:'lead',metadata:{task_title:req.postDataJSON().content,project_iteration:iteration}});
     return route.fulfill({json:{ok:true,message:{}}});
    }
    if(parts[4]==='artifacts'){artifacts.push({...req.postDataJSON(),pid,exists:true});return route.fulfill({json:{ok:true}});}
    const projectTasks=tasks.filter(t=>t.pid===pid);
    return route.fulfill({json:{ok:true,project:enrich(projects.find(p=>p.project_id===pid)),tasks:projectTasks,artifacts:artifacts.filter(a=>a.pid===pid),current_iteration:projectTasks.length,next_iteration:projectTasks.length+1}});
   }
   return route.fulfill({json:{ok:true,links:[],teams,configs:[],settings:{}}});
  });

  await page.goto('http://projects.local');
  await page.locator('[data-view=projects]').click();
  assert.equal(await page.locator('#project-summary > .swarm-stat').count(),3);
  assert.equal(await page.locator('[data-ui-dock=task-dock]').isVisible(),false);
  assert.equal(await page.locator('#project-detail-drawer').isVisible(),false,'project list is separate from project details');
  await page.locator('#project-open-create').click();
  await page.locator('#project-create-modal').waitFor({state:'visible'});
  assert.equal(await page.locator('#project-create-teams input').count(),2);
  await page.locator('#project-create [name=name]').fill('协作项目');
  await page.locator('#project-create [name=description]').fill('交付需求、代码与测试报告');
  for (const checkbox of await page.locator('#project-create-teams input').all()) await checkbox.check();
  await page.locator('#project-create [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#project-title').textContent==='协作项目');
  await page.locator('#project-detail-drawer').waitFor({state:'visible'});
  await page.locator('[data-project-mode="workspace"]').click();
  await page.waitForFunction(()=>document.body.dataset.view==='workspace');
  await page.waitForFunction(()=>document.querySelectorAll('#project-files [data-workspace-open]').length===4);
  assert.match(await page.locator('#project-files .project-tree-root-label').innerText(),/workspace/);
  assert.equal(await page.locator('#project-files [data-tree-plugin="workspace-tree"]').count(),1,'friendly workspace tree plugin renders');
  assert.equal(await page.locator('[data-workspace-open="PROJECT.md"] .workspace-tree__file-icon--markdown').innerText(),'MD');
  assert.equal(await page.locator('[data-workspace-open="docs/demo.html"] .workspace-tree__file-icon--html').innerText(),'<>');
  assert.equal(await page.locator('[data-workspace-open="docs/pixel.png"] .workspace-tree__file-icon--image').innerText(),'IMG');
  assert.equal(await page.locator('.project-tree-toolbar button svg').count(),3,'tree toolbar uses recognizable icons');
  const docsDirectory=page.locator('#project-files .project-tree-directory').filter({hasText:'docs'});
  assert.equal(await docsDirectory.count(),1);
  assert.equal(await page.locator('#project-file-count').innerText(),'4');
  await docsDirectory.locator('summary').click();
  assert.equal(await docsDirectory.getAttribute('open'),null);
  await page.waitForTimeout(3200);
  assert.equal(await docsDirectory.getAttribute('open'),null,'polling preserves collapsed directories');
  await page.locator('#project-file-filter').fill('PROJECT');
  assert.equal(await page.locator('#project-files [data-workspace-open]').count(),1);
  assert.equal(await page.locator('#project-file-count').innerText(),'1/4');
  await page.locator('#project-file-filter').fill('');
  await page.locator('#project-files-expand').click();
  assert.notEqual(await docsDirectory.getAttribute('open'),null);
  assert.equal(await page.locator('.project-workspace-tools').isVisible(),true);
  await page.locator('[data-workspace-open="PROJECT.md"]').click();
  await page.locator('#project-preview-content .project-markdown h1').waitFor();
  assert.equal(await page.locator('#project-preview-content .project-markdown > strong, #project-preview-content .project-markdown > p > strong').first().innerText(),'重点内容');
  assert.equal(await page.locator('#project-preview-content .project-markdown table').count(),1,'GFM table renders as a table');
  assert.deepEqual(await page.locator('#project-preview-content .project-markdown thead th').allInnerTexts(),['功能','状态','负责人']);
  assert.equal(await page.locator('#project-preview-content .project-markdown tbody tr').count(),2);
  assert.equal(await page.locator('#project-preview-content .project-markdown tbody strong').innerText(),'已完成');
  assert.equal(await page.locator('#project-preview-content .project-markdown tbody code').innerText(),'a|b');
  assert.equal(await page.locator('#project-preview-content .project-markdown tbody tr').nth(1).locator('td').nth(2).innerText(),'C:\\work');
  assert.match(await page.locator('#project-preview-content .project-markdown thead th').nth(1).getAttribute('class'),/center/);
  assert.match(await page.locator('#project-preview-content .project-markdown thead th').nth(2).getAttribute('class'),/right/);
  const previewScroll=await page.locator('#project-preview-content').evaluate(element=>({scrollHeight:element.scrollHeight,clientHeight:element.clientHeight}));
  assert.ok(previewScroll.scrollHeight>previewScroll.clientHeight,'rendered markdown preview scrolls vertically');
  await page.locator('#project-preview-content').evaluate(element=>{element.scrollTop=element.scrollHeight;});
  assert.ok(await page.locator('#project-preview-content').evaluate(element=>element.scrollTop>0));
  await page.locator('[data-workspace-open="docs/demo.html"]').click();
  await page.locator('#project-preview-content iframe').waitFor();
  assert.equal(await page.locator('[data-preview-mode="preview"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-preview-mode="source"]').click();
  assert.match(await page.locator('#project-preview-content pre').innerText(),/HTML 页面/);
  await page.locator('[data-workspace-open="docs/pixel.png"]').click();
  await page.locator('#project-preview-content img').waitFor();  assert.deepEqual(projects[0].team_ids,['team-eng','team-design']);
  assert.match(await page.locator('#project-team-badges').innerText(),/工程团队/);
  assert.match(await page.locator('#project-team-badges').innerText(),/设计团队/);
  assert.equal(await page.locator('#project-agent option').count(),3);

  await page.locator('[data-project-mode="projects"]').click();
  await page.locator('.project-team-editor summary').click();
  await page.locator('#project-edit-teams input[value="team-design"]').uncheck();
  await page.locator('#project-team-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-team-badges .project-team-badge').length===1);
  assert.equal(await page.locator('#project-agent option').count(),2);
  assert.match(await page.locator('#project-team-portfolio').innerText(),/工程团队[\s\S]*1 个项目[\s\S]*协作项目/);
  assert.match(await page.locator('#project-team-portfolio').innerText(),/设计团队[\s\S]*0 个项目/);

  await page.locator('summary').filter({hasText:'新建迭代任务'}).click();
  await page.selectOption('#project-agent','lead');
  await page.locator('#project-task-form textarea').fill('开发 API');
  await page.locator('#project-task-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#project-error').textContent==='Agent 尚未运行');
  assert.equal(await page.locator('#project-task-form textarea').inputValue(),'开发 API');
  await page.locator('#project-task-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-project-task]').length===1);
  assert.equal(await page.locator('#project-iteration').innerText(),'已迭代 1 次');
  assert.ok((await page.locator('[data-project-task]').innerText()).includes('工程团队'));

  await page.locator('summary').filter({hasText:'登记已有产物'}).click();
  await page.locator('#project-artifact-form [name=title]').fill('设计文档');
  await page.locator('#project-artifact-form [name=path]').fill('docs/design.md');
  await page.selectOption('#artifact-task','kb_1');
  await page.locator('#project-artifact-form [name=validation]').fill('已核对接口');
  await page.locator('#project-artifact-form [type=submit]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-artifacts article').length===1);
  await page.locator('[data-project-mode="workspace"]').click();
  await page.locator('#project-files [data-workspace-open="docs/design.md"]').click();
  await page.waitForFunction(()=>document.querySelector('#project-preview-content').textContent.includes('设计内容 v1'));
  await page.waitForFunction(()=>document.querySelector('#project-preview-content').textContent.includes('设计内容 v2'),null,{timeout:7000});
  assert.ok(workspaceReads>=2,'project workspace polls for changes');
  await page.locator('[data-workspace-scope="task"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-workspace-scope="task"]').getAttribute('aria-pressed')==='true');
  await page.waitForFunction(()=>document.querySelector('#project-workspace-status').textContent.includes('任务工作空间'));
  assert.equal(await page.locator('#project-files [data-workspace-open]').count(),1);
  assert.equal(await page.locator('#project-files [data-workspace-open]').getAttribute('title'),'docs/design.md');
  assert.match(await page.locator('#project-open-terminal').getAttribute('title'),/协作项目.*Linux 终端/);
  await page.locator('#project-open-terminal').click();
  await page.locator('#workspace-terminal-drawer').waitFor({state:'visible'});
  assert.match(await page.locator('#workspace-terminal-title').innerText(),/协作项目 · Linux Terminal/);
  const drawerLayers=await page.evaluate(()=>({terminal:Number(getComputedStyle(document.querySelector('#workspace-terminal-drawer')).zIndex),project:Number(getComputedStyle(document.querySelector('#project-detail-drawer')).zIndex)}));
  assert.ok(drawerLayers.terminal>drawerLayers.project,'Linux terminal stays above the workspace detail drawer');
  await page.keyboard.press('Escape');
  await page.locator('#workspace-terminal-drawer').waitFor({state:'hidden'});

  await page.locator('[data-project-mode="projects"]').click();
  await page.locator('button[data-close-project-detail]').click();
  await page.locator('#project-detail-drawer').waitFor({state:'hidden'});
  await page.locator('#project-open-create').click();
  await page.locator('#project-create-modal').waitFor({state:'visible'});
  await page.locator('#project-create [name=name]').fill('第二项目');
  await page.locator('#project-create-teams input[value="team-eng"]').check();
  await page.locator('#project-create [type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#project-title').textContent==='第二项目');
  await page.waitForFunction(()=>document.querySelector('#project-team-portfolio').textContent.includes('2 个项目'));
  assert.match(await page.locator('#project-team-portfolio').innerText(),/工程团队[\s\S]*2 个项目[\s\S]*协作项目[\s\S]*第二项目/);
  await page.locator('button[data-close-project-detail]').click();
  await page.locator('#project-detail-drawer').waitFor({state:'hidden'});
  await page.locator('[data-project="1"]').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('#project-artifacts article').length===1);
  assert.ok(await page.locator('#overview-projects').innerText().then(t=>t.includes('工程团队')));

  await page.locator('[data-project-mode="workspace"]').click();
  await page.waitForFunction(()=>document.body.dataset.view==='workspace');
  assert.equal(new URL(page.url()).hash, '#workspace');
  await page.locator('.project-workspace-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#project-summary > .swarm-stat').count(),3);
  if(process.env.WORKSPACE_SCREENSHOT)await page.screenshot({path:process.env.WORKSPACE_SCREENSHOT,fullPage:true});
  assert.equal(await page.locator('#project-tasks').isVisible(),false,'workspace drawer only shows workspace details');
  await page.reload();
  await page.waitForFunction(()=>document.body.dataset.view==='workspace');
  assert.equal(await page.locator('#project-detail-drawer').isVisible(),false,'workspace details stay closed until a project is selected');
  await page.locator('[data-project="1"]').first().click();
  await page.waitForFunction(()=>document.querySelector('#project-title').textContent==='协作项目');
  await page.locator('#project-detail-drawer').waitFor({state:'visible'});
  assert.equal(await page.locator('.nav-link[aria-current="page"]').getAttribute('data-view'),'workspace');
  await page.locator('[data-project-mode="projects"]').click();
  await page.locator('#project-tasks').waitFor({state:'visible'});
  if(process.env.PROJECT_SCREENSHOT)await page.screenshot({path:process.env.PROJECT_SCREENSHOT});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#view-projects').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);
  console.log('PASS: separated project list/create/detail, workspace detail drawer, team many-to-many UI, iterations, searchable file tree, Linux terminal, rendered artifact previews, project isolation, mobile layout');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
