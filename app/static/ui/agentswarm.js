/* Shared AgentSwarm navigation and interactions. */
(() => {
  const pages = {
    projects: ['项目管理', '以项目组织团队、迭代任务与交付产物'],
    workspace: ['工作空间', '项目文件、任务产物与实时在线预览'],
    overview: ['团队概览', '多 Agent 协作系统运行总览'],
    board: ['任务看板', '跟踪任务进度、处理阻塞与查看执行过程'],
    chat: ['Agent 对话', '与 Agent 交流，持续保存会话上下文'],
    a2a: ['A2A 对话', 'Agent 之间的持续讨论与消息投递'],
    members: ['成员列表', '管理 Agent 身份、运行状态与配置'],
    stats: ['效能统计', '查看团队用量与任务执行表现'],
    teams: ['团队管理', '组织团队、分配成员与协作角色'],
    settings: ['设置', '模型配置、协作策略与数据管理'],
  };
  let restoring = false;
  function syncPage(name) {
    if (!pages[name]) return;
    const [title, subtitle] = pages[name];
    document.getElementById('swarm-page-title').textContent = title;
    document.getElementById('swarm-page-subtitle').textContent = subtitle;
    document.title = `AgentSwarm · ${title}`;
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      if (link.dataset.view === name) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-project-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.projectMode === name));
    });
    if (!restoring && location.hash !== `#${name}`) history.pushState(null, '', `#${name}`);
  }
  window.navigateSwarm = name => {
    if (!pages[name]) name = 'overview';
    if (name === 'projects' || name === 'workspace') void window.openProjects(name);
    else if (name === 'chat') void window.openAgentChat();
    else if (name === 'a2a') void window.openA2AChat();
    else window.switchView(name);
  };
  document.addEventListener('swarm:view', event => syncPage(event.detail));
  function restorePage() {
    restoring = true;
    const name = location.hash.slice(1);
    window.navigateSwarm(pages[name] ? name : 'overview');
    restoring = false;
  }
  window.addEventListener('popstate', restorePage);
  window.addEventListener('hashchange', () => {
    if (location.hash.slice(1) !== document.body.dataset.view) restorePage();
  });
  document.querySelectorAll('[data-project-mode]').forEach(button => {
    button.addEventListener('click', () => window.navigateSwarm(button.dataset.projectMode));
  });
  document.querySelectorAll('[data-quick-view]').forEach(button => {
    button.addEventListener('click', () => window.navigateSwarm(button.dataset.quickView));
  });
  document.getElementById('board-refresh-visible')?.addEventListener('click', () => document.getElementById('kanban-refresh')?.click());
  document.addEventListener('click', event => {
    if (event.target.closest('#teams-export-visible')) document.getElementById('settings-export-team')?.click();
    if (event.target.closest('#teams-import-visible')) document.getElementById('settings-import-team')?.click();
  });
  const help = document.getElementById('swarm-help');
  document.getElementById('swarm-open-help').addEventListener('click', () => help.showModal());
  help.addEventListener('click', event => {
    if (event.target !== help) return;
    const box = help.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) help.close();
  });
  const activity = document.getElementById('overview-activity-feed');
  const button = document.getElementById('swarm-show-activity');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    activity.classList.toggle('swarm-activity-expanded', expanded);
    button.textContent = expanded ? '收起动态' : '展开动态';
  });
  restorePage();
})();
