(function () {
  const $ = id => document.getElementById(id);
  const esc = value => window.__HERMES_APP__.escapeHtml(String(value ?? ""));
  const storageKey = "hermesCurrentProject";
  let current = "";
  let revision = 0;

  try {
    current = window.localStorage.getItem(storageKey) || "";
  } catch (_) {
    current = "";
  }

  async function api(url, body) {
    const response = await fetch(url, body === undefined ? {} : {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "请求失败");
    return data;
  }

  function report(error) {
    $("project-error").textContent = error.message || String(error);
  }

  function rememberProject(id) {
    current = id;
    try {
      window.localStorage.setItem(storageKey, id);
    } catch (_) {
      // The selected project still remains active for this page session.
    }
  }

  function projectUrl() {
    return `/api/projects/${encodeURIComponent(current)}`;
  }

  function renderOverview(items) {
    const target = $("overview-projects");
    if (!target) return;
    target.innerHTML = items.length
      ? items.slice(0, 4).map(project => `
          <button type="button" data-overview-project="${esc(project.project_id)}">
            <span>${esc(project.name)}</span>
            <small title="${esc(project.workspace_path)}">${esc(project.workspace_path)}</small>
          </button>`).join("")
      : '<p class="font-label-md text-on-surface-variant">暂无项目。点击“查看全部”创建项目工作区。</p>';
  }

  async function refreshList() {
    const data = await api("/api/projects");
    $("project-list").innerHTML = data.projects.length
      ? data.projects.map(project => `
          <button type="button" data-project="${esc(project.project_id)}" aria-pressed="${project.project_id === current}">
            <span>${esc(project.name)}</span>
            <small title="${esc(project.workspace_path)}">${esc(project.workspace_path)}</small>
          </button>`).join("")
      : "<p>暂无项目，请先创建。</p>";
    renderOverview(data.projects);
    return data.projects;
  }

  async function selectProject(id) {
    const token = ++revision;
    rememberProject(id);
    $("project-error").textContent = "";
    $("project-detail").hidden = true;
    const data = await api(projectUrl());
    if (token !== revision) return;

    const project = data.project;
    $("project-detail").hidden = false;
    $("project-title").textContent = project.name;
    $("project-iteration").textContent = data.current_iteration
      ? `已迭代 ${data.current_iteration} 次`
      : "尚未开始迭代";
    $("project-next-iteration").textContent =
      `即将创建第 ${data.next_iteration} 次迭代任务。任务会继续使用同一项目工作目录。`;
    $("project-description").textContent = project.description || "尚未填写目标";
    $("project-workspace").textContent = project.workspace_path;
    $("project-tasks").innerHTML = data.tasks.length
      ? data.tasks.map(task => {
          const iteration = task.metadata?.project_iteration;
          const prefix = iteration ? `迭代 ${iteration} · ` : "";
          return `<button type="button" data-project-task="${esc(task.kanban_task_id)}">
            <span>${esc(prefix + (task.metadata?.task_title || task.kanban_task_id))}</span>
            <small>${esc(task.assignee_profile || "未分配")} · ${esc(task.kanban_status)}</small>
          </button>`;
        }).join("")
      : "<p>暂无任务。新建迭代任务后，所有子任务会继承项目目录。</p>";
    $("artifact-task").innerHTML = '<option value="">选择关联任务</option>' +
      data.tasks.map(task => `<option value="${esc(task.kanban_task_id)}">${esc(task.metadata?.task_title || task.kanban_task_id)}</option>`).join("");
    $("project-artifacts").innerHTML = data.artifacts.length
      ? data.artifacts.map(artifact => `<article>
          <strong>${esc(artifact.title)}</strong>
          <span>${artifact.exists ? "已登记 · 待人工验收" : "文件已缺失"}</span>
          <p>${esc(artifact.path)}</p><p>${esc(artifact.summary)}</p>
          <p>验证：${esc(artifact.validation || "未提供")}</p>
          <small>任务 ${esc(artifact.task_id)} · ${esc(artifact.agent_id || "手动登记")}</small>
          ${artifact.exists ? `<button type="button" data-project-file="${esc(artifact.path)}">下载</button>` : ""}
        </article>`).join("")
      : "<p>暂无产物。Agent 可通过 MCP 自动登记，也可在下方手动登记。</p>";

    const files = await api(projectUrl() + "/files");
    if (token !== revision) return;
    $("project-files").innerHTML = files.files.map(file =>
      `<button type="button" data-project-file="${esc(file)}">${esc(file)}</button>`
    ).join("") + (files.truncated ? "<p>仅显示前 500 个文件。</p>" : "");
    await refreshList();
  }

  window.openProjects = async function () {
    window.switchView("projects");
    const agents = window.__BOOTSTRAP__.agents || [];
    $("project-agent").innerHTML = '<option value="">选择任务接收 Agent</option>' +
      agents.map(agent => `<option value="${esc(agent.agent_id)}">${esc(agent.name)} · ${esc(agent.role)}</option>`).join("");
    try {
      const items = await refreshList();
      const selected = items.find(item => item.project_id === current) || items[0];
      if (selected) await selectProject(selected.project_id);
      else $("project-detail").hidden = true;
    } catch (error) {
      report(error);
    }
  };

  $("project-list").addEventListener("click", event => {
    const button = event.target.closest("[data-project]");
    if (button) selectProject(button.dataset.project).catch(report);
  });
  $("overview-projects")?.addEventListener("click", event => {
    const button = event.target.closest("[data-overview-project]");
    if (!button) return;
    rememberProject(button.dataset.overviewProject);
    window.openProjects();
  });
  $("project-refresh").addEventListener("click", () => window.openProjects());

  async function submit(form, work) {
    const button = form.querySelector("[type=submit]");
    if (button.disabled) return;
    button.disabled = true;
    $("project-error").textContent = "";
    try {
      await work(new FormData(form));
    } catch (error) {
      report(error);
    } finally {
      button.disabled = false;
    }
  }

  $("project-create").addEventListener("submit", event => {
    event.preventDefault();
    submit(event.currentTarget, async values => {
      const data = await api("/api/projects", Object.fromEntries(values));
      event.target.reset();
      await selectProject(data.project.project_id);
    });
  });
  $("project-task-form").addEventListener("submit", event => {
    event.preventDefault();
    const id = current;
    submit(event.currentTarget, async values => {
      await api(`/api/projects/${encodeURIComponent(id)}/tasks`, Object.fromEntries(values));
      if (id === current) {
        event.target.reset();
        await selectProject(id);
      }
    });
  });
  $("project-artifact-form").addEventListener("submit", event => {
    event.preventDefault();
    const id = current;
    submit(event.currentTarget, async values => {
      await api(`/api/projects/${encodeURIComponent(id)}/artifacts`, Object.fromEntries(values));
      if (id === current) {
        event.target.reset();
        await selectProject(id);
      }
    });
  });
  $("project-detail").addEventListener("click", async event => {
    const task = event.target.closest("[data-project-task]");
    if (task) {
      window.__HERMES_APP__.openKanbanTask(task.dataset.projectTask);
      return;
    }
    const button = event.target.closest("[data-project-file]");
    if (!button) return;
    try {
      const response = await fetch(projectUrl() + "/file?path=" + encodeURIComponent(button.dataset.projectFile));
      if (!response.ok) throw new Error("文件读取失败");
      const blob = await response.blob();
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = button.dataset.projectFile.split("/").pop();
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      report(error);
    }
  });

  refreshList().catch(() => {});
})();
