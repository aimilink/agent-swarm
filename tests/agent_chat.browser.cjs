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
   if(url.pathname==='/') return route.fulfill({contentType:'text/html',body:`<section id="view-chat"><select id="chat-agent"></select><div id="chat-agent-list"></div><button id="chat-new">新建</button><div id="chat-history"></div><h2 id="chat-title"></h2><div id="chat-messages"></div><p id="chat-status"></p><form id="chat-form"><textarea id="chat-input"></textarea><button id="chat-send">发送</button></form></section>`});
   const parts=url.pathname.split('/'); const agent=parts[3]; const id=parts[5];
   let chat=chats.find(c=>c.chat_id===id);
   if(route.request().method()==='POST') {
    if(!id){ chat={chat_id:String(++count),agent_id:agent,title:'新聊天',messages:[],busy:false,updated_at:new Date().toISOString()};chats.push(chat); }
    else { const content=route.request().postDataJSON().content;chat.title=content;chat.messages.push({role:'user',content,created_at:chat.updated_at},{role:'assistant',content:'回复 <script>安全</script>',created_at:chat.updated_at}); }
   }
   return route.fulfill({json:{ok:true,chat,chats:chats.filter(c=>c.agent_id===agent)}});
  });
  await page.goto('http://chat.test/');
  await page.evaluate(()=>{
   window.switchView=()=>{};
   window.__BOOTSTRAP__={agents:[{agent_id:'a',name:'Agent A',profile_name:'a'},{agent_id:'b',name:'Agent B',profile_name:'b'}]};
   window.__HERMES_APP__={escapeHtml: value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
  });
  await page.addScriptTag({content:fs.readFileSync('app/static/agent-chat.js','utf8')});
  await page.evaluate(()=>openAgentChat('a'));
  assert.equal(await page.locator('[data-chat-agent]').count(),2);
  assert.equal(await page.locator('[data-chat-agent="a"]').getAttribute('class'),'is-selected');
  await page.click('#chat-new'); await page.waitForFunction(()=>!document.getElementById('chat-input').disabled);
  await page.fill('#chat-input','第一条消息'); await page.press('#chat-input','Enter');
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
  assert.deepEqual(errors,[]);
  console.log('PASS: new chat, send, history, agent isolation, HTML escaping');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
