(function initHermesUi() {
  const app = () => window.__HERMES_APP__ || {};
  const boot = () => window.__BOOTSTRAP__ || {};

  const VIEWS = ["overview", "board", "members", "stats", "settings", "teams", "chat", "projects"];
  let currentView = "overview";
  let memberFilter = "全部";
  let memberSearch = "";
  let statsDays = 7;

  const els = {
    sidebar: document.getElementById("app-sidebar"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    dock: document.querySelector("[data-ui-dock='task-dock']"),
    overviewStats: document.getElementById("overview-stats-grid"),
    overviewHealth: document.getElementById("overview-team-health"),
    overviewActivity: document.getElementById("overview-activity-feed"),
    overviewTaskStatus: document.getElementById("overview-task-status"),
    boardColumns: document.getElementById("board-kanban-columns"),
    boardTeamSelect: document.getElementById("board-team-select"),
    membersGrid: document.getElementById("members-grid"),
    membersSubtitle: document.getElementById("members-subtitle"),
    membersFilterBar: document.getElementById("members-filter-bar"),
    memberSearch: document.getElementById("member-search"),
    statsContent: document.getElementById("stats-content"),
    statsSubtitle: document.getElementById("stats-subtitle"),
    settingsModelList: document.getElementById("settings-model-list"),
    kanbanTeamSelect: document.getElementById("kanban-team-select"),
    teamsContent: document.getElementById("teams-content"),
  };

  function esc(value) {
    return app().escapeHtml ? app().escapeHtml(value) : String(value ?? "");
  }

  function teamNameForAgent(agent, teams) {
    const team = teams.find((t) => t.team_id === agent.team_id);
    return team ? team.name : "未分组";
  }

  function teamSlugForAgent(agent, teams) {
    const team = teams.find((t) => t.team_id === agent.team_id);
    return team ? team.slug : "";
  }

  function agentInitial(name) {
    const text = String(name || "?").trim();
    return text ? text.slice(0, 1) : "?";
  }

  function formatEventTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function countKanbanByColumn(links) {
    const counts = { ready: 0, running: 0, blocked: 0, done: 0 };
    const columnFor = app().kanbanColumnForStatus || (() => "unknown");
    (links || []).forEach((link) => {
      const key = columnFor(app().kanbanDisplayStatus ? app().kanbanDisplayStatus(link) : link.kanban_status);
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }

  function switchView(name, ev) {
    if (ev) ev.preventDefault();
    if (!VIEWS.includes(name)) return;
    currentView = name;
    document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
    const target = document.getElementById(`view-${name}`);
    if (target) target.classList.remove("hidden");
    if (els.dock) {
      els.dock.classList.toggle("is-visible", name === "overview" || name === "board");
    }
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("text-primary", "bg-primary-container/30");
      link.classList.add("text-on-surface-variant");
    });
    const active = document.querySelector(`.nav-link[data-view="${name}"]`);
    if (active) {
      active.classList.add("text-primary", "bg-primary-container/30");
      active.classList.remove("text-on-surface-variant");
    }
    if (name === "stats") void renderStatsView();
    if (name === "settings") void renderSettingsView();
    if (name === "teams") void renderTeamsView();
    if (window.innerWidth < 768 && els.sidebar) {
      setMobileSidebar(false);
    }
  }

  window.switchView = switchView;

  function renderOverviewStats(agents, stats, teams, links) {
    if (!els.overviewStats) return;
    const online = agents.filter(
      (a) => (a.readiness_status || "ready") === "ready" && (a.runtime_status || "stopped") === "running",
    ).length;
    const counts = countKanbanByColumn(links);
    const activeTasks = counts.ready + counts.running + counts.blocked;
    const doneTasks = counts.done;
    const cards = [
      { label: "在职员工", value: String(agents.length), icon: "groups", tone: "primary" },
      { label: "当前任务", value: String(activeTasks), icon: "assignment", tone: "primary" },
      { label: "已完成任务", value: String(doneTasks), icon: "task_alt", tone: "secondary" },
      { label: "团队数", value: String(teams.length), icon: "hub", tone: "tertiary" },
    ];
    if (stats?.length) {
      cards[0].value = stats[0]?.value?.replace(/^0+/, "") || cards[0].value;
      if (stats[1]) cards[1].value = stats[1]?.value?.replace(/^0+/, "") || cards[1].value;
    }
    els.overviewStats.innerHTML = cards
      .map(
        (card) => `
      <div class="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30 flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-${card.tone}-container/20 text-${card.tone} flex items-center justify-center">
          <span class="material-symbols-outlined msr" aria-hidden="true">${card.icon}</span>
        </div>
        <div>
          <div class="font-label-md text-on-surface-variant mb-1">${esc(card.label)}</div>
          <div class="font-headline-md text-headline-md font-bold text-on-surface">${esc(card.value)}</div>
        </div>
      </div>`,
      )
      .join("");
  }

  function renderOverviewHealth(agents, teams) {
    if (!els.overviewHealth) return;
    const palette = ["secondary", "tertiary", "secondary-fixed-dim", "primary"];
    const teamCards = teams.length
      ? teams.map((team, index) => {
          const members = agents.filter((a) => a.team_id === team.team_id);
          const leader = members.find((a) => a.role === "leader");
          const running = members.filter(
            (a) => (a.runtime_status || "stopped") === "running",
          ).length;
          const color = palette[index % palette.length];
          return `
          <div class="rounded-xl border border-outline-variant/30 p-4 bg-surface-container-lowest">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-2.5 h-2.5 rounded-full bg-${color} inline-block"></span>
              <span class="font-title-lg text-[15px] font-bold text-on-surface">${esc(team.name)}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-container text-on-surface-variant">${esc(team.slug)}</span>
            </div>
            <div class="font-label-sm text-on-surface-variant mb-1">负责人：${esc(leader?.name || "—")}</div>
            <div class="font-label-sm text-on-surface-variant mb-3">成员 ${members.length} · 运行中 ${running}</div>
            <div class="flex gap-2">
              <span class="px-2 py-1 rounded-lg bg-surface-container text-on-surface-variant text-[11px]">${members.length} 人</span>
            </div>
          </div>`;
        })
      : [
          `<div class="rounded-xl border border-outline-variant/30 p-4 bg-surface-container-lowest col-span-3">
            <div class="font-label-sm text-on-surface-variant">尚未创建团队，可在团队管理中创建并添加已有 Agent。</div>
          </div>`,
        ];
    els.overviewHealth.innerHTML = teamCards.join("");
  }

  function renderOverviewActivity(events) {
    if (!els.overviewActivity) return;
    const items = (events || []).slice(0, 12);
    if (!items.length) {
      els.overviewActivity.innerHTML = `<p class="py-4 text-on-surface-variant font-label-md">暂无动态</p>`;
      return;
    }
    els.overviewActivity.innerHTML = items
      .map((event) => {
        const agentName = event.data?.agent_name || event.agent_id || "系统";
        const text = event.data?.text || event.data?.summary || event.event_type || "";
        return `
        <div class="flex items-start gap-3 py-3 border-b border-outline-variant/20 last:border-0">
          <div class="w-8 h-8 rounded-full bg-primary-container/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">${esc(agentInitial(agentName))}</div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] text-on-surface leading-snug"><span class="font-bold">${esc(agentName)}</span> ${esc(text)}</div>
            <div class="font-label-sm text-outline text-[11px] mt-0.5">${esc(formatEventTime(event.timestamp))}</div>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderOverviewTaskStatus(links) {
    if (!els.overviewTaskStatus) return;
    const counts = countKanbanByColumn(links);
    const rows = [
      { key: "ready", label: "待执行", hint: "等待派发或开始", icon: "hourglass_empty", tone: "primary" },
      { key: "running", label: "执行中", hint: "Agent 正在处理", icon: "play_circle", tone: "secondary" },
      { key: "blocked", label: "阻塞", hint: "需人工介入", icon: "block", tone: "tertiary" },
      { key: "done", label: "已完成", hint: "含 Review 与子任务", icon: "task_alt", tone: "secondary" },
    ];
    els.overviewTaskStatus.innerHTML = rows
      .map((row, index) => {
        const border = index < rows.length - 1 ? "border-b border-outline-variant/20" : "";
        const valueClass = row.key === "done" ? "text-secondary" : "text-on-surface-variant";
        return `
        <div class="flex items-center justify-between py-2 ${border}">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-lg bg-${row.tone}-container/20 text-${row.tone} flex items-center justify-center">
              <span class="material-symbols-outlined msr text-[18px]" aria-hidden="true">${row.icon}</span>
            </span>
            <div>
              <div class="font-label-md text-on-surface font-bold">${esc(row.label)}</div>
              <div class="font-label-sm text-outline">${esc(row.hint)}</div>
            </div>
          </div>
          <div class="font-headline-md font-bold ${valueClass}">${counts[row.key] || 0}</div>
        </div>`;
      })
      .join("");
  }

  function renderBoardColumns(kanbanState) {
    if (!els.boardColumns) return;
    const links = [...(kanbanState?.links || [])].filter((link) => app().kanbanLinkMatchesTeam?.(link) ?? true).sort((a, b) =>
      String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")),
    );
    const columns = [
      { key: "ready", title: "待执行", bar: "bg-primary-fixed-dim", icon: "hourglass_empty" },
      { key: "running", title: "执行中", bar: "bg-secondary-fixed-dim", icon: "play_circle" },
      { key: "blocked", title: "阻塞", bar: "bg-tertiary-fixed-dim", icon: "block" },
      { key: "done", title: "已完成", bar: "bg-outline-variant", icon: "task_alt" },
    ];
    const columnFor = app().kanbanColumnForStatus || (() => "unknown");
    const displayStatus = app().kanbanDisplayStatus || ((link) => link.kanban_status);
    const roleLabel = app().kanbanRoleLabel || ((role) => role || "任务");
    const formatDt = app().formatDateTime || formatEventTime;
    const agentFor = app().agentForKanbanLink || (() => null);
    const openTask = app().openKanbanTask || (() => {});

    const grouped = Object.fromEntries(columns.map((c) => [c.key, []]));
    links.forEach((link) => {
      const key = columnFor(displayStatus(link));
      if (grouped[key]) grouped[key].push(link);
    });

    els.boardColumns.innerHTML = columns
      .map((column) => {
        const items = grouped[column.key] || [];
        const body = items.length
          ? items
              .slice(0, 30)
              .map((link) => {
                const agent = agentFor(link);
                const assigneeName = agent?.name || link.assignee_profile || "unassigned";
                const taskTitle = link.metadata?.task_title || roleLabel(link.kanban_role);
                const badge = roleLabel(link.kanban_role);
                return `
                <div class="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/50 hover:border-primary/50 transition-colors cursor-pointer kanban-ui-card" role="button" tabindex="0" data-task-id="${esc(link.kanban_task_id || "")}">
                  <div class="flex justify-between items-start mb-2">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-container/10 text-primary border border-primary/20">${esc(badge)}</span>
                    <span class="material-symbols-outlined msr text-secondary text-sm" aria-hidden="true">task_alt</span>
                  </div>
                  <h3 class="font-title-lg text-[14px] font-bold text-on-surface mb-2 leading-tight line-clamp-2">${esc(taskTitle)}</h3>
                  <div class="flex justify-between items-center mt-auto">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-full bg-primary-container/20 text-primary flex items-center justify-center text-[10px] font-bold">${esc(agentInitial(assigneeName))}</span>
                      <span class="font-label-md text-on-surface-variant text-[12px]">${esc(assigneeName)}</span>
                    </div>
                    <span class="font-label-md text-outline text-[11px]">${esc(formatDt(link.created_at))}</span>
                  </div>
                </div>`;
              })
              .join("")
          : `
            <div class="flex-1 p-3 flex flex-col items-center justify-center text-on-surface-variant text-center border-2 border-dashed border-outline-variant/30 m-3 rounded-lg bg-surface min-h-[180px]">
              <span class="material-symbols-outlined msr text-4xl mb-2 text-outline-variant" aria-hidden="true">${column.icon}</span>
              <p class="font-label-md">暂无任务</p>
            </div>`;
        return `
        <div class="w-[320px] shrink-0 flex flex-col bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20">
          <div class="h-2 ${column.bar}"></div>
          <div class="p-3 font-title-lg text-title-lg text-on-surface flex justify-between items-center">
            ${esc(column.title)}
            <span class="bg-surface-container text-on-surface-variant px-2 rounded-full text-sm">${items.length}</span>
          </div>
          <div class="flex-1 p-3 overflow-y-auto flex flex-col gap-3">${body}</div>
        </div>`;
      })
      .join("");

    els.boardColumns.querySelectorAll(".kanban-ui-card").forEach((card) => {
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); card.click(); }
      });
      card.addEventListener("click", () => {
        const taskId = card.dataset.taskId;
        const link = links.find((item) => item.kanban_task_id === taskId);
        if (link) openTask(link);
      });
    });
  }

  function renderMemberFilters(agents, teams) {
    if (!els.membersFilterBar) return;
    const mainCount = agents.filter((a) => !a.team_id).length;
    const filters = [{ key: "全部", label: "全部", count: agents.length }];
    if (mainCount) filters.push({ key: "__ungrouped__", label: "未分组", count: mainCount });
    teams.forEach((team) => {
      const count = agents.filter((a) => a.team_id === team.team_id).length;
      if (count) filters.push({ key: team.team_id, label: team.name, count });
    });
    if (!filters.some(filter => filter.key === memberFilter)) memberFilter = "全部";
    els.membersFilterBar.innerHTML = filters
      .map((filter) => {
        const active = memberFilter === filter.key;
        const cls = active
          ? "filter-btn px-3 py-1.5 rounded-lg font-label-md bg-surface shadow-sm text-on-surface"
          : "filter-btn px-3 py-1.5 rounded-lg font-label-md text-on-surface-variant";
        return `<button type="button" data-filter="${esc(filter.key)}" class="${cls}">${esc(filter.label)} ${filter.count}</button>`;
      })
      .join("");
    els.membersFilterBar.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        memberFilter = btn.dataset.filter || "全部";
        renderMemberCards(agents, teams);
        renderMemberFilters(agents, teams);
      });
    });
  }

  function renderMemberCards(agents, teams) {
    if (!els.membersGrid) return;
    const displayStatus = app().getAgentDisplayStatus || (() => ({ label: "未知", className: "idle" }));
    const filtered = agents.filter((agent) => {
      const teamLabel = teamNameForAgent(agent, teams);
      const matchesTeam = memberFilter === "全部" || (memberFilter === "__ungrouped__" ? !agent.team_id : agent.team_id === memberFilter);
      const matchesSearch = !memberSearch || [agent.name, agent.profile_name, agent.role].join(" ").toLowerCase().includes(memberSearch.toLowerCase());
      return matchesTeam && matchesSearch;
    });
    if (els.membersSubtitle) {
      els.membersSubtitle.textContent = `${agents.length} 名 Agent · ${teams.length || 0} 个团队`;
    }
    if (!filtered.length) {
      els.membersGrid.innerHTML = `<p class="col-span-full text-on-surface-variant font-label-md py-8 text-center">没有匹配的成员</p>`;
      return;
    }
    els.membersGrid.innerHTML = filtered
      .map((agent) => {
        const teamLabel = teamNameForAgent(agent, teams);
        const status = displayStatus(agent);
        const runtime = agent.runtime_status || "stopped";
        const modelName = agent.model_summary?.default || agent.model_summary?.model || "—";
        const isRunning = runtime === "running";
        const actionLabel = isRunning ? "停止" : "启动";
        const actionClass = isRunning
          ? "bg-error-container/30 text-error hover:bg-error-container/50"
          : "bg-secondary-container/20 text-secondary hover:bg-secondary-container/40";
        return `
        <div class="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3 hover:border-primary/50 transition-colors" data-team="${esc(teamLabel)}" data-name="${esc(agent.name || "")}" data-agent-id="${esc(agent.agent_id)}">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-base">${esc(agentInitial(agent.name))}</div>
            <div class="flex-1 min-w-0">
              <div class="font-title-lg text-[15px] font-bold text-on-surface truncate">${esc(agent.name)}</div>
              <div class="font-label-sm text-on-surface-variant truncate">${esc(agent.role)} · ${esc(agent.profile_name)}</div>
            </div>
            <button type="button" class="text-on-surface-variant hover:text-primary p-1 rounded-full" data-agent-config data-agent-id="${esc(agent.agent_id)}" aria-label="配置 Agent">
              <span class="material-symbols-outlined msr" aria-hidden="true">more_vert</span>
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-container/10 text-primary border border-primary/20">${esc(teamLabel)}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container/20 text-secondary border border-secondary/20 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-secondary inline-block"></span>${esc(status.label)}
            </span>
          </div>
          <div class="text-[11px] font-mono text-on-surface-variant bg-surface-container-low rounded-lg px-2 py-1.5 truncate">${esc(modelName)}</div>
          <div class="flex items-center justify-between pt-1 border-t border-outline-variant/20">
            <span class="font-label-sm text-on-surface-variant">任务 ${agent.queue_depth || 0}</span>
            <div class="flex gap-2">
              <button type="button" class="text-[11px] px-2 py-1 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface-container-high" data-agent-config data-agent-id="${esc(agent.agent_id)}">配置</button>
              <button type="button" class="text-[11px] px-2 py-1 rounded-lg bg-primary-container/20 text-primary" data-agent-chat data-agent-id="${esc(agent.agent_id)}">聊天</button>
              <button type="button" class="text-[11px] px-2 py-1 rounded-lg ${actionClass}" data-session-action="${isRunning ? "stop" : "start"}" data-agent-id="${esc(agent.agent_id)}">${actionLabel}</button>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  function statsRangeLabel(days) {
    if (days <= 1) return "最近 24 小时";
    if (days <= 7) return "最近 7 天";
    return "最近 30 天";
  }

  function linkDoneWithinRange(link, days) {
    if ((link.kanban_status || "").toLowerCase() !== "done") return false;
    const ts = link.updated_at || link.db_updated_at || link.created_at;
    if (!ts) return true;
    const parsed = new Date(ts).getTime();
    if (Number.isNaN(parsed)) return true;
    return parsed >= Date.now() - days * 24 * 60 * 60 * 1000;
  }

  function filterStatsLinks(links) {
    return (links || []).filter((link) => linkDoneWithinRange(link, statsDays));
  }

  function syncStatsRangeButtons() {
    document.querySelectorAll("[data-stats-range]").forEach((button) => {
      const active = Number(button.dataset.statsRange) === statsDays;
      button.classList.toggle("bg-surface", active);
      button.classList.toggle("shadow-sm", active);
      button.classList.toggle("text-on-surface", active);
      button.classList.toggle("text-on-surface-variant", !active);
    });
  }

  function formatTokenCount(value) {
    const n = Number(value) || 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  async function fetchTeamUsageRows(teams, days) {
    const rows = [];
    for (const team of teams || []) {
      if (!team?.slug) continue;
      try {
        const response = await fetch(`/api/teams/${encodeURIComponent(team.slug)}/usage?days=${days}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.total) continue;
        const members = Object.entries(data.by_member || {})
          .sort((a, b) => (b[1]?.total_tokens || 0) - (a[1]?.total_tokens || 0));
        const top = members[0];
        rows.push({
          name: team.name || team.slug,
          total: data.total?.total_tokens || 0,
          topMember: top ? `${top[0]} ${formatTokenCount(top[1]?.total_tokens || 0)}` : "—",
        });
      } catch {
        /* ignore per-team failures */
      }
    }
    return rows;
  }

  async function renderStatsView() {
    if (!els.statsContent) return;
    syncStatsRangeButtons();
    const allLinks = boot().kanban_task_links || [];
    const links = filterStatsLinks(allLinks);
    const agents = boot().agents || [];
    const teams = boot().teams || [];
    const counts = countKanbanByColumn(allLinks);
    const done = links.length;
    if (els.statsSubtitle) {
      els.statsSubtitle.textContent = `基于已完成 ${done} 项任务的执行人统计（${statsRangeLabel(statsDays)}）`;
    }

    const byAssignee = new Map();
    links.forEach((link) => {
      if ((link.kanban_status || "").toLowerCase() !== "done") return;
      const name = app().agentForKanbanLink?.(link)?.name || link.assignee_profile || "未分配";
      byAssignee.set(name, (byAssignee.get(name) || 0) + 1);
    });
    const top = [...byAssignee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = top[0]?.[1] || 1;

    const byTeam = new Map();
    teams.forEach((team) => {
      byTeam.set(team.name, links.filter((link) => {
        const agent = agents.find((a) => a.profile_name === link.assignee_profile);
        return agent?.team_id === team.team_id && (link.kanban_status || "").toLowerCase() === "done";
      }).length);
    });
    const mainDone = links.filter((link) => {
      const agent = agents.find((a) => a.profile_name === link.assignee_profile);
      return !agent?.team_id && (link.kanban_status || "").toLowerCase() === "done";
    }).length;
    if (mainDone) byTeam.set("主团队", mainDone);

    const roleCounts = { parent: 0, worker: 0, review: 0, other: 0 };
    links.forEach((link) => {
      if ((link.kanban_status || "").toLowerCase() !== "done") return;
      const role = link.kanban_role || "";
      if (role === "parent") roleCounts.parent += 1;
      else if (role === "worker") roleCounts.worker += 1;
      else if (role === "review") roleCounts.review += 1;
      else roleCounts.other += 1;
    });

    const teamTotal = [...byTeam.values()].reduce((sum, n) => sum + n, 0) || done || 1;
    let angle = 0;
    const colors = ["#004ac6", "#006c49", "#996100", "#737686"];
    const segments = [...byTeam.entries()].map(([name, count], index) => {
      const deg = Math.round((count / teamTotal) * 360);
      const start = angle;
      angle += deg;
      return { name, count, start, end: angle, color: colors[index % colors.length] };
    });
    const gradient = segments.length
      ? `conic-gradient(${segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(", ")})`
      : "conic-gradient(#737686 0deg 360deg)";

    const usageRows = await fetchTeamUsageRows(teams, statsDays);
    const usageCard = `
      <div class="col-span-2 bg-surface rounded-xl border border-outline-variant/30 shadow-sm p-4">
        <h3 class="font-title-lg text-title-lg text-on-surface mb-1">团队 Token 用量</h3>
        <p class="font-label-sm text-on-surface-variant mb-4">${esc(statsRangeLabel(statsDays))} · 来自各 Agent 日志聚合</p>
        ${usageRows.length ? `<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${usageRows.map((row) => `
            <div class="rounded-xl bg-surface-container-low p-4">
              <div class="font-label-md text-on-surface font-bold mb-1">${esc(row.name)}</div>
              <div class="font-headline-md font-bold text-primary mb-1">${formatTokenCount(row.total)}</div>
              <div class="font-label-sm text-on-surface-variant">Top: ${esc(row.topMember)}</div>
            </div>`).join("")}
        </div>` : `<p class="text-on-surface-variant font-label-md">暂无用量数据</p>`}
      </div>`;

    els.statsContent.innerHTML = `
      <div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm p-4">
        <h3 class="font-title-lg text-title-lg text-on-surface mb-4">执行人任务量 TOP</h3>
        <div class="flex flex-col gap-4">
          ${top.length ? top.map(([name, count], index) => `
            <div>
              <div class="flex justify-between mb-1.5">
                <span class="font-label-md text-on-surface font-bold">${esc(name)}</span>
                <span class="font-label-sm text-on-surface-variant">${count} 项</span>
              </div>
              <div class="h-2.5 bg-surface-container rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full" style="width:${Math.max(8, Math.round((count / max) * 100))}%"></div>
              </div>
            </div>`).join("") : `<p class="text-on-surface-variant font-label-md">暂无已完成任务</p>`}
        </div>
      </div>
      <div class="bg-surface rounded-xl border border-outline-variant/30 shadow-sm p-4">
        <h3 class="font-title-lg text-title-lg text-on-surface mb-4">团队任务占比</h3>
        <div class="flex items-center justify-center gap-6 py-2 flex-wrap">
          <div class="w-32 h-32 rounded-full relative" style="background:${gradient}">
            <div class="absolute inset-3 bg-surface rounded-full flex items-center justify-center">
              <div class="text-center">
                <div class="font-headline-md font-bold text-on-surface">${done}</div>
                <div class="font-label-sm text-on-surface-variant">已完成</div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            ${[...byTeam.entries()].map(([name, count], index) => `
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-sm" style="background:${colors[index % colors.length]}"></span>
                <span class="font-label-md text-on-surface-variant">${esc(name)} ${count}</span>
              </div>`).join("")}
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-outline-variant/20 grid grid-cols-3 gap-3 text-center">
          <div><div class="font-headline-md font-bold text-primary">${done ? "100%" : "—"}</div><div class="font-label-sm text-on-surface-variant">验收通过率</div></div>
          <div><div class="font-headline-md font-bold text-on-surface">${done}</div><div class="font-label-sm text-on-surface-variant">任务总数</div></div>
          <div><div class="font-headline-md font-bold text-secondary">${counts.blocked || 0}</div><div class="font-label-sm text-on-surface-variant">阻塞/失败</div></div>
        </div>
      </div>
      <div class="col-span-2 bg-surface rounded-xl border border-outline-variant/30 shadow-sm p-4">
        <h3 class="font-title-lg text-title-lg text-on-surface mb-1">任务类型构成</h3>
        <p class="font-label-sm text-on-surface-variant mb-4">用户任务自动拆解为 Worker 子任务 → Leader Review 验收闭环</p>
        <div class="grid grid-cols-4 gap-3">
          <div class="rounded-xl bg-surface-container-low p-4 text-center"><div class="font-headline-md font-bold text-primary mb-1">${roleCounts.parent}</div><div class="font-label-sm text-on-surface-variant">用户任务</div></div>
          <div class="rounded-xl bg-surface-container-low p-4 text-center"><div class="font-headline-md font-bold text-secondary mb-1">${roleCounts.worker}</div><div class="font-label-sm text-on-surface-variant">Worker 子任务</div></div>
          <div class="rounded-xl bg-surface-container-low p-4 text-center"><div class="font-headline-md font-bold text-tertiary mb-1">${roleCounts.review}</div><div class="font-label-sm text-on-surface-variant">Leader Review</div></div>
          <div class="rounded-xl bg-surface-container-low p-4 text-center"><div class="font-headline-md font-bold text-outline mb-1">${roleCounts.other}</div><div class="font-label-sm text-on-surface-variant">跨团队/验收</div></div>
        </div>
      </div>
      ${usageCard}`;
  }

  function syncToggleThumb(input) {
    if (!(input instanceof HTMLInputElement)) return;
    input.classList.toggle("translate-x-5", input.checked);
  }

  function syncSettingsAutoDispatch() {
    const settingsToggle = document.getElementById("settings-auto-dispatch");
    const kanbanToggle = document.getElementById("kanban-auto-dispatch");
    if (!(settingsToggle instanceof HTMLInputElement)) return;
    if (kanbanToggle instanceof HTMLInputElement) {
      settingsToggle.checked = kanbanToggle.checked;
    }
    syncToggleThumb(settingsToggle);
  }

  const COLLABORATION_TOGGLES = [
    { id: "settings-multi-review", key: "multi_review_enabled" },
    { id: "settings-block-human", key: "block_human_input_enabled" },
    { id: "settings-idempotent", key: "idempotent_protection_enabled" },
  ];

  function applyCollaborationSettings(settings) {
    COLLABORATION_TOGGLES.forEach(({ id, key }) => {
      const input = document.getElementById(id);
      if (!(input instanceof HTMLInputElement) || typeof settings?.[key] !== "boolean") return;
      input.checked = settings[key];
      syncToggleThumb(input);
    });
  }

  async function loadCollaborationSettings() {
    try {
      const response = await fetch("/api/kanban/settings");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) return;
      applyCollaborationSettings(data.settings || {});
    } catch {
      /* settings hydrate is best-effort */
    }
  }

  async function persistCollaborationSetting(key, enabled) {
    try {
      const response = await fetch("/api/kanban/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "设置保存失败");
      applyCollaborationSettings(data.settings || {});
    } catch (error) {
      console.warn("[hermes-ui] collaboration settings save failed", error);
    }
  }

  function visibleKanbanLinks() {
    return (boot().kanban_task_links || []).filter(
      (link) => String(link?.kanban_status || "").toLowerCase() !== "archived",
    );
  }

  function updateSettingsDangerZone() {
    const hint = document.getElementById("settings-done-count");
    if (!hint) return;
    const done = countKanbanByColumn(visibleKanbanLinks()).done;
    hint.textContent = `清空已完成 ${done} 项任务与 deliverables 目录`;
  }

  function modelConfigRows(configs) {
    if (!configs.length) {
      return `
        <div class="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-lg bg-primary-container/20 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined msr text-[20px]" aria-hidden="true">smart_toy</span>
            </span>
            <div>
              <div class="font-label-md text-on-surface font-bold">暂无模型配置</div>
              <div class="font-label-sm text-outline">点击下方按钮添加或管理模型</div>
            </div>
          </div>
        </div>`;
    }
    return configs.map((cfg) => `
          <div class="flex items-center justify-between rounded-xl bg-surface-container-low p-3">
            <div class="flex items-center gap-3">
              <span class="w-9 h-9 rounded-lg bg-primary-container/20 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined msr text-[20px]" aria-hidden="true">smart_toy</span>
              </span>
              <div>
                <div class="font-label-md text-on-surface font-bold">${esc(cfg.name || cfg.model)}</div>
                <div class="font-label-sm text-outline">${esc(cfg.model || "")}</div>
              </div>
            </div>
            <span class="px-2 py-1 rounded-lg bg-secondary-container/20 text-secondary text-[11px] font-bold">可用</span>
          </div>`).join("");
  }

  async function renderSettingsView() {
    syncSettingsAutoDispatch();
    updateSettingsDangerZone();
    if (!els.settingsModelList) return;
    try {
      const response = await fetch("/api/model-configs");
      const data = await response.json().catch(() => ({}));
      const configs = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.configs)
          ? data.configs
          : Array.isArray(data.model_configs)
            ? data.model_configs
            : [];
      const agents = boot().agents || [];
      els.settingsModelList.innerHTML = `
        ${modelConfigRows(configs)}
        <button type="button" id="settings-open-models" class="w-full border border-dashed border-outline-variant/50 rounded-xl py-3 font-label-md text-primary hover:bg-primary-container/10 transition-colors">+ 管理模型配置</button>
        <p class="font-label-sm text-on-surface-variant">当前 ${agents.length} 名成员 · 自动派发由下方开关或任务栏控制</p>`;
      document.getElementById("settings-open-models")?.addEventListener("click", () => {
        app().openTransferModal?.();
        document.querySelector('[data-transfer-tab="models"]')?.click();
      });
    } catch (_err) {
      els.settingsModelList.innerHTML = `<p class="text-on-surface-variant font-label-md">模型配置加载失败</p>`;
    }
  }

  function syncTeamSelects() {
    const teams = boot().teams || [];
    const options = [`<option value="">全部团队</option>`]
      .concat(teams.map((t) => `<option value="${esc(t.slug)}">${esc(t.name)}</option>`))
      .join("");
    if (els.boardTeamSelect) {
      const selected = els.kanbanTeamSelect?.value || els.boardTeamSelect.value;
      els.boardTeamSelect.innerHTML = options;
      els.boardTeamSelect.value = teams.some((team) => team.slug === selected) ? selected : "";
    }
    if (els.kanbanTeamSelect && !els.kanbanTeamSelect.options.length) els.kanbanTeamSelect.innerHTML = options;
  }

  async function renderTeamsView() {
    if (!els.teamsContent) return;
    try {
      const response = await fetch("/api/teams");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        els.teamsContent.innerHTML = `<p class="text-on-surface-variant font-label-md">加载团队列表失败</p>`;
        return;
      }

      const teams = Array.isArray(data.teams) ? data.teams : [];
      app().setTeams?.(teams);
      const agents = boot().agents || [];
      const links = boot().kanban_task_links || [];

      // Calculate task counts and completion rates per team
      const teamStats = new Map();
      teams.forEach((team) => {
        const teamAgents = agents.filter((a) => a.team_id === team.team_id);
        const teamAgentProfiles = new Set(teamAgents.map((a) => a.profile_name));
        const teamLinks = links.filter((l) => teamAgentProfiles.has(l.assignee_profile));
        const done = teamLinks.filter((l) => (l.kanban_status || "").toLowerCase() === "done").length;
        const total = teamLinks.length;
        teamStats.set(team.team_id, { task_count: total, completion_rate: total > 0 ? Math.round((done / total) * 100) : 0 });
      });

      if (teams.length === 0) {
        els.teamsContent.innerHTML = `
          <div class="text-center py-12">
            <span class="material-symbols-outlined msr text-4xl mb-4 text-on-surface-variant">groups</span>
            <p class="font-label-md text-on-surface-variant mb-2">暂无团队数据</p>
            <button type="button" id="btn-create-first-team" class="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md hover:bg-primary/90">
              创建第一个团队
            </button>
          </div>
        `;

        document.getElementById("btn-create-first-team")?.addEventListener("click", () => {
          openTeamCreateModal();
        });
        return;
      }

      const teamsGrid = teams
        .map(
          (team) => {
            const stats = teamStats.get(team.team_id) || { task_count: 0, completion_rate: 0 };
            return `
          <div class="bg-surface rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-4 hover:border-primary/50 transition-colors" data-team-id="${esc(team.team_id)}">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-sm">
                ${esc(team.name.slice(0, 2).toUpperCase())}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-title-lg text-[18px] font-bold text-on-surface mb-1">${esc(team.name)}</div>
                <div class="font-label-sm text-on-surface-variant mb-1">${esc(team.description || "暂无描述")}</div>
                <div class="flex items-center gap-4 text-sm">
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined msr text-[14px]">people</span>
                    <span class="font-label-sm text-on-surface-variant">${team.member_count || 0} 人</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined msr text-[14px]">assessment</span>
                    <span class="font-label-sm text-on-surface-variant">${stats.completion_rate}% 任务完成</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined msr text-[14px]">schedule</span>
                    <span class="font-label-sm text-on-surface-variant">${stats.task_count} 任务</span>
                  </span>
                </div>
                ${team.lead_name ? `<div class="font-label-sm text-on-surface-variant">负责人：${esc(team.lead_name)}</div>` : ""}
              </div>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-outline-variant/20">
              <span class="font-label-sm text-on-surface-variant">slug: ${esc(team.slug)}</span>
              <div class="flex gap-2">
                <button type="button" class="px-3 py-1.5 rounded-lg font-label-md bg-surface-container text-on-surface hover:bg-surface-container-high" data-view-team="${esc(team.slug)}">
                  查看成员
                </button>
                <button type="button" class="px-3 py-1.5 rounded-lg font-label-md bg-surface-container text-on-surface hover:bg-surface-container-high" data-edit-team="${esc(team.slug)}">
                  编辑
                </button>
                <button type="button" class="px-3 py-1.5 rounded-lg font-label-md bg-error-container/30 text-error hover:bg-error-container/50" data-delete-team="${esc(team.team_id)}">
                  删除
                </button>
              </div>
            </div>
          </div>
        `;
          }
        )
        .join("");

      els.teamsContent.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-headline-md text-headline-md font-bold text-on-surface">团队管理</h2>
            <button type="button" id="btn-create-team" class="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md hover:bg-primary/90">
              + 新建团队
            </button>
          </div>
          <div class="grid gap-4">${teamsGrid}</div>
        </div>
      `;

      document.getElementById("btn-create-team")?.addEventListener("click", () => {
        openTeamCreateModal();
      });

      els.teamsContent.querySelectorAll("[data-edit-team]").forEach((btn) => {
        btn.addEventListener("click", () => {
          openTeamEditModal(btn.dataset.editTeam);
        });
      });

      els.teamsContent.querySelectorAll("[data-view-team]").forEach((btn) => {
        btn.addEventListener("click", () => {
          openTeamViewModal(btn.dataset.viewTeam);
        });
      });

      els.teamsContent.querySelectorAll("[data-delete-team]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const teamId = btn.dataset.deleteTeam;
          const team = teams.find((t) => t.team_id === teamId);
          if (!team || btn.disabled) return;
          if (team.member_count) {
            alert("请先移出所有成员，再删除团队。Agent Profile 不会被删除。");
            openTeamViewModal(team.slug);
            return;
          }
          if (!confirm(`确定删除空团队「${team.name}」？`)) return;
          btn.disabled = true;
          try {
            const resp = await fetch(`/api/teams/${encodeURIComponent(team.slug)}`, { method: "DELETE" });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok || !result.ok) {
              alert(result.error || "删除失败");
              return;
            }
            void renderTeamsView();
          } catch (err) {
            console.error("[hermes-ui] Failed to delete team:", err);
            alert("删除团队失败");
          } finally {
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      els.teamsContent.innerHTML = `<p class="text-on-surface-variant font-label-md">加载团队列表失败</p>`;
      console.error("[hermes-ui] Failed to load teams:", err);
    }
  }

  function openTeamCreateModal() { void app().teamManagement?.open(); }
  function openTeamEditModal(slug) { void app().teamManagement?.open(slug, true); }
  function openTeamViewModal(slug) { void app().teamManagement?.open(slug); }

  function focusTaskInput() {
    const input = document.getElementById("kanban-task-input");
    if (input) {
      switchView("board");
      input.focus();
    }
  }

  function setMobileSidebar(open) {
    if (!els.sidebar) return;
    els.sidebar.classList.toggle("-translate-x-full", !open);
    if (els.sidebarBackdrop) els.sidebarBackdrop.hidden = !open;
    els.sidebarToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    els.sidebarToggle?.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
  }

  function wireEvents() {
    document.querySelectorAll(".nav-link[data-view]").forEach((link) => {
      link.addEventListener("click", (event) => switchView(link.dataset.view || "overview", event));
    });

    els.sidebarToggle?.addEventListener("click", () => {
      setMobileSidebar(els.sidebar?.classList.contains("-translate-x-full"));
    });
    els.sidebarBackdrop?.addEventListener("click", () => setMobileSidebar(false));
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape"
        && window.innerWidth < 768
        && els.sidebar
        && !els.sidebar.classList.contains("-translate-x-full")
      ) {
        setMobileSidebar(false);
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768 && els.sidebarBackdrop) {
        els.sidebarBackdrop.hidden = true;
        els.sidebarToggle?.setAttribute("aria-expanded", "false");
      }
    });

    document.getElementById("btn-create-task-overview")?.addEventListener("click", focusTaskInput);
    document.getElementById("btn-create-task-board")?.addEventListener("click", focusTaskInput);

    document.getElementById("btn-create-agent-members")?.addEventListener("click", () => app().openModal?.());
    document.querySelector('[data-view="settings"]')?.addEventListener("click", () => {
      setTimeout(() => void renderSettingsView(), 0);
    });

    const settingsAutoDispatch = document.getElementById("settings-auto-dispatch");
    const kanbanAutoDispatch = document.getElementById("kanban-auto-dispatch");
    if (settingsAutoDispatch instanceof HTMLInputElement) {
      settingsAutoDispatch.addEventListener("change", () => {
        syncToggleThumb(settingsAutoDispatch);
        if (kanbanAutoDispatch instanceof HTMLInputElement) {
          kanbanAutoDispatch.checked = settingsAutoDispatch.checked;
          kanbanAutoDispatch.classList.toggle("translate-x-5", settingsAutoDispatch.checked);
        }
        const toggle = app().toggleKanbanAutoDispatch;
        if (toggle) {
          void toggle();
        } else if (kanbanAutoDispatch) {
          kanbanAutoDispatch.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    document.querySelectorAll("#view-settings .toggle-checkbox").forEach((input) => {
      if (input.id === "settings-auto-dispatch") return;
      input.addEventListener("change", () => syncToggleThumb(input));
    });

    COLLABORATION_TOGGLES.forEach(({ id, key }) => {
      const input = document.getElementById(id);
      if (!(input instanceof HTMLInputElement)) return;
      input.addEventListener("change", () => {
        syncToggleThumb(input);
        void persistCollaborationSetting(key, input.checked);
      });
    });

    document.querySelectorAll("[data-stats-range]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = Number(button.dataset.statsRange);
        if (!next || next === statsDays) return;
        statsDays = next;
        syncStatsRangeButtons();
        void renderStatsView();
      });
    });

    document.getElementById("settings-clear-done-tasks")?.addEventListener("click", (event) => {
      event.preventDefault();
      const clearDone = app().clearDoneKanbanTasks;
      if (clearDone) {
        void clearDone();
        return;
      }
      const clearColumn = app().clearColumnKanbanTasks;
      if (clearColumn) void clearColumn(event);
    });

    document.getElementById("settings-export-team")?.addEventListener("click", () => {
      app().openTransferModal?.();
      document.querySelector('[data-transfer-tab="export"]')?.click();
    });
    document.getElementById("settings-import-team")?.addEventListener("click", () => {
      app().openTransferModal?.();
      document.querySelector('[data-transfer-tab="import"]')?.click();
    });

    els.memberSearch?.addEventListener("input", () => {
      memberSearch = els.memberSearch.value.trim();
      renderMemberCards(boot().agents || [], boot().teams || []);
    });

    els.boardTeamSelect?.addEventListener("change", () => {
      const slug = els.boardTeamSelect.value || "";
      if (els.kanbanTeamSelect) {
        els.kanbanTeamSelect.value = slug;
        els.kanbanTeamSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    els.membersGrid?.addEventListener("click", (event) => {
      const configBtn = event.target.closest("[data-agent-config]");
      if (configBtn) {
        event.stopPropagation();
        const hiddenRow = document.querySelector(`#agent-list .agent-row[data-agent-id="${CSS.escape(configBtn.dataset.agentId || "")}"]`);
        if (hiddenRow) hiddenRow.querySelector("[data-agent-config]")?.click();
        return;
      }
      const sessionBtn = event.target.closest("[data-session-action]");
      if (sessionBtn) {
        event.stopPropagation();
        const agentId = sessionBtn.dataset.agentId;
        const action = sessionBtn.dataset.sessionAction;
        sessionBtn.disabled = true;
        fetch(`/api/agents/${agentId}/${action}`, { method: "POST" })
          .then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || "Agent 操作失败");
          })
          .catch((error) => { alert(error.message || "网络异常，请重试"); })
          .finally(() => { sessionBtn.disabled = false; });
      }
    });

  }

  function hydrateFromBootstrap() {
    const b = boot();
    const agents = b.agents || [];
    const teams = b.teams || [];
    const stats = b.stats || [];
    const links = (b.kanban_task_links || []).filter(
      (link) => String(link?.kanban_status || "").toLowerCase() !== "archived",
    );
    renderOverviewStats(agents, stats, teams, links);
    renderOverviewHealth(agents, teams);
    renderOverviewActivity(b.events || []);
    renderOverviewTaskStatus(links);
    renderMemberFilters(agents, teams);
    renderMemberCards(agents, teams);
    renderBoardColumns({ links });
    updateSettingsDangerZone();
    syncSettingsAutoDispatch();
  }

  window.__HERMES_UI__ = {
    refreshTeams: renderTeamsView,
    onTeamsUpdate() { syncTeamSelects(); hydrateFromBootstrap(); },
    onAgentsUpdate(agents, stats) {
      if (window.__BOOTSTRAP__) {
        window.__BOOTSTRAP__.agents = agents;
        if (stats) window.__BOOTSTRAP__.stats = stats;
      }
      const teams = boot().teams || [];
      const links = boot().kanban_task_links || [];
      renderOverviewStats(agents, stats, teams, links);
      renderOverviewHealth(agents, teams);
      renderOverviewActivity(boot().events || []);
      renderOverviewTaskStatus(links);
      renderMemberFilters(agents, teams);
      renderMemberCards(agents, teams);
      syncTeamSelects();
      if (currentView === "stats") void renderStatsView();
    },
    onKanbanUpdate(kanbanState) {
      if (boot().kanban_task_links !== kanbanState.links) {
        boot().kanban_task_links = kanbanState.links;
      }
      renderBoardColumns(kanbanState);
      const agents = boot().agents || [];
      const stats = boot().stats || [];
      const teams = boot().teams || [];
      renderOverviewStats(agents, stats, teams, kanbanState.links || []);
      renderOverviewTaskStatus(kanbanState.links || []);
      updateSettingsDangerZone();
      if (currentView === "stats") void renderStatsView();
    },
    onAutoDispatchChange(enabled) {
      const settingsToggle = document.getElementById("settings-auto-dispatch");
      if (settingsToggle instanceof HTMLInputElement) {
        settingsToggle.checked = enabled;
        syncToggleThumb(settingsToggle);
      }
    },
    applyCollaborationSettings,
  };

  wireEvents();
  syncTeamSelects();
  syncStatsRangeButtons();
  switchView("overview");
  hydrateFromBootstrap();
  void loadCollaborationSettings();
  void renderTeamsView();
})();
