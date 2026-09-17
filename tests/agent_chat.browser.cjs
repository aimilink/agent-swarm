const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage();
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  let chats=[], count=0;
  await page.route('http://chat.test/**', async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/') return route.fulfill({contentType:'text/html',body:`<section id="view-chat"><select id="chat-agent"></select><input id="chat-agent-search"><div id="chat-agent-list"></div><button id="chat-new">新建</button><div id="chat-history"></div><h2 id="chat-title"></h2><div id="chat-messages"></div><p id="chat-status"></p><form id="chat-form"><textarea id="chat-input"></textarea><button id="chat-send">发送</button></form></section>`});
   const parts=url.pathname.split('/'); const agent=parts[3]; const id=parts[5];
   let chat=chats.find(c=>c.chat_id===id);
   if(agent==='c') return route.fulfill({status:404,contentType:'text/html',body:'<html><h1>Not Found</h1></html>'});
   if(route.request().method()==='POST') {
    if(!id){ chat={chat_id:String(++count),agent_id:agent,title:'新聊天',messages:[],busy:false,updated_at:new Date().toISOString()};chats.push(chat); }
    else {
     const content=route.request().postDataJSON().content;
     chat.title=content;
     chat.messages.push({role:'user',content,created_at:chat.updated_at});
     chat.busy=true;
     setTimeout(()=>{
      chat.messages.push({role:'assistant',content:'回复 <script>安全</script>',created_at:chat.updated_at});
      chat.busy=false;
     },350);
    }
   }
   return route.fulfill({json:{ok:true,chat,chats:chats.filter(c=>c.agent_id===agent)}});
  });
  await page.goto('http://chat.test/');
  await page.evaluate(()=>{
   window.switchView=()=>{};
   window.__BOOTSTRAP__={agents:[{agent_id:'a',name:'Agent A',profile_name:'a'},{agent_id:'b',name:'Agent B',profile_name:'b'},{agent_id:'c',name:'Agent C',profile_name:'c'}]};
   window.__HERMES_APP__={escapeHtml: value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
  });
  await page.addScriptTag({content:fs.readFileSync('app/static/agent-chat.js','utf8')});
  await page.evaluate(()=>openAgentChat('a'));
  assert.equal(await page.locator('[data-chat-agent]').count(),3);
  await page.fill('#chat-agent-search','Agent B');
  assert.equal(await page.locator('[data-chat-agent]').count(),1);
  assert.equal(await page.locator('[data-chat-agent]').getAttribute('data-chat-agent'),'b');
  await page.fill('#chat-agent-search','');
  assert.equal(await page.locator('[data-chat-agent]').count(),3);
  assert.equal(await page.locator('[data-chat-agent="a"]').getAttribute('class'),'is-selected');
  await page.click('#chat-new'); await page.waitForFunction(()=>!document.getElementById('chat-input').disabled);
  await page.fill('#chat-input','第一条消息'); await page.press('#chat-input','Enter');
  await page.locator('.chat-thinking').waitFor();
  assert.match(await page.locator('.chat-thinking-head').innerText(),/Agent 正在思考/);
  assert.equal(await page.locator('.chat-thinking li[data-state=complete]').count(),2);
  assert.match(await page.locator('.chat-thinking li[data-state=active]').innerText(),/分析请求并生成回复/);
  assert.match(await page.locator('.chat-thinking > p').innerText(),/不包含模型内部推理文本/);
  await page.waitForFunction(()=>document.querySelectorAll('.chat-message').length===2);
  assert.equal(await page.locator('#chat-messages script').count(),0);
  await page.click('#chat-new'); await page.waitForFunction(()=>document.querySelectorAll('#chat-history button').length===2);
  assert.equal(await page.locator('.chat-message').count(),0);
  await page.locator('#chat-history button').first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.chat-message').length===2);
  await page.click('[data-chat-agent="b"]');
  assert.equal(await page.locator('#chat-agent').inputValue(),'b');
  await page.waitForFunction(()=>document.querySelectorAll('#chat-history button').length===0);
  assert.equal(await page.locator('.chat-message').count(),0);
  await page.click('[data-chat-agent="c"]');
  await page.waitForFunction(()=>document.querySelector('#chat-status').textContent.includes('服务器返回HTML'));
  assert.doesNotMatch(await page.locator('#chat-status').innerText(),/Unexpected token/);
  assert.deepEqual(errors,[]);
  console.log('PASS: agent name search, observable thinking progress, send, history, agent isolation, HTML escaping');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
