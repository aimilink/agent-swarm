const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const agents = [
  {agent_id:'alpha',profile_name:'alpha',name:'Alpha',role:'leader',team_id:'team-a',runtime_status:'running',readiness_status:'ready',status:'idle'},
  {agent_id:'beta',profile_name:'beta',name:'Beta',role:'worker',team_id:'team-b',runtime_status:'running',readiness_status:'ready',status:'idle'},
];
const rendered = spawnSync(process.env.PYTHON || 'python', ['-c', `
from flask import Flask,render_template
from pathlib import Path
app=Flask('a2a_fixture',root_path=str(Path('app').resolve()))
agents=${JSON.stringify(agents)}
with app.test_request_context('/'):
    print(render_template('index.html',agents=agents,teams=[],kanban_task_links=[],events=[],stats=[],message_target=None,asset_version=lambda _: 'test'))
`], {cwd:root,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
assert.equal(rendered.status,0,rendered.stderr);

(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('agentTeamApiToken','fixture'));

    let conversation=null;
    let detailReads=0;
    let messageCount=0;
    const participant = id => agents.find(agent=>agent.agent_id===id);
    const summary = () => ({
      conversation_id:conversation.conversation_id,
      title:conversation.title,
      status:'active',
      participant_ids:['alpha','beta'],
      participants:[participant('alpha'),participant('beta')],
      created_at:conversation.created_at,
      updated_at:conversation.updated_at,
    });

    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='a2a.local') return route.abort();
      if(url.pathname==='/') return route.fulfill({contentType:'text/html',body:rendered.stdout});
      if(url.pathname.startsWith('/static/')){
        const name=decodeURIComponent(url.pathname.slice(8));
        const file=path.resolve(root,'app/static',name);
        assert.ok(file.startsWith(path.join(root,'app/static')+path.sep));
        const contentType=name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'application/octet-stream';
        return route.fulfill({contentType,body:fs.readFileSync(file)});
      }
      if(url.pathname==='/api/events/stream') return route.fulfill({contentType:'text/event-stream',body:''});
      if(url.pathname==='/api/system/health') return route.fulfill({json:{ok:true,overall_status:'ready',checked_at:new Date().toISOString(),components:{},cached:false}});
      if(url.pathname==='/api/teams' || url.pathname==='/api/model-configs' || url.pathname==='/api/settings/collaboration') {
        return route.fulfill({json:{ok:true,teams:[],configs:[],settings:{}}});
      }
      if(url.pathname==='/api/kanban/tasks') return route.fulfill({json:{ok:true,links:[]}});
      if(url.pathname==='/api/a2a/conversations' && route.request().method()==='GET'){
        return route.fulfill({json:{ok:true,conversations:conversation?[summary()]:[]}});
      }
      if(url.pathname==='/api/a2a/conversations' && route.request().method()==='POST'){
        const now=new Date().toISOString();
        conversation={conversation_id:'a2a-1',title:'Alpha ↔ Beta',created_at:now,updated_at:now,messages:[]};
        return route.fulfill({status:201,json:{ok:true,conversation:{...summary(),messages:[]}}});
      }
      if(url.pathname==='/api/a2a/conversations/a2a-1/messages'){
        const payload=route.request().postDataJSON();
        messageCount+=1;
        const recipient=payload.sender_agent_id==='alpha'?'beta':'alpha';
        conversation.messages.push({
          message_id:`message-${messageCount}`,conversation_id:'a2a-1',
          sender_agent_id:payload.sender_agent_id,sender_name:participant(payload.sender_agent_id).name,
          recipient_agent_id:recipient,recipient_name:participant(recipient).name,
          content:payload.content,status:messageCount===1?'delivered':'queued',
          reply_to_message_id:null,created_at:new Date().toISOString(),error:'',
        });
        conversation.updated_at=new Date().toISOString();
        return route.fulfill({status:202,json:{ok:true,conversation:{...summary(),messages:conversation.messages},message_id:`message-${messageCount}`,delivery_status:conversation.messages.at(-1).status}});
      }
      if(url.pathname==='/api/a2a/conversations/a2a-1'){
        detailReads+=1;
        if(detailReads>=1 && !conversation.messages.some(message=>message.reply_to_message_id==='message-1')){
          conversation.messages.push({
            message_id:'reply-1',conversation_id:'a2a-1',sender_agent_id:'beta',sender_name:'Beta',
            recipient_agent_id:'alpha',recipient_name:'Alpha',content:'已收到并完成检查',
            status:'completed',reply_to_message_id:'message-1',created_at:new Date().toISOString(),error:'',
          });
        }
        return route.fulfill({json:{ok:true,conversation:{...summary(),messages:conversation.messages}}});
      }
      return route.fulfill({json:{ok:true}});
    });

    await page.goto('http://a2a.local');
    await page.waitForFunction(()=>window.__HERMES_APP__ && window.__HERMES_UI__);
    await page.locator('[data-view="a2a"]').click();
    await page.waitForFunction(()=>document.querySelector('#a2a-history').textContent.includes('暂无 A2A 会话'));
    await page.locator('#a2a-from-agent').selectOption('alpha');
    await page.locator('#a2a-to-agent').selectOption('beta');
    await page.locator('#a2a-new').click();
    await page.waitForFunction(()=>document.querySelector('#a2a-title').textContent.includes('Alpha'));
    await page.locator('#a2a-input').fill('请检查接口设计');
    await page.locator('#a2a-form').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(()=>document.querySelector('#a2a-messages').textContent.includes('请检查接口设计'));
    assert.match(await page.locator('#a2a-messages').innerText(),/处理中/);
    await page.waitForFunction(()=>document.querySelector('#a2a-messages').textContent.includes('已收到并完成检查'),null,{timeout:7000});
    await page.locator('#a2a-sender').selectOption('beta');
    await page.locator('#a2a-input').fill('继续补充说明');
    await page.locator('#a2a-form').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(()=>document.querySelector('#a2a-messages').textContent.includes('继续补充说明'));
    assert.match(await page.locator('#a2a-messages').innerText(),/等待接收方上线/);
    assert.equal(messageCount,2);

    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('#view-a2a').evaluate(element=>element.scrollWidth<=element.clientWidth+1));
    assert.deepEqual(errors,[]);
    console.log('PASS: A2A create, participant identity, delivery status, persisted reply, continued conversation, offline queue, mobile layout');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
