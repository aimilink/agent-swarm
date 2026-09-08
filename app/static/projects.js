(function () {
  const $ = id => document.getElementById(id);
  const esc = value => window.__HERMES_APP__.escapeHtml(String(value ?? ''));
  let current = '', revision = 0;
  async function api(url, body) {
    const response = await fetch(url, body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || '请求失败');
    return data;
  }
  function error(err) { $('project-error').textContent = err.message; }
  const url = () => `/api/projects/${encodeURIComponent(current)}`;
  async function refreshList() {
    const data = await api('/api/projects');
    $('project-list').innerHTML = data.projects.map(p => `<button type="button" data-project="${esc(p.project_id)}" aria-pressed="${p.project_id===current}">${esc(p.name)}</button>`).join('') || '<p>暂无项目，请先创建。</p>';
  }
  async function select(id) {
    const token = ++revision;
    current = id; $('project-error').textContent = '';
    $('project-detail').hidden = true;
    const data = await api(url());
    if (token !== revision) return;
    const p = data.project;
    $('project-detail').hidden = false;
    $('project-title').textContent = p.name;
    $('project-description').textContent = p.description || '尚未填写目标';
    $('project-workspace').textContent = p.workspace_path;
    $('project-tasks').innerHTML = data.tasks.length ? data.tasks.map(t=>`<button type="button" data-project-task="${esc(t.kanban_task_id)}"><span>${esc(t.metadata?.task_title || t.kanban_task_id)}</span><small>${esc(t.assignee_profile || '未分配')} · ${esc(t.kanban_status)}</small></button>`).join('') : '<p>暂无任务。从下面创建，所有子任务会继承项目目录。</p>';
    $('artifact-task').innerHTML = '<option value="">选择关联任务</option>' + data.tasks.map(t=>`<option value="${esc(t.kanban_task_id)}">${esc(t.metadata?.task_title || t.kanban_task_id)}</option>`).join('');
    $('project-artifacts').innerHTML = data.artifacts.length ? data.artifacts.map(a=>`<article><strong>${esc(a.title)}</strong> <span>${a.exists ? '已登记 · 待人工验收' : '文件已缺失'}</span><p>${esc(a.path)}</p><p>${esc(a.summary)}</p><p>验证：${esc(a.validation || '未提供')}</p><small>任务 ${esc(a.task_id)} · ${esc(a.agent_id || '手动登记')}</small>${a.exists ? `<button type="button" data-project-file="${esc(a.path)}">下载</button>` : ''}</article>`).join('') : '<p>暂无产物。Agent 可通过 MCP 自动登记，也可在下方手动登记。</p>';
    const files = await api(url() + '/files');
    if (token !== revision) return;
    $('project-files').innerHTML = files.files.map(f=>`<button type="button" data-project-file="${esc(f)}">${esc(f)}</button>`).join('') + (files.truncated ? '<p>仅显示前 500 个文件。</p>' : '');
    await refreshList();
  }
  window.openProjects = async () => {
    window.switchView('projects');
    const agents = window.__BOOTSTRAP__.agents || [];
    $('project-agent').innerHTML = '<option value="">选择任务接收 Agent</option>' + agents.map(a=>`<option value="${esc(a.agent_id)}">${esc(a.name)} · ${esc(a.role)}</option>`).join('');
    try { await refreshList(); if(current) await select(current); } catch(err) {error(err);}
  };
  $('project-list').addEventListener('click', e=>{const b=e.target.closest('[data-project]');if(b) select(b.dataset.project).catch(error);});
  $('project-refresh').addEventListener('click', ()=>window.openProjects());
  async function submit(form, work) {
    const button = form.querySelector('[type=submit]');
    if(button.disabled) return;
    button.disabled = true; $('project-error').textContent='';
    try {await work(new FormData(form));} catch(err){error(err);} finally {button.disabled=false;}
  }
  $('project-create').addEventListener('submit', e=>{e.preventDefault();submit(e.currentTarget, async values=>{
    const data=await api('/api/projects',Object.fromEntries(values));
    e.target.reset(); await select(data.project.project_id);
  });});
  $('project-task-form').addEventListener('submit', e=>{e.preventDefault();const id=current;submit(e.currentTarget,async values=>{
    await api(`/api/projects/${encodeURIComponent(id)}/tasks`,Object.fromEntries(values));
    if(id===current){e.target.reset();await select(id);}
  });});
  $('project-artifact-form').addEventListener('submit', e=>{e.preventDefault();const id=current;submit(e.currentTarget,async values=>{
    await api(`/api/projects/${encodeURIComponent(id)}/artifacts`,Object.fromEntries(values));
    if(id===current){e.target.reset();await select(id);}
  });});
  $('project-detail').addEventListener('click',async e=>{
    const task=e.target.closest('[data-project-task]');
    if(task) { window.__HERMES_APP__.openKanbanTask(task.dataset.projectTask);return; }
    const button=e.target.closest('[data-project-file]');
    if(!button) return;
    try {
      const response=await fetch(url()+'/file?path='+encodeURIComponent(button.dataset.projectFile));
      if(!response.ok) throw new Error('文件读取失败');
      const blob=await response.blob(), link=document.createElement('a'), objectUrl=URL.createObjectURL(blob);
      link.href=objectUrl;link.download=button.dataset.projectFile.split('/').pop();link.click();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
    } catch(err){error(err);}
  });
})();
