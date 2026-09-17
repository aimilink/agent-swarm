(function () {
  const drawer = document.getElementById('workspace-terminal-drawer');
  const viewport = document.getElementById('workspace-terminal-viewport');
  const title = document.getElementById('workspace-terminal-title');
  const pathLabel = document.getElementById('workspace-terminal-path');
  if (!drawer || !viewport) return;

  let terminal = null;
  let fitAddon = null;
  let socket = null;
  let projectId = '';
  let reconnectTimer = 0;
  let openCycle = 0;

  function ensureTerminal() {
    if (terminal || !window.Terminal || !window.FitAddon) return terminal;
    terminal = new Terminal({
      cursorBlink: true,
      convertEol: false,
      scrollback: 10000,
      fontSize: 13,
      fontFamily: 'Consolas, "SFMono-Regular", monospace',
      theme: {background:'#020617',foreground:'#e2e8f0',cursor:'#60a5fa',selectionBackground:'#1e40af'},
    });
    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(viewport);
    terminal.onData(data => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:'input', data}));
    });
    return terminal;
  }

  function fit() {
    if (!terminal || !fitAddon || drawer.hidden) return;
    try {
      fitAddon.fit();
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({type:'resize', rows:terminal.rows, cols:terminal.cols}));
      }
    } catch (_) {}
  }

  function socketUrl(id) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/api/projects/${encodeURIComponent(id)}/terminal/ws`;
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
    const active = socket;
    socket = null;
    if (active && active.readyState < WebSocket.CLOSING) active.close();
  }

  function connect() {
    if (!projectId || drawer.hidden) return;
    disconnect();
    const term = ensureTerminal();
    if (!term) return;
    term.reset();
    term.write('\x1b[90m正在连接项目 Linux 终端…\x1b[0m\r\n');
    const requestedProject = projectId;
    const ws = new WebSocket(socketUrl(requestedProject));
    socket = ws;
    ws.addEventListener('open', () => requestAnimationFrame(fit));
    ws.addEventListener('message', event => {
      if (socket !== ws) return;
      let payload;
      try { payload = JSON.parse(event.data); } catch (_) { return; }
      if (payload.type === 'ready') {
        pathLabel.textContent = payload.cwd || 'Linux Shell';
        requestAnimationFrame(() => { fit(); terminal.focus(); });
      } else if (payload.type === 'output') {
        terminal.write(String(payload.data || ''));
      } else if (payload.type === 'status') {
        terminal.write(`\r\n\x1b[33m${String(payload.message || '终端已关闭')}\x1b[0m\r\n`);
      }
    });
    ws.addEventListener('close', event => {
      if (socket !== ws) return;
      socket = null;
      if (event.code === 4401) terminal.write('\r\n\x1b[31m登录已失效，请重新登录。\x1b[0m\r\n');
      else if (!drawer.hidden && requestedProject === projectId) reconnectTimer = setTimeout(connect, 1200);
    });
    ws.addEventListener('error', () => {
      if (socket === ws) terminal.write('\r\n\x1b[31m终端连接失败。\x1b[0m\r\n');
    });
  }

  function open(options) {
    projectId = String(options?.projectId || '');
    if (!projectId) return false;
    title.textContent = `${options?.projectName || projectId} · Linux Terminal`;
    pathLabel.textContent = options?.workspacePath || 'Linux Shell';
    const cycle = ++openCycle;
    drawer.hidden = false;
    drawer.classList.remove('is-closing');
    requestAnimationFrame(() => {
      if (cycle !== openCycle) return;
      drawer.classList.add('is-open');
      ensureTerminal();
      requestAnimationFrame(() => {
        if (cycle !== openCycle) return;
        fit();
        connect();
      });
    });
    return true;
  }

  function close() {
    if (drawer.hidden) return;
    openCycle += 1;
    drawer.classList.remove('is-open');
    drawer.classList.add('is-closing');
    disconnect();
    setTimeout(() => {
      if (!drawer.classList.contains('is-open')) {
        drawer.hidden = true;
        drawer.classList.remove('is-closing');
      }
    }, 220);
  }

  drawer.addEventListener('click', event => {
    if (event.target.closest('[data-close-workspace-terminal]')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !drawer.hidden) close();
  });
  new ResizeObserver(() => requestAnimationFrame(fit)).observe(viewport);
  window.__WORKSPACE_TERMINAL__ = {open, close};
})();
