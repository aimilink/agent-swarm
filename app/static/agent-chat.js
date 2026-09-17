(function () {
  const byId = id => document.getElementById(id);
  const agentSelect = byId('chat-agent');
  const agentList = byId('chat-agent-list');
  const agentSearch = byId('chat-agent-search');
  const history = byId('chat-history');
  const messages = byId('chat-messages');
  const input = byId('chat-input');
  const status = byId('chat-status');
  let agentId = '', selected = null, generation = 0, sending = false;
  let availableAgents = [], agentQuery = '';
  let thinkingTimer = 0;
  const esc = value => window.__HERMES_APP__.escapeHtml(String(value ?? ''));
  const path = () => `/api/agents/${encodeURIComponent(agentId)}/chats`;
  async function api(url, body) {
    const options = {headers: {Accept: 'application/json'}};
    if (body !== undefined) {
      options.method = 'POST';
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      await response.text();
      const kind = contentType.includes('text/html') ? 'HTML' : '非 JSON 内容';
      throw new Error(`Agent 对话接口不可用（HTTP ${response.status}，服务器返回${kind}）。请确认后端已更新并重启。`);
    }
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error(`Agent 对话接口返回了无效 JSON（HTTP ${response.status}）。`); }
    if (!response.ok || !data.ok) throw new Error(data.error || '请求失败');
    return data;
  }
  function report(error) { status.textContent = error.message || String(error); }
  function defaultProgress(startedAt = new Date().toISOString()) {
    return {
      title: 'Agent 正在思考',
      started_at: startedAt,
      steps: [
        {label: '接收用户消息', detail: '消息已进入当前会话', status: 'complete'},
        {label: '整理会话上下文', detail: '已载入本次对话记录', status: 'complete'},
        {label: '分析请求并生成回复', detail: '正在等待 Hermes 模型返回', status: 'active'},
        {label: '保存并展示回复', detail: '模型返回后自动完成', status: 'pending'},
      ],
    };
  }
  function elapsedText(startedAt) {
    const start = new Date(startedAt || Date.now()).getTime();
    const seconds = Math.max(0, Math.floor((Date.now() - (Number.isFinite(start) ? start : Date.now())) / 1000));
    if (seconds < 60) return '已等待 ' + seconds + ' 秒';
    const minutes = Math.floor(seconds / 60);
    return '已等待 ' + minutes + ' 分 ' + String(seconds % 60).padStart(2, '0') + ' 秒';
  }
  function updateThinkingElapsed() {
    const elapsed = messages.querySelector('[data-chat-elapsed]');
    const panel = elapsed?.closest('[data-thinking-started]');
    if (elapsed && panel) elapsed.textContent = elapsedText(panel.dataset.thinkingStarted);
  }
  function syncThinkingClock(active) {
    if (!active) {
      if (thinkingTimer) window.clearInterval(thinkingTimer);
      thinkingTimer = 0;
      return;
    }
    updateThinkingElapsed();
    if (!thinkingTimer) thinkingTimer = window.setInterval(updateThinkingElapsed, 1000);
  }
  function renderThinking(progress) {
    const value = progress || defaultProgress(selected?.updated_at);
    const states = new Set(['complete', 'active', 'pending']);
    const steps = Array.isArray(value.steps) ? value.steps : defaultProgress(value.started_at).steps;
    const stepHtml = steps.map(step => {
      const state = states.has(step.status) ? step.status : 'pending';
      const marker = state === 'complete' ? '✓' : state === 'active' ? '<i aria-hidden="true"></i>' : '·';
      return '<li data-state="' + state + '"><span class="chat-thinking-marker">' + marker + '</span><span><strong>' +
        esc(step.label || '处理中') + '</strong><small>' + esc(step.detail || '') + '</small></span></li>';
    }).join('');
    return '<aside class="chat-thinking" role="status" data-thinking-started="' + esc(value.started_at || new Date().toISOString()) + '">' +
      '<div class="chat-thinking-head"><span class="chat-thinking-spinner" aria-hidden="true"></span><span><strong>' +
      esc(value.title || 'Agent 正在思考') + '</strong><small data-chat-elapsed>' + esc(elapsedText(value.started_at)) +
      '</small></span></div><ol>' + stepHtml + '</ol><p>显示可观测的处理阶段，不包含模型内部推理文本。</p></aside>';
  }
  function render() {
    byId('chat-title').textContent = selected?.title || 'Agent 对话';
    messages.innerHTML = selected?.messages?.length ? selected.messages.map(m =>
      `<article class="chat-message chat-message--${esc(m.role)}"><strong>${m.role === 'user' ? '你' : m.role === 'error' ? '提示' : esc(agentSelect.selectedOptions[0]?.textContent || 'Agent')}</strong><div>${esc(m.content)}</div><small>${esc(new Date(m.created_at).toLocaleString())}</small></article>`
    ).join('') : '<p class="chat-empty">选择 Agent，新建对话，开始一对一交流。历史会话会自动保存。</p>';
    if (selected?.busy) messages.insertAdjacentHTML('beforeend', renderThinking(selected.progress));
    syncThinkingClock(Boolean(selected?.busy));
    byId('chat-send').disabled = !selected || selected.busy || sending;
    input.disabled = !selected || selected.busy || sending;
    history.querySelectorAll('button').forEach(button => button.classList.toggle('is-selected', button.dataset.chatId === selected?.chat_id));
    agentList?.querySelectorAll('[data-chat-agent]').forEach(button => button.classList.toggle('is-selected', button.dataset.chatAgent === agentId));
    messages.scrollTop = messages.scrollHeight;
  }
  function renderAgentList() {
    if (!agentList) return;
    const query = agentQuery.trim().toLocaleLowerCase();
    const visible = query
      ? availableAgents.filter(agent => [agent.name, agent.profile_name, agent.role].some(value => String(value || "").toLocaleLowerCase().includes(query)))
      : availableAgents;
    agentList.innerHTML = visible.length
      ? visible.map((agent, index) => `<button type="button" data-chat-agent="${esc(agent.agent_id)}"><span class="swarm-member-avatar swarm-member-avatar--${index % 6}">${esc((agent.name || '?').slice(0, 1))}</span><span><b>${esc(agent.name)}</b><small>${esc(agent.role)} · @${esc(agent.profile_name)}</small></span><em>${(agent.runtime_status || 'stopped') === 'running' ? '运行中' : '空闲'}</em></button>`).join('')
      : '<p class="chat-agent-empty">没有匹配的 Agent</p>';
    agentList.querySelectorAll('[data-chat-agent]').forEach(button => button.classList.toggle('is-selected', button.dataset.chatAgent === agentId));
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
    availableAgents = agents;
    agentSelect.innerHTML = '<option value="">选择 Agent</option>' + agents.map(a =>
      `<option value="${esc(a.agent_id)}">${esc(a.name)} · ${esc(a.profile_name)}</option>`).join('');
    const next = id || agentId || agents[0]?.agent_id || '';
    agentSelect.value = next;
    if (next !== agentId) { ++generation; agentId = next; selected = null; input.value = ''; }
    renderAgentList();
    byId('chat-new').disabled = !agentId;
    render();
    try { await loadHistory(); } catch (error) { report(error); }
  };
  agentSelect.addEventListener('change', () => window.openAgentChat(agentSelect.value));
  agentSearch?.addEventListener('input', () => { agentQuery = agentSearch.value; renderAgentList(); });
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
    const startedAt = new Date().toISOString();
    selected.messages.push({role: 'user', content, created_at: startedAt});
    selected.busy = true; selected.updated_at = startedAt; selected.progress = defaultProgress(startedAt); render();
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
