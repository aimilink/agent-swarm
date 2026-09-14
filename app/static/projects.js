(function () {
  const $ = id => document.getElementById(id);
  const esc = value => window.__HERMES_APP__.escapeHtml(String(value ?? ""));
  const storageKey = "hermesCurrentProject";
  const refreshInterval = 3000;
  let current = "";
  let revision = 0;
  let currentDetail = null;
  let workspaceScope = "project";
  let workspaceTask = "";
  let selectedFile = "";
  let selectedSignature = "";
  let previewObjectUrl = "";
  let workspaceTimer = 0;
  let workspaceFiles = [];
  let workspaceFilter = "";
  let workspaceTreeSignature = "";
  const collapsedDirectories = new Set();

  try {
    current = window.localStorage.getItem(storageKey) || "";
  } catch (_) {
    current = "";
  }

  async function api(url, body, method = "POST") {
    const response = await fetch(url, body === undefined ? {} : {
      method,
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
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

  function teams() {
    return window.__BOOTSTRAP__.teams || [];
  }

  function agents() {
    return window.__BOOTSTRAP__.agents || [];
  }

  function teamName(teamId) {
    const team = teams().find(item => item.team_id === teamId);
    return team?.name || team?.slug || teamId;
  }

  function taskTitle(task) {
    const iteration = task?.metadata?.project_iteration;
    const title = task?.metadata?.task_title || task?.kanban_task_id || "任务";
    return iteration ? `迭代 ${iteration} · ${title}` : title;
  }

  function teamBadges(project, emptyLabel = "未关联团队") {
    const values = project.teams?.length
      ? project.teams.map(team => team.name || team.slug || team.team_id)
      : (project.team_ids || []).map(teamName);
    return values.length
      ? values.map(name => `<span class="project-team-badge">${esc(name)}</span>`).join("")
      : `<span class="project-team-badge project-team-badge--empty">${esc(emptyLabel)}</span>`;
  }

  function renderTeamOptions(targetId, selected = []) {
    const target = $(targetId);
    if (!target) return;
    const selectedIds = new Set(selected || []);
    target.innerHTML = teams().length
      ? teams().map(team => `<label class="project-team-option">
          <input type="checkbox" name="team_ids" value="${esc(team.team_id)}" ${selectedIds.has(team.team_id) ? "checked" : ""}>
          <span><strong>${esc(team.name)}</strong><small>${esc(team.slug)} · ${team.member_count ?? 0} 人</small></span>
        </label>`).join("")
      : "<p>尚未创建团队，可先创建项目，之后再关联。</p>";
  }

  function renderProjectAgents(project) {
    const teamIds = project.team_ids || [];
    const allowed = agents().filter(agent => !teamIds.length || teamIds.includes(agent.team_id));
    $("project-agent").innerHTML = '<option value="">选择任务接收 Agent</option>' +
      allowed.map(agent => `<option value="${esc(agent.agent_id)}">${esc(teamName(agent.team_id) || "未分组")} · ${esc(agent.name)} · ${esc(agent.role)}</option>`).join("");
    $("project-agent").disabled = allowed.length === 0;
  }

  function renderTeamPortfolio(items) {
    const target = $("project-team-portfolio");
    if (!target) return;
    target.innerHTML = teams().length
      ? teams().map(team => {
          const projects = items.filter(project => (project.team_ids || []).includes(team.team_id));
          return `<div class="project-portfolio-team">
            <div><strong>${esc(team.name)}</strong><small>${projects.length} 个项目</small></div>
            ${projects.length
              ? projects.map(project => `<button type="button" data-project="${esc(project.project_id)}">${esc(project.name)}</button>`).join("")
              : "<p>暂未参与项目</p>"}
          </div>`;
        }).join("")
      : "<p>尚未创建团队。</p>";
  }

  function renderOverview(items) {
    const target = $("overview-projects");
    if (!target) return;
    target.innerHTML = items.length
      ? items.slice(0, 4).map(project => `
          <button type="button" data-overview-project="${esc(project.project_id)}">
            <span><strong>${esc(project.name)}</strong><span class="project-team-badges">${teamBadges(project)}</span></span>
            <small title="${esc(project.workspace_path)}">${esc(project.workspace_path)}</small>
          </button>`).join("")
      : '<p class="font-label-md text-on-surface-variant">暂无项目。点击“查看全部”创建项目工作区。</p>';
  }

  async function refreshList() {
    const data = await api("/api/projects");
    $("project-list").innerHTML = data.projects.length
      ? data.projects.map(project => `
          <button type="button" data-project="${esc(project.project_id)}" aria-pressed="${project.project_id === current}">
            <span class="project-list-title">${esc(project.name)}</span>
            <span class="project-team-badges">${teamBadges(project)}</span>
            <small title="${esc(project.workspace_path)}">${esc(project.workspace_path)}</small>
          </button>`).join("")
      : "<p>暂无项目，请先创建。</p>";
    renderOverview(data.projects);
    renderTeamPortfolio(data.projects);
    renderTeamOptions("project-create-teams");
    return data.projects;
  }

  function renderTasks(tasks) {
    $("project-tasks").innerHTML = tasks.length
      ? tasks.map(task => {
          const agent = agents().find(item => item.profile_name === task.assignee_profile || item.agent_id === task.metadata?.assignee_agent_id);
          const owner = agent?.team_id ? `${teamName(agent.team_id)} · ${task.assignee_profile}` : (task.assignee_profile || "未分配");
          return `<article class="project-task-card" data-project-task="${esc(task.kanban_task_id)}">
            <div><strong>${esc(taskTitle(task))}</strong><small>${esc(owner)} · ${esc(task.kanban_status)}</small></div>
            <div class="project-task-actions"><button type="button" data-project-task-workspace="${esc(task.kanban_task_id)}">任务工作空间</button><button type="button" data-project-task-process="${esc(task.kanban_task_id)}">处理过程</button></div>
          </article>`;
        }).join("")
      : "<p>暂无任务。新建迭代任务后，所有子任务会继承项目目录。</p>";
  }

  function renderArtifacts(artifacts) {
    $("project-artifacts").innerHTML = artifacts.length
      ? artifacts.map(artifact => `<article>
          <strong>${esc(artifact.title)}</strong>
          <span>${artifact.exists ? "已登记 · 待人工验收" : "文件已缺失"}</span>
          <p>${esc(artifact.path)}</p><p>${esc(artifact.summary)}</p>
          <p>验证：${esc(artifact.validation || "未提供")}</p>
          <small>任务 ${esc(artifact.task_id)} · ${esc(artifact.agent_id || "手动登记")}</small>
          ${artifact.exists ? `<div class="project-artifact-actions"><button type="button" data-workspace-open="${esc(artifact.path)}">在线查看</button><button type="button" data-workspace-download="${esc(artifact.path)}">下载</button></div>` : ""}
        </article>`).join("")
      : "<p>暂无产物。Agent 可通过 MCP 自动登记，也可在下方手动登记。</p>";
  }

  function configureWorkspaceTasks(tasks) {
    const select = $("project-workspace-task");
    const previous = workspaceTask;
    select.innerHTML = tasks.map(task => `<option value="${esc(task.kanban_task_id)}">${esc(taskTitle(task))}</option>`).join("");
    workspaceTask = tasks.some(task => task.kanban_task_id === previous)
      ? previous
      : (tasks[0]?.kanban_task_id || "");
    select.value = workspaceTask;
  }

  function renderDetail(data) {
    currentDetail = data;
    const project = data.project;
    $("project-detail").hidden = false;
    $("project-title").textContent = project.name;
    $("project-team-badges").innerHTML = teamBadges(project);
    renderTeamOptions("project-edit-teams", project.team_ids);
    renderProjectAgents(project);
    $("project-iteration").textContent = data.current_iteration ? `已迭代 ${data.current_iteration} 次` : "尚未开始迭代";
    $("project-next-iteration").textContent = `即将创建第 ${data.next_iteration} 次迭代任务。任务会继续使用同一项目工作目录。`;
    $("project-description").textContent = project.description || "尚未填写目标";
    $("project-workspace").textContent = project.workspace_path;
    renderTasks(data.tasks);
    configureWorkspaceTasks(data.tasks);
    $("artifact-task").innerHTML = '<option value="">选择关联任务</option>' +
      data.tasks.map(task => `<option value="${esc(task.kanban_task_id)}">${esc(taskTitle(task))}</option>`).join("");
    renderArtifacts(data.artifacts);
    updateTerminalTarget();
  }

  function fileSize(value) {
    const size = Number(value || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function fileSignature(file) {
    return `${file.path}:${file.size}:${file.modified_ns}`;
  }

  function releasePreviewUrl() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
  }

  function emptyPreview(message = "选择文件在线查看内容。") {
    releasePreviewUrl();
    selectedFile = "";
    selectedSignature = "";
    $("project-preview-title").textContent = "选择文件在线查看";
    $("project-preview-meta").textContent = "支持文本、代码、图片和 PDF";
    $("project-preview-download").hidden = true;
    $("project-preview-content").innerHTML = `<p>${esc(message)}</p>`;
  }

  async function openPreview(file, force = false) {
    if (!file || !current) return;
    const signature = fileSignature(file);
    if (!force && selectedFile === file.path && selectedSignature === signature) return;
    selectedFile = file.path;
    selectedSignature = signature;
    document.querySelectorAll("#project-files [data-workspace-open]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.workspaceOpen === file.path));
    });
    $("project-preview-title").textContent = file.path;
    $("project-preview-meta").textContent = `${fileSize(file.size)} · ${file.mime_type || "未知类型"}`;
    $("project-preview-download").hidden = false;
    $("project-preview-content").innerHTML = "<p>正在加载预览…</p>";
    releasePreviewUrl();
    if (file.preview_type === "download") {
      $("project-preview-content").innerHTML = "<p>该文件不支持在线预览，可下载后查看。</p>";
      return;
    }
    const projectId = current;
    try {
      const response = await fetch(projectUrl() + "/preview?path=" + encodeURIComponent(file.path));
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "文件预览失败");
      }
      if (projectId !== current || selectedFile !== file.path) return;
      if (file.preview_type === "text") {
        const data = await response.json();
        if (projectId !== current || selectedFile !== file.path || selectedSignature !== signature) return;
        const pre = document.createElement("pre");
        pre.textContent = data.content || "";
        $("project-preview-content").replaceChildren(pre);
      } else {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (projectId !== current || selectedFile !== file.path || selectedSignature !== signature) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        previewObjectUrl = objectUrl;
        if (file.preview_type === "image") {
          const image = document.createElement("img");
          image.alt = file.name || file.path;
          image.src = previewObjectUrl;
          $("project-preview-content").replaceChildren(image);
        } else {
          const frame = document.createElement("iframe");
          frame.title = file.name || file.path;
          frame.src = previewObjectUrl;
          $("project-preview-content").replaceChildren(frame);
        }
      }
    } catch (error) {
      if (projectId === current && selectedFile === file.path) {
        $("project-preview-content").innerHTML = `<p>${esc(error.message || "文件预览失败")}</p>`;
      }
    }
  }

  function renderFileTree(files) {
    const root = {directories: new Map(), files: []};
    files.forEach(file => {
      const parts = file.path.split("/");
      let node = root;
      parts.slice(0, -1).forEach(part => {
        if (!node.directories.has(part)) node.directories.set(part, {directories: new Map(), files: []});
        node = node.directories.get(part);
      });
      node.files.push(file);
    });
    const renderNode = (node, parents = []) => {
      const directories = [...node.directories.entries()].sort(([a], [b]) => a.localeCompare(b));
      const entries = directories.map(([name, child]) => {
        const directoryPath = [...parents, name].join("/");
        const open = !collapsedDirectories.has(directoryPath);
        return `<details class="project-tree-directory" data-directory-path="${esc(directoryPath)}" ${open ? "open" : ""}><summary><span aria-hidden="true">▾</span><strong>${esc(name)}</strong></summary><div>${renderNode(child, [...parents, name])}</div></details>`;
      });
      entries.push(...node.files.sort((a, b) => a.name.localeCompare(b.name)).map(file => `<div class="project-file-row" data-preview-type="${esc(file.preview_type)}">
        <button type="button" data-workspace-open="${esc(file.path)}" aria-pressed="${file.path === selectedFile}" title="${esc(file.path)}"><span aria-hidden="true">◇</span><span>${esc(file.name)}</span><small>${file.is_artifact ? "产物 · " : ""}${esc(fileSize(file.size))}</small></button>
        <button type="button" data-workspace-download="${esc(file.path)}" aria-label="下载 ${esc(file.path)}" title="下载">↓</button>
      </div>`));
      return entries.join("");
    };
    return `<div class="project-tree-root"><div class="project-tree-root-label"><span aria-hidden="true">▾</span><strong>workspace</strong></div><div class="project-tree-children">${renderNode(root)}</div></div>`;
  }

  function renderCurrentFileTree(emptyMessage = "工作空间暂无文件。", truncated = false) {
    const target = $("project-files");
    const query = workspaceFilter.trim().toLocaleLowerCase();
    const visibleFiles = query
      ? workspaceFiles.filter(file => file.path.toLocaleLowerCase().includes(query))
      : workspaceFiles;
    const signature = JSON.stringify(visibleFiles.map(file => [
      file.path, file.size, file.modified_ns, file.is_artifact, file.artifact?.updated_at || "",
    ])) + `|${query}|${truncated}`;
    $("project-file-count").textContent = query
      ? `${visibleFiles.length}/${workspaceFiles.length}`
      : String(workspaceFiles.length);
    if (signature === workspaceTreeSignature) return;
    const scrollTop = target.scrollTop;
    target.innerHTML = visibleFiles.length
      ? renderFileTree(visibleFiles)
      : `<p>${query ? "没有匹配的文件。" : emptyMessage}</p>`;
    if (truncated && !query) target.insertAdjacentHTML("beforeend", "<p>仅显示前 500 个文件。</p>");
    target.scrollTop = scrollTop;
    workspaceTreeSignature = signature;
  }

  function renderWorkspace(data) {
    const scopeLabel = data.scope === "task" ? "任务工作空间" : "项目工作空间";
    $("project-workspace-status").textContent = `${scopeLabel} · ${new Date().toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", second: "2-digit"})} 已同步`;
    const files = data.files || [];
    workspaceFiles = files;
    if (Array.isArray(data.all_artifacts)) {
      renderArtifacts(data.all_artifacts);
      if (currentDetail) currentDetail.artifacts = data.all_artifacts;
    }
    renderCurrentFileTree(
      data.scope === "task"
        ? "该任务尚未登记产物。产物登记后会自动出现在这里。"
        : "工作空间暂无文件。",
      data.truncated,
    );
    const active = files.find(file => file.path === selectedFile);
    if (active) openPreview(active);
    else if (selectedFile) emptyPreview("所选文件已不存在或不属于当前任务。");
  }

  async function refreshWorkspace({silent = false} = {}) {
    if (!current) return;
    if (workspaceScope === "task" && !workspaceTask) {
      $("project-files").innerHTML = "<p>项目尚无任务。</p>";
      $("project-workspace-status").textContent = "任务工作空间 · 等待创建任务";
      return;
    }
    const token = revision;
    if (!silent) $("project-workspace-status").textContent = "正在同步工作空间…";
    const query = workspaceScope === "task" ? `?task_id=${encodeURIComponent(workspaceTask)}` : "";
    try {
      const data = await api(projectUrl() + "/workspace" + query);
      if (token === revision) renderWorkspace(data);
    } catch (error) {
      if (!silent) report(error);
      $("project-workspace-status").textContent = "同步失败，已保留当前内容";
    }
  }

  function setWorkspaceScope(scope, taskId = "") {
    workspaceScope = scope === "task" ? "task" : "project";
    if (taskId) workspaceTask = taskId;
    workspaceTreeSignature = "";
    document.querySelectorAll("[data-workspace-scope]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.workspaceScope === workspaceScope));
    });
    $("project-workspace-task-wrap").hidden = workspaceScope !== "task";
    if (workspaceTask) $("project-workspace-task").value = workspaceTask;
    updateTerminalTarget();
    selectedFile = "";
    selectedSignature = "";
    emptyPreview(workspaceScope === "task" ? "选择该任务登记的产物在线查看。" : "选择项目文件在线查看内容。");
    refreshWorkspace().catch(report);
  }

  async function selectProject(id) {
    const token = ++revision;
    rememberProject(id);
    workspaceScope = "project";
    workspaceTask = "";
    workspaceFilter = "";
    workspaceTreeSignature = "";
    collapsedDirectories.clear();
    $("project-file-filter").value = "";
    emptyPreview("选择项目文件在线查看内容。");
    $("project-error").textContent = "";
    $("project-detail").hidden = true;
    const data = await api(projectUrl());
    if (token !== revision) return;
    renderDetail(data);
    setWorkspaceScope("project");
    await refreshList();
  }

  async function downloadFile(path) {
    try {
      const response = await fetch(projectUrl() + "/file?path=" + encodeURIComponent(path));
      if (!response.ok) throw new Error("文件读取失败");
      const blob = await response.blob();
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = path.split("/").pop();
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      report(error);
    }
  }

  window.openProjects = async function () {
    window.switchView("projects");
    try {
      const items = await refreshList();
      const selected = items.find(item => item.project_id === current) || items[0];
      if (selected) await selectProject(selected.project_id);
      else $("project-detail").hidden = true;
    } catch (error) {
      report(error);
    }
  };

  function selectProjectFromClick(event) {
    const button = event.target.closest("[data-project]");
    if (button) selectProject(button.dataset.project).catch(report);
  }
  $("project-list").addEventListener("click", selectProjectFromClick);
  $("project-team-portfolio").addEventListener("click", selectProjectFromClick);
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
      const data = await api("/api/projects", {
        name: values.get("name"),
        description: values.get("description"),
        team_ids: values.getAll("team_ids"),
      });
      event.target.reset();
      await selectProject(data.project.project_id);
    });
  });
  $("project-team-form").addEventListener("submit", event => {
    event.preventDefault();
    const id = current;
    submit(event.currentTarget, async values => {
      await api(`/api/projects/${encodeURIComponent(id)}/teams`, {team_ids: values.getAll("team_ids")}, "PUT");
      if (id === current) await selectProject(id);
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

  $("project-workspace-task").addEventListener("change", event => {
    workspaceTask = event.target.value;
    workspaceTreeSignature = "";
    updateTerminalTarget();
    selectedFile = "";
    emptyPreview("选择该任务登记的产物在线查看。");
    refreshWorkspace().catch(report);
  });
  document.querySelectorAll("[data-workspace-scope]").forEach(button => {
    button.addEventListener("click", () => setWorkspaceScope(button.dataset.workspaceScope));
  });
  $("project-preview-download").addEventListener("click", () => {
    if (selectedFile) downloadFile(selectedFile);
  });
  $("project-files-refresh").addEventListener("click", () => refreshWorkspace().catch(report));
  $("project-files-tool").addEventListener("click", () => $("project-file-filter").focus());
  $("project-file-filter").addEventListener("input", event => {
    workspaceFilter = event.target.value;
    workspaceTreeSignature = "";
    renderCurrentFileTree();
  });
  $("project-files").addEventListener("toggle", event => {
    const details = event.target.closest?.("[data-directory-path]");
    if (!details) return;
    if (details.open) collapsedDirectories.delete(details.dataset.directoryPath);
    else collapsedDirectories.add(details.dataset.directoryPath);
  }, true);
  $("project-files-expand").addEventListener("click", () => {
    collapsedDirectories.clear();
    $("project-files").querySelectorAll("details").forEach(details => { details.open = true; });
  });
  $("project-files-collapse").addEventListener("click", () => {
    $("project-files").querySelectorAll("details[data-directory-path]").forEach(details => {
      collapsedDirectories.add(details.dataset.directoryPath);
      details.open = false;
    });
  });

  function workspaceTerminalAgent() {
    const task = workspaceScope === "task"
      ? currentDetail?.tasks?.find(item => item.kanban_task_id === workspaceTask)
      : null;
    const requestedAgent = task
      ? agents().find(agent => agent.profile_name === task.assignee_profile || agent.agent_id === task.metadata?.assignee_agent_id)
      : null;
    if (requestedAgent && (requestedAgent.readiness_status || "ready") === "ready") return requestedAgent;
    const teamIds = currentDetail?.project?.team_ids || [];
    return agents().find(agent =>
      (!teamIds.length || teamIds.includes(agent.team_id)) &&
      (agent.readiness_status || "ready") === "ready" &&
      agent.runtime_status === "running"
    );
  }

  function updateTerminalTarget() {
    const button = $("project-open-terminal");
    const agent = workspaceTerminalAgent();
    const label = agent
      ? `打开 ${agent.name || agent.agent_id} 的 Hermes 终端`
      : "当前工作空间没有可用 Agent";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.disabled = !agent;
  }

  function openWorkspaceTerminal() {
    const agent = workspaceTerminalAgent();
    if (!agent) {
      report(new Error("当前工作空间没有可用的运行中 Agent，启动 Agent 后再打开终端。"));
      return;
    }
    const opened = window.__HERMES_APP__.openAgentTerminal?.(agent.agent_id, agent.name);
    if (!opened) report(new Error(`${agent.name || agent.agent_id} 尚未就绪，无法打开终端。`));
  }
  $("project-open-terminal").addEventListener("click", openWorkspaceTerminal);

  $("project-detail").addEventListener("click", async event => {
    const workspaceButton = event.target.closest("[data-project-task-workspace]");
    if (workspaceButton) {
      setWorkspaceScope("task", workspaceButton.dataset.projectTaskWorkspace);
      $("project-workspace-heading").scrollIntoView({behavior: "smooth", block: "start"});
      return;
    }
    const processButton = event.target.closest("[data-project-task-process]");
    if (processButton) {
      window.__HERMES_APP__.openKanbanTask(processButton.dataset.projectTaskProcess);
      return;
    }
    const openButton = event.target.closest("[data-workspace-open]");
    if (openButton) {
      let entry = workspaceFiles.find(item => item.path === openButton.dataset.workspaceOpen);
      if (!entry) {
        const response = await api(projectUrl() + "/workspace");
        entry = response.files.find(item => item.path === openButton.dataset.workspaceOpen);
      }
      if (entry) openPreview(entry, true);
      return;
    }
    const downloadButton = event.target.closest("[data-workspace-download]");
    if (downloadButton) downloadFile(downloadButton.dataset.workspaceDownload);
  });

  document.addEventListener("keydown", event => {
    if ($("view-projects").classList.contains("hidden")) return;
    const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
    if (event.key === "/" && !editing) {
      event.preventDefault();
      $("project-file-filter").focus();
    } else if (event.ctrlKey && event.key === "`") {
      event.preventDefault();
      openWorkspaceTerminal();
    } else if (event.key === "Escape" && event.target === $("project-file-filter") && workspaceFilter) {
      workspaceFilter = "";
      $("project-file-filter").value = "";
      workspaceTreeSignature = "";
      renderCurrentFileTree();
    }
  });

  function scheduleWorkspaceRefresh() {
    window.clearTimeout(workspaceTimer);
    workspaceTimer = window.setTimeout(async () => {
      const visible = current && !document.hidden && !$("view-projects").classList.contains("hidden");
      if (visible) await refreshWorkspace({silent: true});
      scheduleWorkspaceRefresh();
    }, refreshInterval);
  }

  refreshList().catch(() => {});
  scheduleWorkspaceRefresh();
})();
