(function () {
  const byId = id => document.getElementById(id);
  const filterAgent = byId('a2a-filter-agent');
  const fromAgent = byId('a2a-from-agent');
  const toAgent = byId('a2a-to-agent');
  const history = byId('a2a-history');
  const messages = byId('a2a-messages');
  const sender = byId('a2a-sender');
  const input = byId('a2a-input');
  const status = byId('a2a-status');
  let selected = null;
  let generation = 0;
  let sending = false;

  const esc = value => window.__HERMES_APP__.escapeHtml(String(value ?? ''));
  const agents = () => window.__BOOTSTRAP__?.agents || [];
  const agentName = id => agents().find(agent => agent.agent_id === id)?.name || id;
  const statusLabel = {
    queued: '等待接收方上线',
    delivered: '处理中',
    completed: '已完成',
    failed: '处理失败',
  };

  async function api(url, {method = 'GET', body} = {}) {
    const options = {method};
    if (body !== undefined) {
      options.headers = {'Content-Type': 'application/json'};
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'A2A 请求失败');
    return data;
  }

  function report(error) {
    status.textContent = error?.message || String(error || '');
  }

  function agentOptions(includeEmpty = false) {
    return (includeEmpty ? '<option value="">全部 Agent</option>' : '') + agents().map(agent =>
      `<option value="${esc(agent.agent_id)}">${esc(agent.name)} · ${esc(agent.profile_name)}</option>`
    ).join('');
  }

  function populateAgents(preferred = '') {
    const previousFilter = preferred || filterAgent.value;
    const previousFrom = fromAgent.value;
    const previousTo = toAgent.value;
    filterAgent.innerHTML = agentOptions(true);
    fromAgent.innerHTML = agentOptions();
    toAgent.innerHTML = agentOptions();
    if (previousFilter && agents().some(agent => agent.agent_id === previousFilter)) {
      filterAgent.value = previousFilter;
    }
    fromAgent.value = agents().some(agent => agent.agent_id === previousFrom)
      ? previousFrom
      : (preferred || agents()[0]?.agent_id || '');
    const nextTo = agents().find(agent =>
      agent.agent_id !== fromAgent.value && agent.agent_id === previousTo
    ) || agents().find(agent => agent.agent_id !== fromAgent.value);
    toAgent.value = nextTo?.agent_id || '';
    byId('a2a-new').disabled = !fromAgent.value || !toAgent.value || fromAgent.value === toAgent.value;
  }

  function render() {
    const participantIds = selected?.participant_ids || [];
    byId('a2a-title').textContent = selected?.title || 'A2A 对话';
    byId('a2a-participants').textContent = participantIds.length
      ? participantIds.map(agentName).join(' ↔ ')
      : '选择或新建两个 Agent 之间的会话';
    byId('a2a-conversation-status').textContent = selected ? '持续会话' : '未选择';

    const currentSender = sender.value;
    sender.innerHTML = participantIds.map(id =>
      `<option value="${esc(id)}">${esc(agentName(id))}</option>`
    ).join('');
    if (participantIds.includes(currentSender)) sender.value = currentSender;
    sender.disabled = !selected;
    input.disabled = !selected || sending;
    byId('a2a-send').disabled = !selected || sending;

    const rows = selected?.messages || [];
    messages.innerHTML = rows.length ? rows.map(message => {
      const outgoing = message.sender_agent_id === sender.value;
      const retry = message.status === 'failed' && !message.reply_to_message_id
        ? `<button type="button" data-a2a-retry="${esc(message.message_id)}">重试</button>`
        : '';
      return `
        <article class="chat-message a2a-message ${outgoing ? 'chat-message--user' : ''}">
          <div class="a2a-message-head">
            <strong>${esc(message.sender_name)} → ${esc(message.recipient_name)}</strong>
            <span data-status="${esc(message.status)}">${esc(statusLabel[message.status] || message.status)}</span>
          </div>
          <div>${esc(message.content)}</div>
          <small>${esc(new Date(message.created_at).toLocaleString())} ${retry}</small>
          ${message.error ? `<p class="a2a-message-error">${esc(message.error)}</p>` : ''}
        </article>`;
    }).join('') : '<p class="chat-empty">会话已经建立。选择一个 Agent 作为发言方，发送第一条消息。</p>';
    history.querySelectorAll('button').forEach(button => {
      button.classList.toggle('is-selected', button.dataset.conversationId === selected?.conversation_id);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  async function loadHistory() {
    const token = generation;
    const query = filterAgent.value ? `?agent_id=${encodeURIComponent(filterAgent.value)}` : '';
    const data = await api(`/api/a2a/conversations${query}`);
    if (token !== generation) return;
    history.innerHTML = data.conversations.length ? data.conversations.map(conversation => {
      const names = conversation.participants.map(item => item.name).join(' ↔ ');
      return `
        <button type="button" data-conversation-id="${esc(conversation.conversation_id)}">
          <span>${esc(conversation.title)}</span>
          <small>${esc(names)} · ${esc(new Date(conversation.updated_at).toLocaleString())}</small>
        </button>`;
    }).join('') : '<p class="chat-empty">暂无 A2A 会话</p>';
    render();
  }

  async function selectConversation(conversationId) {
    const token = ++generation;
    status.textContent = '';
    const data = await api(`/api/a2a/conversations/${encodeURIComponent(conversationId)}`);
    if (token !== generation) return;
    selected = data.conversation;
    if (!selected.participant_ids.includes(sender.value)) {
      sender.value = selected.participant_ids[0] || '';
    }
    input.value = '';
    render();
  }

  window.openA2AChat = async function (agentId = '') {
    window.switchView('a2a');
    populateAgents(agentId);
    if (agentId) filterAgent.value = agentId;
    status.textContent = '';
    try {
      await loadHistory();
    } catch (error) {
      report(error);
    }
  };

  filterAgent.addEventListener('change', () => {
    generation += 1;
    selected = null;
    render();
    loadHistory().catch(report);
  });

  fromAgent.addEventListener('change', () => populateAgents());
  toAgent.addEventListener('change', () => {
    byId('a2a-new').disabled = !fromAgent.value || !toAgent.value || fromAgent.value === toAgent.value;
  });

  byId('a2a-new').addEventListener('click', async () => {
    if (!fromAgent.value || !toAgent.value || fromAgent.value === toAgent.value) return;
    const token = ++generation;
    status.textContent = '';
    byId('a2a-new').disabled = true;
    try {
      const data = await api('/api/a2a/conversations', {
        method: 'POST',
        body: {
          participant_a_id: fromAgent.value,
          participant_b_id: toAgent.value,
        },
      });
      if (token !== generation) return;
      selected = data.conversation;
      render();
      sender.value = fromAgent.value;
      render();
      await loadHistory();
      input.focus();
    } catch (error) {
      report(error);
    } finally {
      byId('a2a-new').disabled = !fromAgent.value || !toAgent.value || fromAgent.value === toAgent.value;
    }
  });

  history.addEventListener('click', event => {
    const button = event.target.closest('[data-conversation-id]');
    if (button) selectConversation(button.dataset.conversationId).catch(report);
  });

  sender.addEventListener('change', render);

  byId('a2a-form').addEventListener('submit', async event => {
    event.preventDefault();
    const content = input.value.trim();
    if (!selected || !sender.value || !content || sending) return;
    const token = generation;
    const conversationId = selected.conversation_id;
    sending = true;
    status.textContent = '';
    render();
    try {
      const data = await api(
        `/api/a2a/conversations/${encodeURIComponent(conversationId)}/messages`,
        {method: 'POST', body: {sender_agent_id: sender.value, content}},
      );
      if (token === generation) {
        selected = data.conversation;
        input.value = '';
        render();
        await loadHistory();
      }
    } catch (error) {
      if (token === generation) report(error);
    } finally {
      sending = false;
      render();
    }
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      byId('a2a-form').requestSubmit();
    }
  });

  messages.addEventListener('click', async event => {
    const button = event.target.closest('[data-a2a-retry]');
    if (!button || sending) return;
    sending = true;
    status.textContent = '';
    render();
    try {
      const data = await api(
        `/api/a2a/messages/${encodeURIComponent(button.dataset.a2aRetry)}/retry`,
        {method: 'POST'},
      );
      selected = data.conversation;
    } catch (error) {
      report(error);
    } finally {
      sending = false;
      render();
    }
  });

  setInterval(async () => {
    if (!selected || byId('view-a2a').classList.contains('hidden')) return;
    const token = generation;
    try {
      const data = await api(
        `/api/a2a/conversations/${encodeURIComponent(selected.conversation_id)}`,
      );
      if (token === generation) {
        const previous = JSON.stringify(selected.messages);
        selected = data.conversation;
        if (previous !== JSON.stringify(selected.messages)) {
          render();
          await loadHistory();
        }
      }
    } catch (error) {
      if (token === generation) report(error);
    }
  }, 3000);
})();
