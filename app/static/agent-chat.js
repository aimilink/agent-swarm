(function () {
  const byId = id => document.getElementById(id);
  const agentSelect = byId('chat-agent');
  const agentList = byId('chat-agent-list');
  const history = byId('chat-history');
  const messages = byId('chat-messages');
  const input = byId('chat-input');
  const status = byId('chat-status');
  let agentId = '', selected = null, generation = 0, sending = false;
  const esc = value => window.__HERMES_APP__.escapeHtml(String(value ?? ''));
  const path = () => `/api/agents/${encodeURIComponent(agentId)}/chats`;
  async function api(url, body) {
    const response = await fetch(url, body === undefined ? {} : {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || '请求失败');
    return data;
  }
  function report(error) { status.textContent = error.message || String(error); }
  function render() {
    byId('chat-title').textContent = selected?.title || 'Agent 对话';
    messages.innerHTML = selected?.messages?.length ? selected.messages.map(m =>
      `<article class="chat-message chat-message--${esc(m.role)}"><strong>${m.role === 'user' ? '你' : m.role === 'error' ? '提示' : esc(agentSelect.selectedOptions[0]?.textContent || 'Agent')}</strong><div>${esc(m.content)}</div><small>${esc(new Date(m.created_at).toLocaleString())}</small></article>`
    ).join('') : '<p class="chat-empty">选择 Agent，新建对话，开始一对一交流。历史会话会自动保存。</p>';
    if (selected?.busy) messages.insertAdjacentHTML('beforeend', '<p class="chat-empty">Agent 正在回复…</p>');
    byId('chat-send').disabled = !selected || selected.busy || sending;
    input.disabled = !selected || selected.busy || sending;
    history.querySelectorAll('button').forEach(button => button.classList.toggle('is-selected', button.dataset.chatId === selected?.chat_id));
    agentList?.querySelectorAll('[data-chat-agent]').forEach(button => button.classList.toggle('is-selected', button.dataset.chatAgent === agentId));
    messages.scrollTop = messages.scrollHeight;
  }
  async function loadHistory() {
    const token = generation, url = path();
    if (!agentId) { history.innerHTML = ''; return; }
    const data = await api(url);
    if (token !== generation) return;
    history.innerHTML = data.chats.length ? data.chats.map(chat =>
      `<button type="button" data-chat-id="${esc(chat.chat_id)}"><span>${esc(chat.title)}</span><small>${esc(new Date(chat.updated_at).toLocaleString())}</small></button>`
    ).join('') : '<p class="chat-empty">暂无历史对话</p>';
    history.querySelectorAll('button').forEach(button => button.classList.toggle('is-selected', button.dataset.chatId === selected?.chat_id));
    agentList?.querySelectorAll('[data-chat-agent]').forEach(button => button.classList.toggle('is-selected', button.dataset.chatAgent === agentId));
  }
  async function selectChat(id) {
    const token = ++generation;
    status.textContent = '';
    const data = await api(`${path()}/${encodeURIComponent(id)}`);
    if (token !== generation) return;
    selected = data.chat;
    input.value = '';
    render();
  }
  window.openAgentChat = async function (id) {
    window.switchView('chat');
    const agents = window.__BOOTSTRAP__.agents || [];
    agentSelect.innerHTML = '<option value="">选择 Agent</option>' + agents.map(a =>
      `<option value="${esc(a.agent_id)}">${esc(a.name)} · ${esc(a.profile_name)}</option>`).join('');
    if (agentList) agentList.innerHTML = agents.map((a, index) => `<button type="button" data-chat-agent="${esc(a.agent_id)}"><span class="swarm-member-avatar swarm-member-avatar--${index % 6}">${esc((a.name || '?').slice(0, 1))}</span><span><b>${esc(a.name)}</b><small>${esc(a.role)} · @${esc(a.profile_name)}</small></span><em>${(a.runtime_status || 'stopped') === 'running' ? '运行中' : '空闲'}</em></button>`).join('');
    const next = id || agentId || agents[0]?.agent_id || '';
    agentSelect.value = next;
    if (next !== agentId) { ++generation; agentId = next; selected = null; input.value = ''; }
    byId('chat-new').disabled = !agentId;
    render();
    try { await loadHistory(); } catch (error) { report(error); }
  };
  agentSelect.addEventListener('change', () => window.openAgentChat(agentSelect.value));
  agentList?.addEventListener('click', event => { const button = event.target.closest('[data-chat-agent]'); if (button) window.openAgentChat(button.dataset.chatAgent); });
  byId('chat-new').addEventListener('click', async () => {
    const token = ++generation;
    byId('chat-new').disabled = true;
    status.textContent = '';
    try {
      const data = await api(path(), {});
      if (token !== generation) return;
      selected = data.chat; input.value = ''; render(); await loadHistory(); input.focus();
    } catch (error) { report(error); }
    finally { byId('chat-new').disabled = !agentId; }
  });
  history.addEventListener('click', event => {
    const button = event.target.closest('[data-chat-id]');
    if (button) selectChat(button.dataset.chatId).catch(report);
  });
  byId('chat-form').addEventListener('submit', async event => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || !selected || selected.busy || sending) return;
    const token = generation, url = `${path()}/${selected.chat_id}/messages`;
    sending = true; status.textContent = ''; input.value = '';
    selected.messages.push({role: 'user', content, created_at: new Date().toISOString()});
    selected.busy = true; render();
    try {
      const data = await api(url, {content});
      if (token === generation) { selected = data.chat; render(); await loadHistory(); }
    } catch (error) {
      if (token === generation) {
        report(error); input.value = content;
        try { selected = (await api(url.replace(/\/messages$/, ''))).chat; } catch (_) { selected.busy = false; }
      }
    } finally { sending = false; render(); }
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); byId('chat-form').requestSubmit();
    }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-agent-chat]');
    if (button) { event.preventDefault(); event.stopPropagation(); window.openAgentChat(button.dataset.agentId); }
  }, true);
  setInterval(async () => {
    if (!selected?.busy || sending || byId('view-chat').classList.contains('hidden')) return;
    const token = generation;
    try {
      const data = await api(`${path()}/${selected.chat_id}`);
      if (token === generation) { selected = data.chat; render(); await loadHistory(); }
    } catch (error) { if (token === generation) report(error); }
  }, 3000);
})();
