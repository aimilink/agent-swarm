const API_TOKEN_STORAGE_KEY = "agentTeamApiToken";

function getStoredApiToken() {
  try {
    return (window.localStorage?.getItem(API_TOKEN_STORAGE_KEY) || "").trim();
  } catch (_err) {
    return "";
  }
}

function ensureApiToken() {
  let token = getStoredApiToken();
  if (!token) {
    token = (window.prompt("请输入 API Token（AGENT_TEAM_API_TOKEN）") || "").trim();
    if (token) {
      try {
        window.localStorage?.setItem(API_TOKEN_STORAGE_KEY, token);
      } catch (_err) {
        /* ignore quota / private mode */
      }
    }
  }
  return token;
}

const _nativeFetch = window.fetch.bind(window);
window.fetch = function apiFetch(input, init) {
  const options = init ? { ...init } : {};
  const url = typeof input === "string" ? input : input && input.url;
  const token = getStoredApiToken();
  if (token && typeof url === "string" && url.startsWith("/api/")) {
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    options.headers = headers;
  }
  return _nativeFetch(input, options);
};

ensureApiToken();

const terminalShell = document.getElementById("terminal-shell");
const terminalViewport = document.getElementById("terminal-viewport");
const terminalTitle = document.getElementById("terminal-title");
const kanbanProcessView = document.getElementById("kanban-process-view");
const kanbanProcessStatus = document.getElementById("kanban-process-status");
const kanbanProcessContent = document.getElementById("kanban-process-content");
const kanbanProcessRefresh = document.getElementById("kanban-process-refresh");
const eventList = terminalShell;
const agentList = document.getElementById("agent-list");
const agentEmpty = document.getElementById("agent-empty");
const sidebarStats = document.getElementById("sidebar-stats");
const openTeamsPage = document.getElementById("open-teams-page");
const teamsManageModal = document.getElementById("teams-manage-modal");
const createTeamForm = document.getElementById("create-team-form");
const createTeamError = document.getElementById("create-team-error");
const teamsManageList = document.getElementById("teams-manage-list");
const teamsManageDetail = document.getElementById("teams-manage-detail");
const openCreateAgent = document.getElementById("open-create-agent");
const openTeamSettings = document.getElementById("open-team-settings");
const modal = document.getElementById("create-agent-modal");
const createAgentForm = document.getElementById("create-agent-form");
const createAgentError = document.getElementById("create-agent-error");
const hermesProfileOptions = document.getElementById("hermes-profile-options");
const transferModal = document.getElementById("team-transfer-modal");
const transferAgentList = document.getElementById("transfer-agent-list");
const transferInlineSkills = document.getElementById("transfer-inline-skills");
const transferIncludeWorkspace = document.getElementById("transfer-include-workspace");
const transferExportSubmit = document.getElementById("transfer-export-submit");
const transferExportStatus = document.getElementById("transfer-export-status");
const transferImportFile = document.getElementById("transfer-import-file");
const transferFileName = document.getElementById("transfer-file-name");
const transferInspectSubmit = document.getElementById("transfer-inspect-submit");
const transferImportSubmit = document.getElementById("transfer-import-submit");
const transferImportStatus = document.getElementById("transfer-import-status");
const transferImportPreview = document.getElementById("transfer-import-preview");
const teamRuntimeStatus = document.getElementById("team-runtime-status");
const terminalDrawer = document.getElementById("terminal-drawer");
const openHistoryDrawer = document.getElementById("open-history-drawer");
const historyDrawer = document.getElementById("history-drawer");
const historyDrawerAgent = document.getElementById("history-drawer-agent");
const historyEmpty = document.getElementById("history-empty");
const interactionList = document.getElementById("interaction-list");
const soulDrawer = document.getElementById("soul-drawer");
const soulDrawerAgent = document.getElementById("soul-drawer-agent");
const soulDrawerPath = document.getElementById("soul-drawer-path");
const soulStatus = document.getElementById("soul-status");
const soulEditor = document.getElementById("soul-editor");
const soulPreview = document.getElementById("soul-preview");
const soulDirtyHint = document.getElementById("soul-dirty-hint");
const saveSoul = document.getElementById("save-soul");
const regenerateSoul = document.getElementById("regenerate-soul");
const skillsDrawer = document.getElementById("skills-drawer");
const skillsDrawerAgent = document.getElementById("skills-drawer-agent");
const skillsStatus = document.getElementById("skills-status");
const openSkillsInstall = document.getElementById("open-skills-install");
const skillsInstallModal = document.getElementById("skills-install-modal");
const skillsInstallForm = document.getElementById("skills-install-form");
const skillsAlphaNav = document.getElementById("skills-alpha-nav");
const skillsList = document.getElementById("skills-list");
const skillsEmpty = document.getElementById("skills-empty");
const skillsRefresh = document.getElementById("skills-refresh");
const skillsDetailTitle = document.getElementById("skills-detail-title");
const skillsDetailMeta = document.getElementById("skills-detail-meta");
const skillsDetailPath = document.getElementById("skills-detail-path");
const skillsPreview = document.getElementById("skills-preview");
const skillsReinstall = document.getElementById("skills-reinstall");
const skillsUninstall = document.getElementById("skills-uninstall");
const mcpDrawer = document.getElementById("mcp-drawer");
const mcpDrawerAgent = document.getElementById("mcp-drawer-agent");
const mcpStatus = document.getElementById("mcp-status");
const mcpList = document.getElementById("mcp-list");
const mcpEmpty = document.getElementById("mcp-empty");
const mcpRefresh = document.getElementById("mcp-refresh");
const openMcpEdit = document.getElementById("open-mcp-edit");
const mcpEditModal = document.getElementById("mcp-edit-modal");
const mcpEditForm = document.getElementById("mcp-edit-form");
const mcpEditTitle = document.getElementById("mcp-edit-title");
const mcpSaveTest = document.getElementById("mcp-save-test");
const agentModelDrawer = document.getElementById("agent-model-drawer");
const agentModelDrawerAgent = document.getElementById("agent-model-drawer-agent");
const agentModelStatus = document.getElementById("agent-model-status");
const agentModelCurrent = document.getElementById("agent-model-current");
const agentModelForm = document.getElementById("agent-model-form");
const agentModelSelect = document.getElementById("agent-model-select");
const saveAgentModel = document.getElementById("save-agent-model");
const createAgentModelConfig = document.getElementById("create-agent-model-config");
const modelConfigList = document.getElementById("model-config-list");
const modelConfigEmpty = document.getElementById("model-config-empty");
const modelConfigStatus = document.getElementById("model-config-status");
const openModelConfigEdit = document.getElementById("open-model-config-edit");
const modelConfigEditModal = document.getElementById("model-config-edit-modal");
const modelConfigEditForm = document.getElementById("model-config-edit-form");
const modelConfigEditTitle = document.getElementById("model-config-edit-title");
const modelConfigSaveTest = document.getElementById("model-config-save-test");
const kanbanTaskForm = document.getElementById("kanban-task-form");
const kanbanTaskInput = document.getElementById("kanban-task-input");
const kanbanTeamPicker = document.getElementById("kanban-team-picker");
const kanbanTeamSelect = document.getElementById("kanban-team-select");
let selectedKanbanTeam = "";
const kanbanAssigneeTrigger = document.getElementById("kanban-assignee-trigger");
const kanbanTaskStatus = document.getElementById("kanban-task-status");
const kanbanTaskList = document.getElementById("kanban-task-list");
const kanbanTeamOrnament = document.getElementById("kanban-team-ornament");
const kanbanPanelsToggle = document.getElementById("kanban-panels-toggle");
const kanbanRefresh = document.getElementById("kanban-refresh");
const kanbanAutoDispatch = document.getElementById("kanban-auto-dispatch");
const kanbanDispatch = document.getElementById("kanban-dispatch");
const terminalSessions = new Map();
const chatEventsByAgent = new Map();
const defaultTerminalCols = 120;
const defaultTerminalRows = 36;
const terminalReconnectDelay = 900;
const terminalUrlPattern = /https?:\/\/[^\s<>"'`]+/;
const hermesDebug = window.localStorage?.getItem("hermesDebug") !== "0";
let activeKanbanTerminalTaskId = "";
let activeKanbanTerminalLink = null;
let activeKanbanTerminalAgent = null;
let kanbanTerminalLogTimer = 0;
const kanbanTaskProcessSnapshots = new Map();
let kanbanPanelsAnimationTimer = 0;
let kanbanOrnamentAnimationId = 0;
let kanbanStatusTimer = 0;
let agentContextMenu = null;
let kanbanContextMenu = null;
let kanbanAssigneeMenu = null;
let selectedKanbanAssigneeId = "";
let deletingAgentId = "";
let confirmModal = null;
let resizeTimer = 0;
let hermesStatusPromise = null;
const overlayAnimationMs = 220;
const overlayCloseTimers = new WeakMap();
const overlayReturnFocus = new WeakMap();

function openAnimatedLayer(element, focusTarget = null, returnTarget = null) {
  if (!element) return;
  if (!element.classList.contains("is-open")) {
    const target = returnTarget instanceof HTMLElement ? returnTarget : document.activeElement;
    if (target instanceof HTMLElement) overlayReturnFocus.set(element, target);
  }
  const closeTimer = overlayCloseTimers.get(element);
  if (closeTimer) window.clearTimeout(closeTimer);
  element.hidden = false;
  const dialog = element.querySelector(".modal__panel");
  if (dialog) {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
  }
  element.classList.remove("is-closing");
  requestAnimationFrame(() => {
    if (element.hidden || element.classList.contains("is-closing")) return;
    element.classList.add("is-open");
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 80);
  });
}

function closeAnimatedLayer(element, afterClose = null) {
  if (!element || element.hidden) return;
  element.classList.remove("is-open");
  element.classList.add("is-closing");
  const closeTimer = window.setTimeout(() => {
    if (!element.classList.contains("is-open")) {
      element.hidden = true;
      element.classList.remove("is-closing");
      if (afterClose) afterClose();
      const returnTarget = overlayReturnFocus.get(element);
      overlayReturnFocus.delete(element);
      if (returnTarget?.isConnected) returnTarget.focus();
    }
  }, overlayAnimationMs);
  overlayCloseTimers.set(element, closeTimer);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function checkHermesStatus({ force = false } = {}) {
  if (force) hermesStatusPromise = null;
  if (!hermesStatusPromise) {
    const request = fetch("/api/hermes/status", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        return { response, data };
      });
    hermesStatusPromise = request;
    request.finally(() => {
      if (hermesStatusPromise === request) hermesStatusPromise = null;
    });
  }
  return hermesStatusPromise;
}
const soulState = {
  agentId: "",
  runtimeStatus: "stopped",
  originalContent: "",
  saving: false,
  regenerating: false,
  pollTimer: 0,
  scrollSyncSource: "",
  scrollSyncTimer: 0,
};
const skillsState = {
  agentId: "",
  agentName: "",
  items: [],
  selectedSlug: "",
  loading: false,
  detailRequestId: 0,
  activeLetter: "ALL",
};
const mcpState = {
  agentId: "",
  agentName: "",
  items: [],
  editingName: "",
};
const modelConfigState = {
  items: [],
  loading: false,
  editingId: "",
  agentId: "",
  agentName: "",
};
const teamRuntimeLabels = {
  start: "启动",
  stop: "关闭",
  restart: "重启",
};
const kanbanPanelsStorageKey = "hermesKanbanPanelsExpanded";
const kanbanAutoUnblockDelayMs = 5000;
const KANBAN_TERMINAL_STATUSES = new Set(["done", "archived", "blocked", "failed", "crashed", "timed_out", "gave_up"]);
const kanbanState = {
  links: Array.isArray(window.__BOOTSTRAP__?.kanban_task_links)
    ? window.__BOOTSTRAP__.kanban_task_links.filter((link) => String(link?.kanban_status || "").toLowerCase() !== "archived")
    : [],
  loading: false,
  autoDispatchEnabled: false,
  autoDispatchIntervalMs: 5000,
  autoDispatchTimer: 0,
  autoDispatchRunning: false,
  panelsExpanded: window.localStorage?.getItem(kanbanPanelsStorageKey) === "1",
  deletingTaskIds: new Set(),
  blockedTaskEnteredAt: new Map(),
  autoUnblockTaskIds: new Set(),
  autoUnblockTimer: 0,
  pendingCreations: [],
};
let transferLastInspectedFile = null;
const notificationAgentStates = new Map();
const notificationLastPlayedAt = new Map();
const notificationInteractionStates = new Set(["awaiting_approval", "awaiting_selection", "awaiting_input"]);
let notificationAudioContext = null;

const SKILL_ALPHA_OPTIONS = ["ALL", ...Array.from({ length: 26 }, (_item, index) => String.fromCharCode(65 + index))];

function debugLog(event, payload) {
  if (!hermesDebug) return;
  console.log(`[hermes-debug] ${event}`, payload);
}

function normalizeTerminalUrl(url) {
  let normalizedUrl = String(url || "").replace(/[,.!?，。；！？、]+$/u, "");
  while (normalizedUrl.endsWith(")")) {
    const openParens = (normalizedUrl.match(/\(/g) || []).length;
    const closeParens = (normalizedUrl.match(/\)/g) || []).length;
    if (closeParens <= openParens) break;
    normalizedUrl = normalizedUrl.slice(0, -1);
  }
  return normalizedUrl;
}

function openTerminalUrl(url) {
  const normalizedUrl = normalizeTerminalUrl(url);
  if (!normalizedUrl) return;
  window.open(normalizedUrl, "_blank", "noopener,noreferrer");
}

function registerTerminalUrlLinks(term) {
  if (!term) return;
  if (window.WebLinksAddon?.WebLinksAddon) {
    term.loadAddon(new WebLinksAddon.WebLinksAddon((_event, url) => openTerminalUrl(url), {
      urlRegex: terminalUrlPattern,
    }));
    return;
  }
  if (typeof term.registerLinkMatcher === "function") {
    term.registerLinkMatcher(terminalUrlPattern, (_event, url) => openTerminalUrl(url), {
      tooltipCallback: (_event, url) => `打开 ${normalizeTerminalUrl(url)}`,
    });
  }
}

function getNotificationAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!notificationAudioContext) notificationAudioContext = new AudioContextClass();
  return notificationAudioContext;
}

function unlockNotificationAudio() {
  const context = getNotificationAudioContext();
  if (context?.state === "suspended") context.resume().catch(() => {});
}

function playTone(context, { start, duration, frequency, type = "sine", volume = 0.055 }) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNotificationSound(kind, agentId) {
  if (window.localStorage?.getItem("hermesSound") === "0") return;
  const now = Date.now();
  const dedupeKey = `${kind}:${agentId || "global"}`;
  if (now - (notificationLastPlayedAt.get(dedupeKey) || 0) < 3000) return;
  notificationLastPlayedAt.set(dedupeKey, now);
  const context = getNotificationAudioContext();
  if (!context) return;
  if (context.state === "suspended") context.resume().catch(() => {});
  const start = context.currentTime + 0.02;
  if (kind === "taskDone") {
    playTone(context, { start, duration: 0.11, frequency: 660, type: "sine", volume: 0.045 });
    playTone(context, { start: start + 0.105, duration: 0.14, frequency: 880, type: "sine", volume: 0.05 });
    return;
  }
  playTone(context, { start, duration: 0.12, frequency: 523.25, type: "triangle", volume: 0.06 });
  playTone(context, { start: start + 0.16, duration: 0.12, frequency: 392, type: "triangle", volume: 0.06 });
}

function isLeaderAgent(agent) {
  return agent?.is_leader || agent?.role === "leader";
}

function isAgentDispatchable(agent) {
  return Boolean(agent)
    && (agent.readiness_status || "ready") === "ready"
    && (agent.runtime_status || "stopped") === "running";
}

function getNotificationSnapshot(agent) {
  const displayStatus = getAgentDisplayStatus(agent).className;
  const interactionState = agent.interaction_state || "idle";
  return {
    displayStatus,
    needsIntervention: notificationInteractionStates.has(interactionState),
  };
}

function hydrateNotificationStates(agents) {
  if (!Array.isArray(agents)) return;
  agents.forEach((agent) => {
    if (agent?.agent_id) notificationAgentStates.set(agent.agent_id, getNotificationSnapshot(agent));
  });
}

function processSoundNotifications(agents) {
  if (!Array.isArray(agents)) return;
  const currentIds = new Set();
  agents.forEach((agent) => {
    if (!agent?.agent_id) return;
    currentIds.add(agent.agent_id);
    const previous = notificationAgentStates.get(agent.agent_id);
    const current = getNotificationSnapshot(agent);
    if (previous) {
      if (isLeaderAgent(agent) && previous.displayStatus === "busy" && current.displayStatus === "idle") {
        playNotificationSound("taskDone", agent.agent_id);
      }
      if (!previous.needsIntervention && current.needsIntervention) {
        playNotificationSound("needsIntervention", agent.agent_id);
      }
    }
    notificationAgentStates.set(agent.agent_id, current);
  });
  Array.from(notificationAgentStates.keys()).forEach((agentId) => {
    if (!currentIds.has(agentId)) notificationAgentStates.delete(agentId);
  });
}

document.addEventListener("pointerdown", unlockNotificationAudio, { once: true, passive: true });
document.addEventListener("keydown", unlockNotificationAudio, { once: true });

function summarizeTerminalText(value) {
  const text = String(value || "");
  const ansiMatches = text.match(/\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|[@-Z\\-_])/g) || [];
  const suspiciousControls = Array.from(text).filter((char) => {
    const code = char.charCodeAt(0);
    return (code < 32 && !["\n", "\r", "\t", "\x1b"].includes(char)) || code === 127;
  });
  return {
    length: text.length,
    ansiCount: ansiMatches.length,
    suspiciousControlCount: suspiciousControls.length,
    hasReplacementChar: text.includes("\ufffd"),
    preview: JSON.stringify(text.slice(0, 160)),
    tailPreview: JSON.stringify(text.slice(-160)),
    suspiciousControls: suspiciousControls.slice(0, 12).map((char) => char.charCodeAt(0)),
  };
}

function logTerminalPayload(event, session, payload) {
  if (!hermesDebug || !session) return;
  const data = typeof payload?.data === "string" ? payload.data : "";
  const summary = summarizeTerminalText(data);
  debugLog(event, {
    agentId: session.agentId,
    type: payload?.type,
    ...summary,
  });
  if (summary.hasReplacementChar || summary.suspiciousControlCount > 0) {
    console.warn(`[hermes-terminal] suspicious ${event}`, {
      agentId: session.agentId,
      type: payload?.type,
      ...summary,
    });
  }
}

function restoreTerminalSnapshot(session, payload) {
  if (!session) return false;
  const snapshotAnsi = String(payload?.snapshot_ansi || "");
  if (!snapshotAnsi) return false;
  debugLog("terminal-snapshot-restore", {
    agentId: session.agentId,
    ansiSummary: summarizeTerminalText(snapshotAnsi),
    textLength: String(payload?.snapshot_text || "").length,
  });
  session.term.reset();
  session.term.clear();
  session.term.write(snapshotAnsi);
  session.hasRenderedOutput = true;
  return true;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setKanbanStatus(message, kind = "muted") {
  if (!kanbanTaskStatus) return;
  if (kanbanStatusTimer) {
    window.clearTimeout(kanbanStatusTimer);
    kanbanStatusTimer = 0;
  }
  kanbanTaskStatus.textContent = message || "";
  kanbanTaskStatus.hidden = !message;
  kanbanTaskStatus.classList.toggle("hidden", !message);
  kanbanTaskStatus.dataset.kind = kind;
  if (message && kind !== "muted") {
    kanbanStatusTimer = window.setTimeout(() => {
      kanbanTaskStatus.hidden = true;
      kanbanTaskStatus.classList.add("hidden");
      kanbanStatusTimer = 0;
    }, kind === "error" ? 5200 : 3200);
  }
}

function renderKanbanPanelsToggle() {
  if (!kanbanTaskList || !kanbanPanelsToggle) return;
  kanbanTaskList.hidden = false;
  if (kanbanTeamOrnament) {
    kanbanTeamOrnament.classList.toggle("is-hidden", kanbanState.panelsExpanded);
    kanbanTeamOrnament.setAttribute("aria-hidden", kanbanState.panelsExpanded ? "true" : "false");
  }
  if (kanbanPanelsAnimationTimer) {
    window.clearTimeout(kanbanPanelsAnimationTimer);
    kanbanPanelsAnimationTimer = 0;
  }
  if (kanbanState.panelsExpanded) {
    kanbanTaskList.classList.remove("is-collapsed", "is-collapsing");
    kanbanTaskList.classList.add("is-expanded");
  } else if (kanbanTaskList.classList.contains("is-expanded")) {
    kanbanTaskList.classList.remove("is-expanded");
    kanbanTaskList.classList.add("is-collapsing");
    kanbanPanelsAnimationTimer = window.setTimeout(() => {
      kanbanTaskList.classList.remove("is-collapsing");
      kanbanTaskList.classList.add("is-collapsed");
      kanbanPanelsAnimationTimer = 0;
    }, 220);
  } else {
    kanbanTaskList.classList.remove("is-expanded", "is-collapsing");
    kanbanTaskList.classList.add("is-collapsed");
  }
  kanbanTaskList.setAttribute("aria-hidden", kanbanState.panelsExpanded ? "false" : "true");
  kanbanPanelsToggle.classList.toggle("is-expanded", kanbanState.panelsExpanded);
  kanbanPanelsToggle.setAttribute("aria-expanded", kanbanState.panelsExpanded ? "true" : "false");
  kanbanPanelsToggle.setAttribute("aria-label", kanbanState.panelsExpanded ? "收起看板面板" : "展开看板面板");
  kanbanPanelsToggle.title = kanbanState.panelsExpanded ? "收起看板面板" : "展开看板面板";
}

function toggleKanbanPanels() {
  kanbanState.panelsExpanded = !kanbanState.panelsExpanded;
  window.localStorage?.setItem(kanbanPanelsStorageKey, kanbanState.panelsExpanded ? "1" : "0");
  renderKanbanPanelsToggle();
}

function initKanbanTeamOrnamentMotion() {
  if (!kanbanTeamOrnament || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const linkPath = kanbanTeamOrnament.querySelector("[data-team-ornament-links]");
  const nodes = Array.from(kanbanTeamOrnament.querySelectorAll("[data-team-ornament-node]"));
  const core = nodes.find((node) => node.dataset.teamOrnamentNode === "core");
  if (!linkPath || !core || !nodes.length) return;

  const configs = nodes.map((node, index) => ({
    node,
    baseX: Number(node.getAttribute("cx")) || 0,
    baseY: Number(node.getAttribute("cy")) || 0,
    ampX: index === 0 ? 9 : 12 + ((index * 5) % 10),
    ampY: index === 0 ? 7 : 10 + ((index * 7) % 12),
    speedX: 0.00022 + index * 0.00004,
    speedY: 0.00018 + index * 0.000045,
    phaseX: index * 1.77 + 0.4,
    phaseY: index * 2.13 + 1.1,
  }));

  const update = (time) => {
    const positions = new Map();
    configs.forEach((config) => {
      const x = config.baseX + Math.sin(time * config.speedX + config.phaseX) * config.ampX;
      const y = config.baseY + Math.cos(time * config.speedY + config.phaseY) * config.ampY;
      config.node.setAttribute("cx", x.toFixed(2));
      config.node.setAttribute("cy", y.toFixed(2));
      positions.set(config.node.dataset.teamOrnamentNode, { x, y });
    });

    const center = positions.get("core");
    const linkTargets = ["mint", "sky", "lilac", "peach", "rose"];
    linkPath.setAttribute(
      "d",
      linkTargets
        .map((key) => {
          const target = positions.get(key);
          return target ? `M${center.x.toFixed(2)} ${center.y.toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}` : "";
        })
        .filter(Boolean)
        .join(""),
    );
    kanbanOrnamentAnimationId = window.requestAnimationFrame(update);
  };

  if (kanbanOrnamentAnimationId) window.cancelAnimationFrame(kanbanOrnamentAnimationId);
  kanbanOrnamentAnimationId = window.requestAnimationFrame(update);
}

function kanbanRoleLabel(role) {
  if (role === "parent") return "父任务";
  if (role === "worker") return "Worker";
  if (role === "summary") return "汇总";
  if (role === "review") return "Review";
  if (role === "human_input") return "人工处理";
  if (role === "human_continuation") return "继续执行";
  return role || "任务";
}

function kanbanStatusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (value === "waiting_human") return "待人工处理";
  if (value === "pending_dispatch") return "待派发";
  if (value === "ready") return "待执行";
  if (value === "todo") return "待处理";
  if (value === "triage") return "待分诊";
  if (value === "running") return "执行中";
  if (value === "done") return "已完成";
  if (value === "archived") return "已归档";
  if (value === "blocked") return "已阻塞";
  if (value === "failed") return "失败";
  if (value === "crashed") return "异常";
  if (value === "timed_out") return "超时";
  if (value === "gave_up") return "已放弃";
  return "未知";
}

function kanbanDisplayStatus(link) {
  if (link?.kanban_role === "human_input") {
    const value = String(link?.kanban_status || "").toLowerCase();
    if (!KANBAN_TERMINAL_STATUSES.has(value)) return "waiting_human";
  }
  return link?.kanban_status || "";
}

function kanbanColumnForStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "waiting_human") return "blocked";
  if (value === "running") return "running";
  if (value === "done" || value === "archived") return "done";
  if (["blocked", "failed", "crashed", "timed_out", "gave_up"].includes(value)) return "blocked";
  if (value === "pending_dispatch" || value === "ready" || value === "todo" || value === "triage") return "ready";
  return "unknown";
}

function hasDispatchableKanbanTask() {
  return (kanbanState.links || []).some((link) => {
    const status = String(link.kanban_status || "").toLowerCase();
    return status === "pending_dispatch" && isAgentDispatchable(agentForKanbanLink(link));
  });
}

function agentForKanbanLink(link) {
  const profileName = String(link?.assignee_profile || "").trim();
  if (!profileName) return null;
  const agents = Array.isArray(window.__BOOTSTRAP__?.agents) ? window.__BOOTSTRAP__.agents : [];
  return agents.find((agent) => agent.profile_name === profileName) || null;
}

function openKanbanLinkTerminal(link) {
  const agent = agentForKanbanLink(link);
  if (!agent) {
    setKanbanStatus(`找不到 assignee_profile=${link?.assignee_profile || "unassigned"} 对应的 Agent。`, "error");
    return;
  }
  if ((agent.readiness_status || "ready") !== "ready") {
    setKanbanStatus(`${agent.name || agent.agent_id} 尚未就绪，无法打开终端。`, "error");
    return;
  }
  setSelectedAgent(agent.agent_id, agent.name, true, { allowStopped: true });
  showKanbanTaskLogInTerminal(link, agent);
  openTerminalPanel();
}

function openKanbanTask(link) {
  if (kanbanTaskCanAnswer(link)) {
    answerHumanInputTask(link);
    return;
  }
  openKanbanLinkTerminal(link);
}

function setKanbanProcessMode(enabled) {
  if (kanbanProcessView) kanbanProcessView.hidden = !enabled;
  if (terminalViewport) terminalViewport.hidden = enabled;
}

function clearKanbanTerminalLog() {
  activeKanbanTerminalTaskId = "";
  activeKanbanTerminalLink = null;
  activeKanbanTerminalAgent = null;
  if (kanbanTerminalLogTimer) {
    window.clearTimeout(kanbanTerminalLogTimer);
    kanbanTerminalLogTimer = 0;
  }
  setKanbanProcessMode(false);
}

function normalizeTerminalLogText(value) {
  return String(value || "").replace(/\r\n?/g, "\n");
}

function longerText(current, candidate) {
  const previous = String(current || "");
  const next = String(candidate || "");
  return next.length >= previous.length ? next : previous;
}

function mergeKanbanTaskDetails(previous, incoming, link) {
  const old = previous || {};
  const payload = incoming?.task || {};
  const task = payload.task || payload;
  const incomingRuns = Array.isArray(incoming?.runs)
    ? incoming.runs
    : (Array.isArray(payload.runs) ? payload.runs : []);
  const oldRuns = Array.isArray(old.runs) ? old.runs : [];
  return {
    task: {...(old.task || {}), ...(task || {})},
    latest_summary: payload.latest_summary || old.latest_summary || "",
    context: longerText(old.context, incoming?.context || task?.body),
    log: longerText(old.log, incoming?.log),
    runs: incomingRuns.length >= oldRuns.length ? incomingRuns : oldRuns,
    link: {...(old.link || {}), ...(link || {})},
    errors: {...(old.errors || {}), ...(incoming?.errors || {})},
  };
}

function formatKanbanTaskDetails(details) {
  const task = details?.task || {};
  const runs = Array.isArray(details?.runs) ? details.runs : [];
  const parts = [];
  if (details?.context || task.body) {
    parts.push("## 模型实际提示词 / Worker Context\n" + normalizeTerminalLogText(details.context || task.body));
  }
  const result = task.result || details?.link?.last_result || "";
  if (result) parts.push("## 模型输出 / Task Result\n" + normalizeTerminalLogText(result));
  if (details?.latest_summary) {
    parts.push("## 运行摘要\n" + normalizeTerminalLogText(details.latest_summary));
  }
  if (runs.length) {
    const runLines = runs.map((run) => [
      "run_id=" + (run.id ?? "-"),
      "profile=" + (run.profile || "-"),
      "status=" + (run.status || run.outcome || "-"),
      run.summary ? "summary=" + run.summary : "",
      run.error ? "error=" + run.error : "",
    ].filter(Boolean).join(" · "));
    parts.push("## Runs\n" + runLines.join("\n"));
  }
  if (details?.log) parts.push("## 原始 Worker 日志\n" + normalizeTerminalLogText(details.log));
  return parts.join("\n\n");
}

function kanbanProcessLabel(link, note = "", isError = false) {
  const status = String(link?.kanban_status || "").toLowerCase();
  if (isError) return "刷新失败，已保留上次记录 · " + note;
  if (["done", "completed"].includes(status)) return "任务已完成 · 处理记录已保留";
  if (["blocked", "failed", "crashed", "timed_out", "gave_up"].includes(status)) {
    return "任务已停止 · 处理记录已保留";
  }
  return note || "任务处理中 · 记录每 2.5 秒更新";
}

function renderKanbanTaskProcess(link, agent, snapshot, note = "", isError = false) {
  if (!kanbanProcessView || !kanbanProcessContent) return;
  setKanbanProcessMode(true);
  const body = formatKanbanTaskDetails(snapshot?.details);
  const content = [
    "● Kanban Task " + (link?.kanban_task_id || ""),
    (agent?.name || agent?.agent_id || link?.assignee_profile || "Agent")
      + " · " + (link?.assignee_profile || "unassigned")
      + " · " + kanbanStatusLabel(link?.kanban_status),
    "",
    body || "暂无处理记录。任务可能刚启动，可点击“刷新记录”再次获取。",
  ].join("\n");
  const wasNearBottom = kanbanProcessContent.scrollHeight
    - kanbanProcessContent.clientHeight
    - kanbanProcessContent.scrollTop < 28;
  const previousScrollTop = kanbanProcessContent.scrollTop;
  if (kanbanProcessContent.textContent !== content) kanbanProcessContent.textContent = content;
  if (wasNearBottom) kanbanProcessContent.scrollTop = kanbanProcessContent.scrollHeight;
  else kanbanProcessContent.scrollTop = previousScrollTop;
  if (kanbanProcessStatus) {
    kanbanProcessStatus.textContent = kanbanProcessLabel(link, note, isError);
    kanbanProcessStatus.dataset.kind = isError ? "error" : "normal";
  }
}

async function refreshKanbanTaskLog(link, agent) {
  const taskId = link?.kanban_task_id || "";
  if (!taskId || activeKanbanTerminalTaskId !== taskId) return;
  if (kanbanProcessRefresh) kanbanProcessRefresh.disabled = true;
  let snapshot = kanbanTaskProcessSnapshots.get(taskId) || {details: {}, updatedAt: 0};
  try {
    const response = await fetch("/api/kanban/tasks/" + encodeURIComponent(taskId) + "/details?tail=200000");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Kanban 详情加载失败");
    if (activeKanbanTerminalTaskId !== taskId) return;
    const latestLink = data.link || link;
    snapshot = {
      details: mergeKanbanTaskDetails(snapshot.details, data, latestLink),
      updatedAt: Date.now(),
    };
    kanbanTaskProcessSnapshots.set(taskId, snapshot);
    activeKanbanTerminalLink = {...link, ...latestLink};
    renderKanbanTaskProcess(activeKanbanTerminalLink, agent, snapshot);
  } catch (error) {
    if (activeKanbanTerminalTaskId !== taskId) return;
    renderKanbanTaskProcess(link, agent, snapshot, error.message || "Kanban 详情加载失败", true);
  } finally {
    if (activeKanbanTerminalTaskId === taskId && kanbanProcessRefresh) kanbanProcessRefresh.disabled = false;
  }
  const status = String(activeKanbanTerminalLink?.kanban_status || link?.kanban_status || "").toLowerCase();
  if (activeKanbanTerminalTaskId === taskId && ["pending_dispatch", "running", "ready", "todo", "triage"].includes(status)) {
    kanbanTerminalLogTimer = window.setTimeout(async () => {
      await refreshKanbanTasks({ silent: true });
      const latest = (kanbanState.links || []).find((item) => item.kanban_task_id === taskId)
        || activeKanbanTerminalLink
        || link;
      activeKanbanTerminalLink = latest;
      refreshKanbanTaskLog(latest, agent);
    }, 2500);
  }
}

function showKanbanTaskLogInTerminal(link, agent) {
  const taskId = link?.kanban_task_id || "";
  if (!taskId) return;
  clearKanbanTerminalLog();
  activeKanbanTerminalTaskId = taskId;
  activeKanbanTerminalLink = link;
  activeKanbanTerminalAgent = agent;
  const session = terminalSessions.get(agent.agent_id);
  if (session) disconnectTerminalSession(session);
  if (terminalTitle) terminalTitle.textContent = (agent.name || agent.agent_id) + " · Kanban " + taskId;
  const snapshot = kanbanTaskProcessSnapshots.get(taskId) || {details: {}, updatedAt: 0};
  renderKanbanTaskProcess(link, agent, snapshot, snapshot.updatedAt ? "正在刷新已保存的处理记录…" : "正在加载任务处理过程…");
  refreshKanbanTaskLog(link, agent);
}
function kanbanTaskCanUnblock(link) {
  return kanbanColumnForStatus(link?.kanban_status) === "blocked";
}

async function unblockKanbanTask(taskId) {
  return postKanbanTaskAction(taskId, "/unblock", { method: "POST" });
}

function clearKanbanAutoUnblockTimer() {
  if (!kanbanState.autoUnblockTimer) return;
  window.clearTimeout(kanbanState.autoUnblockTimer);
  kanbanState.autoUnblockTimer = 0;
}

function syncKanbanAutoUnblock() {
  clearKanbanAutoUnblockTimer();
  const now = Date.now();
  const blockedIds = new Set();
  let nextDelay = Infinity;
  (kanbanState.links || []).forEach((link) => {
    const taskId = link?.kanban_task_id || "";
    if (!taskId || !kanbanTaskCanUnblock(link) || kanbanState.deletingTaskIds.has(taskId)) return;
    blockedIds.add(taskId);
    if (!kanbanState.blockedTaskEnteredAt.has(taskId)) {
      kanbanState.blockedTaskEnteredAt.set(taskId, now);
    }
    if (kanbanState.autoUnblockTaskIds.has(taskId)) return;
    const elapsed = now - kanbanState.blockedTaskEnteredAt.get(taskId);
    nextDelay = Math.min(nextDelay, Math.max(0, kanbanAutoUnblockDelayMs - elapsed));
  });
  Array.from(kanbanState.blockedTaskEnteredAt.keys()).forEach((taskId) => {
    if (!blockedIds.has(taskId)) kanbanState.blockedTaskEnteredAt.delete(taskId);
  });
  if (!Number.isFinite(nextDelay)) return;
  kanbanState.autoUnblockTimer = window.setTimeout(runKanbanAutoUnblock, nextDelay);
}

async function runKanbanAutoUnblock() {
  clearKanbanAutoUnblockTimer();
  const now = Date.now();
  const targets = (kanbanState.links || []).filter((link) => {
    const taskId = link?.kanban_task_id || "";
    if (!taskId || !kanbanTaskCanUnblock(link)) return false;
    if (kanbanState.deletingTaskIds.has(taskId) || kanbanState.autoUnblockTaskIds.has(taskId)) return false;
    const enteredAt = kanbanState.blockedTaskEnteredAt.get(taskId) || now;
    return now - enteredAt >= kanbanAutoUnblockDelayMs;
  });
  if (!targets.length) {
    syncKanbanAutoUnblock();
    return;
  }
  await Promise.allSettled(targets.map(async (link) => {
    const taskId = link.kanban_task_id;
    kanbanState.autoUnblockTaskIds.add(taskId);
    try {
      await unblockKanbanTask(taskId);
      kanbanState.blockedTaskEnteredAt.delete(taskId);
      setKanbanStatus(`已自动解除阻塞：${taskId}`, "success");
    } catch (error) {
      setKanbanStatus(error.message || "自动解除阻塞失败", "error");
    } finally {
      kanbanState.autoUnblockTaskIds.delete(taskId);
    }
  }));
  syncKanbanAutoUnblock();
}

function kanbanTaskCanDispatch(link) {
  const value = String(link?.kanban_status || "").toLowerCase();
  return ["pending_dispatch", "ready"].includes(value)
    && Boolean(link?.assignee_profile)
    && isAgentDispatchable(agentForKanbanLink(link));
}

function kanbanTaskCanArchive(link) {
  return Boolean(link?.kanban_task_id);
}

function kanbanTaskCanAnswer(link) {
  return link?.kanban_role === "human_input"
    && !KANBAN_TERMINAL_STATUSES.has(String(link?.kanban_status || "").toLowerCase());
}

function renderKanbanTeamOptions() {
  if (!kanbanTeamSelect || !kanbanTeamPicker) return;
  const teams = window.__BOOTSTRAP__?.teams || [];
  if (!teams.some((team) => team.slug === selectedKanbanTeam)) selectedKanbanTeam = "";
  const hasTeams = teams.length > 0;
  kanbanTeamPicker.hidden = !hasTeams;
  if (!hasTeams) {
    selectedKanbanTeam = "";
    kanbanTeamSelect.innerHTML = '<option value="">全部团队</option>';
    return;
  }
  const options = [`<option value="">全部</option>`]
    .concat(teams.map((t) => `<option value="${escapeHtml(t.slug)}"${t.slug === selectedKanbanTeam ? " selected" : ""}>${escapeHtml(t.name)}</option>`));
  kanbanTeamSelect.innerHTML = options.join("");
}

kanbanTeamSelect?.addEventListener("change", () => {
  selectedKanbanTeam = kanbanTeamSelect.value;
  const boardSelect = document.getElementById("board-team-select");
  if (boardSelect) boardSelect.value = selectedKanbanTeam;
  renderKanbanTasks();
  renderKanbanAssigneeOptions(window.__BOOTSTRAP__?.agents || []);
  refreshKanbanTasks({ silent: true });
});

function kanbanAgentMatchesTeam(agent) {
  if (!selectedKanbanTeam) return true;
  const teams = window.__BOOTSTRAP__?.teams || [];
  const team = teams.find((t) => t.slug === selectedKanbanTeam);
  return !!team && agent.team_id === team.team_id;
}

function renderKanbanAssigneeOptions(agents = window.__BOOTSTRAP__?.agents || []) {
  if (!kanbanAssigneeTrigger) return;
  renderKanbanTeamOptions();
  const previous = selectedKanbanAssigneeId;
  const dispatchableAgents = (Array.isArray(agents) ? agents : []).filter(isAgentDispatchable).filter(kanbanAgentMatchesTeam);
  const leaders = dispatchableAgents.filter((agent) => agent.role === "leader");
  const workers = dispatchableAgents.filter((agent) => agent.role === "worker");
  const options = [...leaders, ...workers];
  const fallback = leaders[0]?.agent_id || options[0]?.agent_id || "";
  selectedKanbanAssigneeId = options.some((agent) => agent.agent_id === previous) ? previous : fallback;
  const selected = options.find((agent) => agent.agent_id === selectedKanbanAssigneeId);
  const label = selected ? (selected.name || selected.agent_id) : "Leader";
  const labelNode = kanbanAssigneeTrigger.querySelector("span");
  if (labelNode) labelNode.textContent = label;
  kanbanAssigneeTrigger.disabled = options.length === 0;
  if (!kanbanAssigneeMenu) return;
  kanbanAssigneeMenu.innerHTML = options
    .map((agent) => {
      const name = agent.name || agent.agent_id;
      return `<button class="agent-context-menu__item kanban-assignee-menu__item${agent.agent_id === selectedKanbanAssigneeId ? " is-active" : ""}" type="button" data-kanban-assignee-id="${escapeHtml(agent.agent_id)}">${escapeHtml(name)}</button>`;
    })
    .join("");
}

function ensureKanbanAssigneeMenu() {
  if (kanbanAssigneeMenu) return kanbanAssigneeMenu;
  kanbanAssigneeMenu = document.createElement("div");
  kanbanAssigneeMenu.className = "agent-context-menu kanban-assignee-menu";
  kanbanAssigneeMenu.hidden = true;
  kanbanAssigneeMenu.addEventListener("click", (event) => {
    event.stopPropagation();
    const item = event.target.closest("[data-kanban-assignee-id]");
    if (!item) return;
    selectedKanbanAssigneeId = item.dataset.kanbanAssigneeId || "";
    renderKanbanAssigneeOptions(window.__BOOTSTRAP__?.agents || []);
    closeKanbanAssigneeMenu();
  });
  document.body.appendChild(kanbanAssigneeMenu);
  return kanbanAssigneeMenu;
}

function openKanbanAssigneeMenu() {
  if (!kanbanAssigneeTrigger || kanbanAssigneeTrigger.disabled) return;
  closeAgentContextMenu();
  closeKanbanContextMenu();
  const menu = ensureKanbanAssigneeMenu();
  renderKanbanAssigneeOptions(window.__BOOTSTRAP__?.agents || []);
  const rect = kanbanAssigneeTrigger.getBoundingClientRect();
  positionAgentContextMenu(menu, rect.left, rect.bottom + 10);
  kanbanAssigneeTrigger.setAttribute("aria-expanded", "true");
}

function closeKanbanAssigneeMenu() {
  if (!kanbanAssigneeMenu) return;
  kanbanAssigneeMenu.hidden = true;
  kanbanAssigneeTrigger?.setAttribute("aria-expanded", "false");
}

function ensureKanbanContextMenu() {
  if (kanbanContextMenu) return kanbanContextMenu;
  kanbanContextMenu = document.createElement("div");
  kanbanContextMenu.className = "agent-context-menu kanban-context-menu";
  kanbanContextMenu.hidden = true;
  kanbanContextMenu.innerHTML = `
    <button class="agent-context-menu__item" type="button" data-kanban-open>
      查看详情
    </button>
    <button class="agent-context-menu__item" type="button" data-kanban-dispatch>
      派发
    </button>
    <button class="agent-context-menu__item" type="button" data-kanban-unblock>
      解除阻塞
    </button>
    <button class="agent-context-menu__item" type="button" data-kanban-answer>
      回答
    </button>
    <button class="agent-context-menu__item agent-context-menu__item--danger" type="button" data-kanban-archive>
      删除
    </button>
  `;
  kanbanContextMenu.addEventListener("click", handleKanbanContextMenuClick);
  document.body.appendChild(kanbanContextMenu);
  return kanbanContextMenu;
}

function currentKanbanContextLink() {
  const taskId = kanbanContextMenu?.dataset.taskId || "";
  return (kanbanState.links || []).find((link) => link.kanban_task_id === taskId) || null;
}

function showKanbanTaskContextMenu(event, link) {
  event.preventDefault();
  event.stopPropagation();
  closeAgentContextMenu();
  const menu = ensureKanbanContextMenu();
  const dispatchBtn = menu.querySelector("[data-kanban-dispatch]");
  const unblockBtn = menu.querySelector("[data-kanban-unblock]");
  const answerBtn = menu.querySelector("[data-kanban-answer]");
  const archiveBtn = menu.querySelector("[data-kanban-archive]");
  menu.dataset.taskId = link?.kanban_task_id || "";
  menu.dataset.localId = link?.local_id || "";
  if (dispatchBtn) {
    const canDispatch = kanbanTaskCanDispatch(link);
    dispatchBtn.hidden = !canDispatch;
    dispatchBtn.disabled = !canDispatch;
  }
  if (unblockBtn) {
    const canUnblock = kanbanTaskCanUnblock(link);
    unblockBtn.hidden = !canUnblock;
    unblockBtn.disabled = !canUnblock;
    unblockBtn.textContent = "解除阻塞";
  }
  if (answerBtn) {
    const canAnswer = kanbanTaskCanAnswer(link);
    answerBtn.hidden = !canAnswer;
    answerBtn.disabled = !canAnswer;
  }
  if (archiveBtn) {
    const canArchive = kanbanTaskCanArchive(link);
    archiveBtn.hidden = !canArchive;
    archiveBtn.disabled = !canArchive;
    archiveBtn.textContent = "删除";
  }
  positionAgentContextMenu(menu, event.clientX, event.clientY);
}

function closeKanbanContextMenu() {
  if (!kanbanContextMenu) return;
  kanbanContextMenu.hidden = true;
  kanbanContextMenu.dataset.taskId = "";
  kanbanContextMenu.dataset.localId = "";
}

async function postKanbanTaskAction(taskId, action, options = {}) {
  const response = await fetch(`/api/kanban/tasks/${encodeURIComponent(taskId)}${action}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "Kanban 操作失败");
  kanbanState.links = Array.isArray(data.links) ? data.links : kanbanState.links;
  renderKanbanTasks();
  return data;
}

async function handleKanbanContextMenuClick(event) {
  event.stopPropagation();
  const link = currentKanbanContextLink();
  const taskId = link?.kanban_task_id || kanbanContextMenu?.dataset.taskId || "";
  if (!taskId) return;
  if (event.target.closest("[data-kanban-open]")) {
    closeKanbanContextMenu();
    openKanbanLinkTerminal(link);
    return;
  }
  const dispatchBtn = event.target.closest("[data-kanban-dispatch]");
  if (dispatchBtn && !dispatchBtn.disabled) {
    dispatchBtn.disabled = true;
    closeKanbanContextMenu();
    setKanbanStatus(`正在派发：${taskId}…`);
    try {
      await postKanbanTaskAction(taskId, "/dispatch", { method: "POST" });
      setKanbanStatus(`已派发：${taskId}`, "success");
    } catch (error) {
      setKanbanStatus(error.message || "派发失败", "error");
      dispatchBtn.disabled = false;
    }
    return;
  }
  const unblockBtn = event.target.closest("[data-kanban-unblock]");
  if (unblockBtn && !unblockBtn.disabled) {
    unblockBtn.disabled = true;
    try {
      await unblockKanbanTask(taskId);
      setKanbanStatus(`已解除阻塞：${taskId}`, "success");
      closeKanbanContextMenu();
    } catch (error) {
      setKanbanStatus(error.message || "解除阻塞失败", "error");
      unblockBtn.disabled = false;
    }
    return;
  }
  const answerBtn = event.target.closest("[data-kanban-answer]");
  if (answerBtn && !answerBtn.disabled) {
    closeKanbanContextMenu();
    await answerHumanInputTask(link);
    return;
  }
  const archiveBtn = event.target.closest("[data-kanban-archive]");
  if (archiveBtn && !archiveBtn.disabled) {
    const confirmed = await confirmAction({
      title: "确认删除",
      message: `删除任务 ${taskId}？`,
      confirmText: "删除",
      confirmVariant: "danger",
    });
    if (!confirmed) {
      closeKanbanContextMenu();
      return;
    }
    archiveBtn.disabled = true;
    kanbanState.deletingTaskIds.add(taskId);
    renderKanbanTasks();
    closeKanbanContextMenu();
    try {
      await postKanbanTaskAction(taskId, "", { method: "DELETE" });
      setKanbanStatus(`已删除：${taskId}`, "success");
    } catch (error) {
      setKanbanStatus(error.message || "删除失败", "error");
      kanbanState.deletingTaskIds.delete(taskId);
      renderKanbanTasks();
      archiveBtn.disabled = false;
    }
  }
}

function kanbanLinkMatchesTeam(link) {
  if (!selectedKanbanTeam) return true;
  const teams = window.__BOOTSTRAP__?.teams || [];
  const team = teams.find((t) => t.slug === selectedKanbanTeam);
  if (!team) return true;
  // link 未标板（存量）在选具体团队时隐藏
  const board = (link?.metadata || {}).board || "";
  return board === team.board_name;
}

function renderKanbanTasks() {
  if (!kanbanTaskList) return;
  const links = [...(kanbanState.links || [])].filter(kanbanLinkMatchesTeam).sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  kanbanTaskList.innerHTML = "";
  syncKanbanAutoUnblock();
  const baseColumns = [
    { key: "ready", title: "待执行" },
    { key: "running", title: "执行中" },
    { key: "blocked", title: "阻塞" },
    { key: "done", title: "已完成" },
  ];
  const grouped = new Map([...baseColumns, { key: "unknown", title: "未知" }].map((column) => [column.key, []]));
  links.forEach((link) => {
    const key = kanbanColumnForStatus(kanbanDisplayStatus(link));
    grouped.get(key).push(link);
  });
  const columns = [...baseColumns];
  if ((grouped.get("unknown") || []).length) {
    columns.splice(3, 0, { key: "unknown", title: "未知" });
  }
  columns.forEach((column) => {
    const items = grouped.get(column.key) || [];
    const section = document.createElement("section");
    section.className = "kanban-column";
    section.innerHTML = `
      <div class="kanban-column__head">
        <strong>${escapeHtml(column.title)}</strong>
        ${items.length ? `<button class="kanban-column__clear" type="button" data-kanban-clear-column="${escapeHtml(column.key)}" data-kanban-column-title="${escapeHtml(column.title)}">删除所有</button>` : `<button class="kanban-column__clear" type="button" disabled>删除所有</button>`}
        <span>${items.length}</span>
      </div>
      <div class="kanban-column__body"></div>
    `;
    const clearButton = section.querySelector("[data-kanban-clear-column]");
    if (clearButton) clearButton.addEventListener("click", clearColumnKanbanTasks);
    const body = section.querySelector(".kanban-column__body");
    const pendingForColumn = column.key === "ready" ? kanbanState.pendingCreations : [];
    pendingForColumn.forEach((pending) => {
      const placeholder = document.createElement("article");
      placeholder.className = "kanban-task-card kanban-task-card--pending";
      placeholder.dataset.pendingId = pending.id;
      placeholder.innerHTML = `
        <div class="kanban-task-card__top">
          <strong title="${escapeHtml(pending.title)}">${escapeHtml(pending.title)}</strong>
          <span class="kanban-task-badge">创建中…</span>
        </div>
        <p>正在创建任务，请稍候…</p>
      `;
      body.appendChild(placeholder);
    });
    if (!items.length && !pendingForColumn.length) {
      body.innerHTML = `<p class="kanban-column__empty">暂无任务</p>`;
    }
    items.slice(0, 20).forEach((link) => {
      const card = document.createElement("article");
      card.className = "kanban-task-card";
      card.dataset.kanbanTaskId = link.kanban_task_id || "";
      if (kanbanState.deletingTaskIds.has(link.kanban_task_id)) card.classList.add("is-deleting");
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.title = kanbanTaskCanAnswer(link) ? "回答人工处理" : "打开对应 Agent 终端";
      card.addEventListener("click", () => openKanbanTask(link));
      card.addEventListener("contextmenu", (event) => showKanbanTaskContextMenu(event, link));
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openKanbanTask(link);
      });
      const resultPreview = link.last_result ? String(link.last_result).slice(0, 96) : "";
      const humanQuestion = link.kanban_role === "human_input" ? String(link.metadata?.question || "").slice(0, 120) : "";
      const agent = agentForKanbanLink(link);
      const assigneeName = agent?.name || link.assignee_profile || "unassigned";
      const taskTitle = link.metadata?.task_title || kanbanRoleLabel(link.kanban_role);
      const createdAt = formatDateTime(link.created_at);
      card.innerHTML = `
        <div class="kanban-task-card__top">
          <strong title="${escapeHtml(taskTitle)}">${escapeHtml(taskTitle)}</strong>
          <span class="kanban-task-badge">${escapeHtml(kanbanStatusLabel(kanbanDisplayStatus(link)))}</span>
        </div>
        <p>执行人：${escapeHtml(assigneeName)}</p>
        ${humanQuestion ? `<div class="kanban-task-card__result">${escapeHtml(humanQuestion)}</div>` : ""}
        ${resultPreview ? `<div class="kanban-task-card__result">${escapeHtml(resultPreview)}</div>` : ""}
        <small>创建时间：${escapeHtml(createdAt)}</small>
      `;
      body.appendChild(card);
    });
    kanbanTaskList.appendChild(section);
  });
  window.__HERMES_UI__?.onKanbanUpdate?.(kanbanState);
}

async function answerHumanInputTask(link) {
  const taskId = link?.kanban_task_id || "";
  if (!taskId) return;
  const wrapper = document.createElement("div");
  wrapper.className = "confirm-modal__checklist";
  const question = document.createElement("p");
  question.textContent = link.metadata?.question || "请填写人工处理结果。";
  const textarea = document.createElement("textarea");
  textarea.rows = 4;
  textarea.placeholder = "输入给 Agent 的答复";
  textarea.style.width = "100%";
  textarea.style.boxSizing = "border-box";
  wrapper.appendChild(question);
  wrapper.appendChild(textarea);
  const confirmed = await confirmAction({
    title: "回答人工处理",
    message: wrapper,
    confirmText: "提交答案",
    confirmVariant: "default",
  });
  const answer = textarea.value.trim();
  if (!confirmed || !answer) return;
  setKanbanStatus(`正在提交人工答复：${taskId}…`);
  try {
    const response = await fetch(`/api/kanban/tasks/${encodeURIComponent(taskId)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "提交答案失败");
    kanbanState.links = Array.isArray(data.links) ? data.links : kanbanState.links;
    renderKanbanTasks();
    setKanbanStatus("人工答复已提交，已创建继续执行任务。", "success");
  } catch (error) {
    setKanbanStatus(error.message || "提交答案失败", "error");
  }
}

async function clearColumnKanbanTasks(event) {
  event.preventDefault();
  event.stopPropagation();
  const button = event.currentTarget;
  const columnKey = button?.dataset?.kanbanClearColumn || "done";
  const columnTitle = button?.dataset?.kanbanColumnTitle || "该";
  const matchedLinks = (kanbanState.links || []).filter((link) => kanbanColumnForStatus(link.kanban_status) === columnKey);
  const count = matchedLinks.length;
  if (!count) return;
  const confirmed = await confirmAction({
    title: "确认删除",
    message: `删除「${columnTitle}」列中所有团队任务（${count} 个）？`,
    confirmText: "删除",
    confirmVariant: "danger",
  });
  if (!confirmed) return;
  if (button) button.disabled = true;
  matchedLinks.forEach((link) => kanbanState.deletingTaskIds.add(link.kanban_task_id));
  renderKanbanTasks();
  setKanbanStatus(`正在删除「${columnTitle}」列任务…`);
  try {
    const endpoint = columnKey === "done"
      ? "/api/kanban/tasks/done"
      : `/api/kanban/tasks/column/${encodeURIComponent(columnKey)}`;
    const response = await fetch(endpoint, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "删除任务失败");
    kanbanState.links = Array.isArray(data.links) ? data.links : kanbanState.links;
    matchedLinks.forEach((link) => kanbanState.deletingTaskIds.delete(link.kanban_task_id));
    renderKanbanTasks();
    setKanbanStatus(`已删除「${columnTitle}」列 ${data.archived_count || count} 个任务。`, "success");
  } catch (error) {
    setKanbanStatus(error.message || "删除任务失败", "error");
    matchedLinks.forEach((link) => kanbanState.deletingTaskIds.delete(link.kanban_task_id));
    renderKanbanTasks();
    if (button) button.disabled = false;
  }
}

async function clearDoneKanbanTasks() {
  const button = document.getElementById("settings-clear-done-tasks");
  const matchedLinks = (kanbanState.links || []).filter((link) => kanbanColumnForStatus(link.kanban_status) === "done");
  const count = matchedLinks.length;
  if (!count) {
    await confirmAction({
      title: "无需清空",
      message: "当前没有已完成任务。",
      confirmText: "知道了",
      confirmVariant: "default",
      hideCancel: true,
    });
    return;
  }
  const target = button || { dataset: { kanbanClearColumn: "done", kanbanColumnTitle: "已完成" } };
  if (button) {
    button.dataset.kanbanClearColumn = "done";
    button.dataset.kanbanColumnTitle = "已完成";
  }
  try {
    await clearColumnKanbanTasks({
      preventDefault() {},
      stopPropagation() {},
      currentTarget: target,
    });
  } finally {
    if (button) button.disabled = false;
  }
}

async function refreshKanbanTasks({ silent = false } = {}) {
  if (kanbanState.deletingTaskIds.size) return;
  if (!kanbanTaskList || kanbanState.loading) return;
  kanbanState.loading = true;
  if (!silent) setKanbanStatus("正在刷新 Kanban 任务…");
  try {
    const response = await fetch("/api/kanban/tasks");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Kanban 任务加载失败");
    kanbanState.links = Array.isArray(data.links) ? data.links : [];
    renderKanbanTasks();
    if (!silent) setKanbanStatus(`已刷新 ${kanbanState.links.length} 个任务映射。`, "success");
  } catch (error) {
    if (!silent) setKanbanStatus(error.message || "Kanban 任务加载失败", "error");
  } finally {
    kanbanState.loading = false;
  }
}

async function submitKanbanTask(event) {
  event.preventDefault();
  if (!kanbanTaskInput || !kanbanTaskForm) return;
  const content = kanbanTaskInput.value.trim();
  if (!content) {
    setKanbanStatus("请输入任务内容。", "error");
    kanbanTaskInput.focus();
    return;
  }
  const submitBtn = kanbanTaskForm.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  if (!selectedKanbanAssigneeId) {
    setKanbanStatus("当前范围没有可接收任务的 Agent，请先启动团队 Leader。", "error");
    return;
  }
  if (submitBtn) submitBtn.disabled = true;
  const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pendingEntry = { id: pendingId, title: content.slice(0, 80) };
  kanbanState.pendingCreations.push(pendingEntry);
  renderKanbanTasks();
  pendingEntry.timeoutId = window.setTimeout(() => {
    kanbanState.pendingCreations = kanbanState.pendingCreations.filter((item) => item.id !== pendingId);
    renderKanbanTasks();
  }, 30000);
  setKanbanStatus("正在创建 Kanban 父任务…");
  let created = false;
  try {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, to_agent_id: selectedKanbanAssigneeId || "" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "任务创建失败");
    if (kanbanTaskInput.value.trim() === content) kanbanTaskInput.value = "";
    const message = data.message || {};
    setKanbanStatus(`已创建：${message.kanban_task_id || message.user_task_id || "Kanban 任务"}`, "success");
    created = true;
    const newTaskId = message.kanban_task_id || "";
    await refreshKanbanTasks({ silent: true });
    const matched = newTaskId
      ? (kanbanState.links || []).some((link) => link.kanban_task_id === newTaskId)
      : false;
    if (matched) {
      window.clearTimeout(pendingEntry.timeoutId);
      kanbanState.pendingCreations = kanbanState.pendingCreations.filter((item) => item.id !== pendingId);
      renderKanbanTasks();
    }
  } catch (error) {
    setKanbanStatus(error.message || "任务创建失败", "error");
  } finally {
    if (!created) {
      window.clearTimeout(pendingEntry.timeoutId);
      kanbanState.pendingCreations = kanbanState.pendingCreations.filter((item) => item.id !== pendingId);
      renderKanbanTasks();
    }
    if (submitBtn) submitBtn.disabled = false;
  }
}

function handleKanbanTaskInputKeydown(event) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  kanbanTaskForm?.requestSubmit();
}

async function dispatchKanbanOnce() {
  if (!kanbanDispatch) return;
  kanbanDispatch.disabled = true;
  setKanbanStatus("正在触发一次 Kanban dispatch…");
  try {
    const response = await fetch("/api/kanban/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Dispatch 失败");
    setKanbanStatus("Dispatch 已触发。", "success");
    await refreshKanbanTasks({ silent: true });
  } catch (error) {
    setKanbanStatus(error.message || "Dispatch 失败", "error");
  } finally {
    kanbanDispatch.disabled = false;
  }
}

function renderKanbanAutoDispatch() {
  if (!kanbanAutoDispatch) return;
  if (kanbanAutoDispatch instanceof HTMLInputElement && kanbanAutoDispatch.type === "checkbox") {
    kanbanAutoDispatch.checked = kanbanState.autoDispatchEnabled;
    kanbanAutoDispatch.setAttribute("aria-pressed", kanbanState.autoDispatchEnabled ? "true" : "false");
    const track = kanbanAutoDispatch.nextElementSibling;
    if (track) track.classList.toggle("bg-secondary", kanbanState.autoDispatchEnabled);
    kanbanAutoDispatch.classList.toggle("translate-x-5", kanbanState.autoDispatchEnabled);
  } else {
    kanbanAutoDispatch.textContent = `自动派发：${kanbanState.autoDispatchEnabled ? "开" : "关"}`;
    kanbanAutoDispatch.classList.toggle("is-active", kanbanState.autoDispatchEnabled);
    kanbanAutoDispatch.setAttribute("aria-pressed", kanbanState.autoDispatchEnabled ? "true" : "false");
  }
  if (kanbanDispatch) kanbanDispatch.hidden = kanbanState.autoDispatchEnabled;
  window.__HERMES_UI__?.onAutoDispatchChange?.(kanbanState.autoDispatchEnabled);
}

function stopKanbanAutoDispatchTimer() {
  if (!kanbanState.autoDispatchTimer) return;
  window.clearInterval(kanbanState.autoDispatchTimer);
  kanbanState.autoDispatchTimer = 0;
}

async function runKanbanAutoDispatchTick() {
  if (kanbanState.deletingTaskIds.size) return;
  if (!kanbanState.autoDispatchEnabled || kanbanState.autoDispatchRunning) return;
  if (!hasDispatchableKanbanTask()) return;
  kanbanState.autoDispatchRunning = true;
  try {
    const response = await fetch("/api/kanban/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "自动派发失败");
    setKanbanStatus("自动派发已触发。", "success");
    await refreshKanbanTasks({ silent: true });
  } catch (error) {
    setKanbanStatus(error.message || "自动派发失败", "error");
  } finally {
    kanbanState.autoDispatchRunning = false;
  }
}

function syncKanbanAutoDispatchTimer() {
  stopKanbanAutoDispatchTimer();
  if (!kanbanState.autoDispatchEnabled) return;
  kanbanState.autoDispatchTimer = window.setInterval(
    runKanbanAutoDispatchTick,
    kanbanState.autoDispatchIntervalMs,
  );
  void runKanbanAutoDispatchTick();
}

function applyKanbanSettings(settings) {
  kanbanState.autoDispatchEnabled = Boolean(settings?.auto_dispatch_enabled);
  kanbanState.autoDispatchIntervalMs = Number(settings?.auto_dispatch_interval_ms) || 5000;
  renderKanbanAutoDispatch();
  syncKanbanAutoDispatchTimer();
  window.__HERMES_UI__?.applyCollaborationSettings?.(settings || {});
}

async function loadKanbanSettings() {
  if (!kanbanAutoDispatch) return;
  try {
    const response = await fetch("/api/kanban/settings");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Kanban 设置加载失败");
    applyKanbanSettings(data.settings || {});
  } catch (error) {
    setKanbanStatus(error.message || "Kanban 设置加载失败", "error");
    renderKanbanAutoDispatch();
  }
}

async function toggleKanbanAutoDispatch(event) {
  if (!kanbanAutoDispatch) return;
  const nextEnabled = kanbanAutoDispatch instanceof HTMLInputElement && kanbanAutoDispatch.type === "checkbox"
    ? kanbanAutoDispatch.checked
    : !kanbanState.autoDispatchEnabled;
  if (event) event.preventDefault();
  kanbanAutoDispatch.disabled = true;
  try {
    const response = await fetch("/api/kanban/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_dispatch_enabled: nextEnabled }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Kanban 设置保存失败");
    applyKanbanSettings(data.settings || {});
    setKanbanStatus(`自动派发已${kanbanState.autoDispatchEnabled ? "开启" : "关闭"}。`, "success");
  } catch (error) {
    setKanbanStatus(error.message || "Kanban 设置保存失败", "error");
  } finally {
    kanbanAutoDispatch.disabled = false;
  }
}

function formatAgentTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRuntimeStatus(value) {
  if (value === "running") return "在岗";
  if (value === "crashed") return "异常";
  return "离岗";
}

function getAgentDisplayStatus(agent) {
  const readinessStatus = agent.readiness_status || "ready";
  const runtimeStatus = agent.runtime_status || "stopped";
  const interactionState = agent.interaction_state || "idle";
  const orchestrationState = agent.orchestration_state || "none";
  const status = agent.status || "idle";
  const currentTask = agent.current_task || "";

  if (readinessStatus === "preparing") {
    return { label: "准备中", className: "preparing" };
  }
  if (readinessStatus === "failed") {
    return { label: "未就绪", className: "unready" };
  }
  if (runtimeStatus === "stopped" || runtimeStatus === "crashed") {
    return { label: "不可用", className: "offline" };
  }
  if (["awaiting_approval", "awaiting_selection", "awaiting_input"].includes(interactionState)) {
    return { label: "需介入", className: "waiting" };
  }
  if (currentTask.includes("可能卡住")) {
    return { label: "卡住", className: "stuck" };
  }
  if (
    status === "busy" ||
    status === "waiting" ||
    interactionState === "queued" ||
    interactionState === "running" ||
    orchestrationState === "waiting_workers" ||
    orchestrationState === "summarizing" ||
    orchestrationState === "kanban_ready" ||
    orchestrationState === "kanban_running"
  ) {
    return { label: "处理中", className: "busy" };
  }
  return { label: "空闲", className: "idle" };
}

function buildAgentRow(agent, isActive) {
  const row = document.createElement("div");
  const readinessStatus = agent.readiness_status || "ready";
  const isReady = readinessStatus === "ready";
  const runtimeStatus = agent.runtime_status || "stopped";
  row.setAttribute("role", "button");
  row.setAttribute("aria-disabled", isReady ? "false" : "true");
  row.tabIndex = isReady ? 0 : -1;
  row.className = "agent-row" + (!isReady ? " is-disabled" : "") + (isReady && isActive ? " is-active" : "");
  row.dataset.agentId = agent.agent_id;
  row.dataset.agentName = agent.name;
  row.dataset.agentRole = agent.role;
  row.dataset.agentStatus = agent.status || "idle";
  row.dataset.agentOrchestrationState = agent.orchestration_state || "none";
  row.dataset.agentRuntimeStatus = runtimeStatus;
  row.dataset.readinessStatus = readinessStatus;
  const displayStatus = getAgentDisplayStatus(agent);
  const modelName = agent.model_summary?.default || "";
  const agentMeta = [agent.role, agent.profile_name].filter(Boolean).join(" · ");
  debugLog("agent-row", {
    agent_id: agent.agent_id,
    status: agent.status,
    interaction_state: agent.interaction_state,
    orchestration_state: agent.orchestration_state,
    runtime_status: runtimeStatus,
    readiness_status: readinessStatus,
    queue_depth: agent.queue_depth || 0,
    display: displayStatus.label,
  });
  const btn = !isReady
    ? `<button class="acp-btn acp-btn--start acp-btn--runtime" type="button" data-session-action="start" data-agent-id="${agent.agent_id}" disabled>启动</button>`
    : runtimeStatus === "running"
    ? `<button class="acp-btn acp-btn--stop acp-btn--runtime" type="button" data-session-action="stop" data-agent-id="${agent.agent_id}">停止</button>`
    : `<button class="acp-btn acp-btn--start acp-btn--runtime" type="button" data-session-action="start" data-agent-id="${agent.agent_id}">启动</button>`;
  row.innerHTML = `
    <div class="agent-row__top">
      <div>
        <strong>${escapeHtml(agent.name)}</strong>
        <p>${escapeHtml(agentMeta)}</p>
        ${modelName ? `<p class="agent-row__model" title="${escapeHtml(modelName)}">${escapeHtml(modelName)}</p>` : ""}
      </div>
      <span class="status-badge status-${escapeHtml(displayStatus.className)}">${escapeHtml(displayStatus.label)}</span>
    </div>
    <div class="agent-row__body">
      <dl>
        <div><dt>任务数量</dt><dd>${agent.queue_depth || 0}</dd></div>
      </dl>
      <div class="agent-row__session">
        <span class="agent-row__runtime">
          <span class="acp-dot acp-${runtimeStatus}"></span>
          <span class="acp-label">${escapeHtml(formatRuntimeStatus(runtimeStatus))}</span>
        </span>
        <span class="agent-row__actions">
          <button class="acp-btn acp-btn--config" type="button" data-agent-config data-agent-id="${agent.agent_id}">配置 ▾</button>
          ${btn}
        </span>
      </div>
    </div>
  `;
  return row;
}

function getChatEventMeta(event) {
  const type = event.event_type || "";
  if (type === "message.sent") return { label: "发送", className: "user" };
  if (type === "agent.output.final") return { label: "回复", className: "agent" };
  if (type === "agent.output.failed" || type === "agent.runtime.failed") {
    return { label: "异常", className: "error" };
  }
  if (type === "agent.interaction.required") {
    return { label: "需介入", className: "waiting" };
  }
  if (type === "agent.interaction.resolved") {
    return { label: "已处理", className: "system" };
  }
  if (type === "agent.created" || type === "agent.deleted") {
    return { label: "系统", className: "system" };
  }
  if (type === "user_task.created" || type === "user_task.completed") {
    return { label: "任务", className: "system" };
  }
  return null;
}

function isChatEvent(event) {
  return Boolean(event?.agent_id && getChatEventMeta(event));
}

function rememberChatEvent(event) {
  if (!isChatEvent(event)) return false;
  const agentId = event.agent_id;
  const events = chatEventsByAgent.get(agentId) || [];
  if (events.some((item) => item.id === event.id)) return false;
  events.push(event);
  events.sort((a, b) => (
    String(a.timestamp || "").localeCompare(String(b.timestamp || ""))
  ));
  chatEventsByAgent.set(agentId, events.slice(-80));
  return true;
}

function formatChatEventText(event) {
  return String(event.data?.text || "").trim() || "(空内容)";
}

function buildChatEventCard(event) {
  const meta = getChatEventMeta(event);
  const card = document.createElement("article");
  card.className = `interaction-card interaction-card--${meta.className}`;
  card.innerHTML = `
    <div class="interaction-card__head">
      <span>${escapeHtml(meta.label)}</span>
      <time>${escapeHtml(formatAgentTime(event.timestamp))}</time>
    </div>
    <p>${escapeHtml(formatChatEventText(event))}</p>
  `;
  return card;
}

function getSelectedAgentName() {
  const selectedAgentId = eventList?.dataset.selectedAgent || "";
  const row = selectedAgentId
    ? agentList?.querySelector(`.agent-row[data-agent-id="${CSS.escape(selectedAgentId)}"]`)
    : null;
  return row?.dataset.agentName || selectedAgentId || "尚未选择 Agent";
}

function renderInteractions() {
  if (!interactionList) return;
  const selectedAgentId = eventList?.dataset.selectedAgent || "";
  const events = selectedAgentId ? (chatEventsByAgent.get(selectedAgentId) || []) : [];
  if (historyDrawerAgent) historyDrawerAgent.textContent = getSelectedAgentName();
  if (historyEmpty) historyEmpty.hidden = events.length > 0;
  interactionList.innerHTML = "";
  interactionList.hidden = events.length === 0;
  events.forEach((event) => {
    interactionList.appendChild(buildChatEventCard(event));
  });
  interactionList.scrollTop = interactionList.scrollHeight;
}

function openHistoryPanel() {
  if (!historyDrawer) return;
  renderInteractions();
  openAnimatedLayer(historyDrawer);
}

function closeHistoryPanel() {
  if (!historyDrawer || historyDrawer.hidden) return;
  closeAnimatedLayer(historyDrawer);
}

function fitTerminalDrawer() {
  scheduleTerminalFit(0);
  scheduleTerminalFit(80);
  window.setTimeout(fitAllTerminalSessions, 180);
  window.setTimeout(fitAllTerminalSessions, overlayAnimationMs + 80);
}

function openTerminalPanel() {
  if (!terminalDrawer) return;
  openAnimatedLayer(terminalDrawer);
  const agentId = eventList?.dataset.selectedAgent || "";
  if (agentId) {
    const session = ensureTerminalSession(agentId);
    if (session && (!session.ws || session.ws.readyState > WebSocket.OPEN)) connectTerminalSession(session);
  }
  fitTerminalDrawer();
}

function closeTerminalPanel() {
  if (!terminalDrawer || terminalDrawer.hidden) return;
  clearKanbanTerminalLog();
  closeAnimatedLayer(terminalDrawer);
}

function setSoulStatus(message, kind = "muted") {
  if (!soulStatus) return;
  soulStatus.textContent = message || "";
  soulStatus.dataset.kind = kind;
  soulStatus.hidden = !message;
}

function setSkillsStatus(message, kind = "muted", options = {}) {
  if (!skillsStatus) return;
  skillsStatus.innerHTML = "";
  skillsStatus.dataset.kind = kind;
  skillsStatus.classList.toggle("has-action", Boolean(options.restartAction));
  skillsStatus.hidden = !message;
  if (!message) return;
  const text = document.createElement("span");
  text.textContent = message;
  skillsStatus.appendChild(text);
  if (options.restartAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip skills-status__action";
    button.dataset.skillsRestartAgent = "true";
    button.textContent = "重启当前 Agent";
    skillsStatus.appendChild(button);
  }
}

function showSkillsRestartPrompt(message, kind = "success") {
  setSkillsStatus(`${message} 重启当前 Agent 后生效。`, kind, { restartAction: true });
}

function setModelConfigStatus(message, kind = "muted") {
  if (!modelConfigStatus) return;
  modelConfigStatus.textContent = message || "";
  modelConfigStatus.hidden = !message;
  modelConfigStatus.dataset.kind = kind;
}

function setAgentModelStatus(message, kind = "muted") {
  if (!agentModelStatus) return;
  agentModelStatus.textContent = message || "";
  agentModelStatus.hidden = !message;
  agentModelStatus.dataset.kind = kind;
}

function setMcpStatus(message, kind = "muted", options = {}) {
  if (!mcpStatus) return;
  mcpStatus.innerHTML = "";
  mcpStatus.dataset.kind = kind;
  mcpStatus.classList.toggle("has-action", Boolean(options.restartAction));
  mcpStatus.hidden = !message;
  if (!message) return;
  const text = document.createElement("span");
  text.textContent = message;
  mcpStatus.appendChild(text);
  if (options.restartAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip skills-status__action";
    button.dataset.mcpRestartAgent = "true";
    button.textContent = "重启当前 Agent";
    mcpStatus.appendChild(button);
  }
}

function showMcpRestartPrompt(message, kind = "success") {
  setMcpStatus(`${message} 重启当前 Agent 后生效。`, kind, { restartAction: true });
}

async function restartCurrentMcpAgent(triggerButton = null) {
  const agentId = mcpState.agentId;
  if (!agentId) return;
  if (triggerButton) triggerButton.disabled = true;
  setMcpStatus("正在重启当前 Agent…", "muted");
  try {
    const response = await fetch(`/api/agents/${agentId}/restart`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "重启 Agent 失败");
    setMcpStatus("当前 Agent 已重启，MCP 已生效。", "success");
  } catch (error) {
    showMcpRestartPrompt(`重启失败：${error.message || "未知错误"}`, "error");
  } finally {
    if (triggerButton) triggerButton.disabled = false;
  }
}

async function restartCurrentSkillsAgent(triggerButton = null) {
  const agentId = skillsState.agentId;
  if (!agentId) return;
  if (triggerButton) triggerButton.disabled = true;
  setSkillsStatus("正在重启当前 Agent…", "muted");
  try {
    const stopResponse = await fetch(`/api/agents/${agentId}/stop`, { method: "POST" });
    const stopData = await stopResponse.json().catch(() => ({}));
    if (!stopResponse.ok || stopData.ok === false) throw new Error(stopData.error || "停止 Agent 失败");

    const startResponse = await fetch(`/api/agents/${agentId}/start`, { method: "POST" });
    const startData = await startResponse.json().catch(() => ({}));
    if (!startResponse.ok || !startData.ok) throw new Error(startData.error || "启动 Agent 失败");

    setSkillsStatus("当前 Agent 已重启，skills 已生效。", "success");
  } catch (error) {
    showSkillsRestartPrompt(`重启失败：${error.message || "未知错误"}`, "error");
  }
}

function hasUnsavedSoulChanges() {
  return Boolean(soulEditor && soulEditor.value !== soulState.originalContent);
}

function updateSoulDirtyState() {
  const dirty = hasUnsavedSoulChanges();
  if (soulDirtyHint) soulDirtyHint.hidden = !dirty;
  if (saveSoul) saveSoul.disabled = soulState.saving || !dirty || !soulEditor?.value.trim();
  if (regenerateSoul) regenerateSoul.disabled = soulState.saving || soulState.regenerating || !soulState.agentId;
}

function renderInlineMarkdown(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdownPreview(markdown) {
  if (!soulPreview) return;
  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let inCode = false;
  let codeLines = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };
  const flushCode = () => {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        closeList();
        inCode = true;
        codeLines = [];
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`);
      return;
    }

    closeList();
    if (!line.trim()) {
      html.push("");
      return;
    }
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  });

  if (inCode) flushCode();
  closeList();
  soulPreview.innerHTML = html.join("");
}

function getScrollRatio(element) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 0) return 0;
  return element.scrollTop / maxScroll;
}

function setScrollRatio(element, ratio) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  element.scrollTop = maxScroll > 0 ? maxScroll * ratio : 0;
}

function syncSoulScroll(source, target, sourceName) {
  if (!source || !target) return;
  if (soulState.scrollSyncSource && soulState.scrollSyncSource !== sourceName) return;
  soulState.scrollSyncSource = sourceName;
  setScrollRatio(target, getScrollRatio(source));
  clearTimeout(soulState.scrollSyncTimer);
  soulState.scrollSyncTimer = window.setTimeout(() => {
    soulState.scrollSyncSource = "";
  }, 80);
}

function syncSoulPreviewToEditor() {
  if (!soulEditor || !soulPreview) return;
  setScrollRatio(soulPreview, getScrollRatio(soulEditor));
}

function clearSoulPollTimer() {
  if (!soulState.pollTimer) return;
  window.clearTimeout(soulState.pollTimer);
  soulState.pollTimer = 0;
}

async function refreshSoulContent({ focusEditor = false, showFreshStatus = true } = {}) {
  if (!soulState.agentId) return null;
  const requestedAgentId = soulState.agentId;
  const response = await fetch(`/api/agents/${requestedAgentId}/soul`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "SOUL.md 加载失败");
  }
  if (soulState.agentId !== requestedAgentId) return null;

  soulState.originalContent = data.content || "";
  soulState.runtimeStatus = data.agent?.runtime_status || "stopped";
  const isPreparing = data.agent?.readiness_status === "preparing";
  if (soulDrawerAgent) {
    soulDrawerAgent.textContent = `${data.agent?.name || requestedAgentId} · ${data.agent?.profile_name || ""}`;
  }
  if (soulDrawerPath) soulDrawerPath.textContent = data.path || "—";
  if (soulEditor) {
    soulEditor.disabled = isPreparing;
    soulEditor.value = soulState.originalContent;
    if (focusEditor && !isPreparing) soulEditor.focus();
  }
  renderMarkdownPreview(soulState.originalContent);
  syncSoulPreviewToEditor();
  if (showFreshStatus) {
    setSoulStatus(isPreparing ? "SOUL.md 正在生成中，完成后才能编辑。" : (data.updated_at ? `最后保存：${formatDateTime(data.updated_at)}` : "SOUL.md 尚未创建，保存后会写入文件。"), "muted");
  }
  updateSoulDirtyState();
  return data;
}

function pollSoulRegeneration() {
  clearSoulPollTimer();
  if (!soulState.agentId || !soulState.regenerating) return;
  const requestedAgentId = soulState.agentId;
  soulState.pollTimer = window.setTimeout(async () => {
    try {
      const data = await refreshSoulContent({ showFreshStatus: false });
      if (!data || soulState.agentId !== requestedAgentId) return;
      if (data.agent?.readiness_status === "preparing") {
        setSoulStatus("SOUL.md 正在重新生成…", "muted");
        pollSoulRegeneration();
        return;
      }
      soulState.regenerating = false;
      const runningHint = (data.agent?.runtime_status || soulState.runtimeStatus) === "running" ? "，重启该 agent 后生效" : "";
      setSoulStatus(`SOUL.md 已重新生成${runningHint}。`, "success");
      updateSoulDirtyState();
    } catch (error) {
      soulState.regenerating = false;
      setSoulStatus(error.message || "SOUL.md 重新生成失败", "error");
      updateSoulDirtyState();
    }
  }, 1500);
}

function skillLetterForSlug(slug) {
  const first = String(slug || "").trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}

function getFilteredSkills() {
  if (skillsState.activeLetter === "ALL") return skillsState.items;
  return skillsState.items.filter((skill) => skillLetterForSlug(skill.slug) === skillsState.activeLetter);
}

function renderSkillAlphaNav() {
  if (!skillsAlphaNav) return;
  const availableLetters = new Set(skillsState.items.map((skill) => skillLetterForSlug(skill.slug)));
  skillsAlphaNav.innerHTML = "";
  SKILL_ALPHA_OPTIONS.forEach((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skill-alpha-chip filter-chip" + (skillsState.activeLetter === letter ? " is-active" : "");
    button.dataset.letter = letter;
    button.textContent = letter === "ALL" ? "全部" : letter;
    if (letter !== "ALL" && !availableLetters.has(letter)) {
      button.disabled = true;
    }
    skillsAlphaNav.appendChild(button);
  });
}

function renderSkillItems() {
  if (!skillsList) return;
  const filteredItems = getFilteredSkills();
  skillsList.innerHTML = "";
  if (skillsEmpty) {
    skillsEmpty.hidden = filteredItems.length > 0;
    skillsEmpty.textContent = skillsState.activeLetter === "ALL" ? "还没有安装 skill。" : `没有 ${skillsState.activeLetter} 开头的 skill。`;
  }
  filteredItems.forEach((skill) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skill-row" + (skill.slug === skillsState.selectedSlug ? " is-active" : "");
    button.dataset.slug = skill.slug;
    button.innerHTML = `
      <strong>${escapeHtml(skill.slug)}</strong>
      <span>${escapeHtml(skill.description || skill.name || skill.slug)}</span>
      <small>${escapeHtml(skill.source_type || "local")}</small>
    `;
    skillsList.appendChild(button);
  });
}

function setSelectedSkillDetail(skill) {
  skillsState.selectedSlug = skill?.slug || "";
  if (skillsDetailTitle) skillsDetailTitle.textContent = skill?.slug || "选择一个 skill";
  if (skillsDetailMeta) {
    const sourceType = skill?.source_type || "—";
    const sourceRef = skill?.source_ref ? ` · ${skill.source_ref}` : "";
    skillsDetailMeta.textContent = skill ? `${sourceType}${sourceRef}` : "—";
  }
  if (skillsDetailPath) skillsDetailPath.textContent = skill?.path || "—";
  if (skillsPreview) {
    const content = String(skill?.content || skill?.body || "").trim();
    skillsPreview.innerHTML = content ? `<pre><code>${escapeHtml(content)}</code></pre>` : "<p>暂无内容。</p>";
  }
  if (skillsReinstall) skillsReinstall.disabled = !skill || !skill.has_db_record;
  if (skillsUninstall) skillsUninstall.disabled = !skill;
  renderSkillItems();
}

async function loadSkillDetail(slug) {
  if (!skillsState.agentId || !slug) return;
  skillsState.selectedSlug = slug;
  renderSkillItems();
  const requestId = ++skillsState.detailRequestId;
  try {
    const response = await fetch(`/api/agents/${skillsState.agentId}/skills/${encodeURIComponent(slug)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "skill 加载失败");
    if (requestId !== skillsState.detailRequestId) return;
    setSelectedSkillDetail(data.skill);
    setSkillsStatus("", "muted");
  } catch (error) {
    if (requestId !== skillsState.detailRequestId) return;
    setSkillsStatus(error.message || "skill 加载失败", "error");
  }
}

async function refreshSkills(selectSlug = "") {
  if (!skillsState.agentId) return;
  skillsState.loading = true;
  setSkillsStatus("正在刷新 skills…", "muted");
  try {
    const response = await fetch(`/api/agents/${skillsState.agentId}/skills`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "skills 列表加载失败");
    skillsState.items = Array.isArray(data.skills) ? data.skills : [];
    renderSkillAlphaNav();
    renderSkillItems();
    const filteredItems = getFilteredSkills();
    let nextSlug = selectSlug || skillsState.selectedSlug || filteredItems[0]?.slug || "";
    if (nextSlug && !filteredItems.some((skill) => skill.slug === nextSlug)) {
      nextSlug = filteredItems[0]?.slug || "";
    }
    if (nextSlug) {
      await loadSkillDetail(nextSlug);
    } else {
      setSelectedSkillDetail(null);
      setSkillsStatus("", "muted");
    }
  } catch (error) {
    setSkillsStatus(error.message || "skills 列表加载失败", "error");
  } finally {
    skillsState.loading = false;
  }
}

async function openSkillsPanel(agentId) {
  if (!skillsDrawer || !agentId) return;
  closeAgentContextMenu();
  skillsState.agentId = agentId;
  skillsState.agentName = agentList?.querySelector(`.agent-row[data-agent-id="${CSS.escape(agentId)}"]`)?.dataset.agentName || agentId;
  skillsState.items = [];
  skillsState.selectedSlug = "";
  skillsState.activeLetter = "ALL";
  if (skillsDrawerAgent) skillsDrawerAgent.textContent = skillsState.agentName;
  setSelectedSkillDetail(null);
  renderSkillAlphaNav();
  renderSkillItems();
  setSkillsStatus("正在加载 skills…", "muted");
  openAnimatedLayer(skillsDrawer);
  await refreshSkills();
}

function closeSkillsPanel() {
  if (!skillsDrawer || skillsDrawer.hidden) return;
  closeAnimatedLayer(skillsDrawer, () => {
    skillsState.agentId = "";
    skillsState.agentName = "";
    skillsState.items = [];
    skillsState.selectedSlug = "";
    skillsState.activeLetter = "ALL";
    setSkillsStatus("", "muted");
  });
}

function mcpEndpoint(name = "") {
  const base = `/api/agents/${mcpState.agentId}/mcps`;
  return name ? `${base}/${encodeURIComponent(name)}` : base;
}

function parseKeyValueLines(value) {
  const result = {};
  String(value || "").split(/\r?\n/).forEach((line) => {
    const text = line.trim();
    if (!text) return;
    const colonIndex = text.indexOf(":");
    const equalsIndex = text.indexOf("=");
    const indexes = [colonIndex, equalsIndex].filter((index) => index >= 0);
    const index = indexes.length ? Math.min(...indexes) : -1;
    if (index <= 0) return;
    const key = text.slice(0, index).trim();
    const item = text.slice(index + 1).trim();
    if (key) result[key] = item;
  });
  return result;
}

function stringifyKeyValues(value) {
  return Object.entries(value || {}).map(([key, item]) => `${key}: ${item}`).join("\n");
}

function renderMcpItems() {
  if (!mcpList) return;
  mcpList.innerHTML = "";
  if (mcpEmpty) mcpEmpty.hidden = mcpState.items.length > 0;
  mcpState.items.forEach((mcp) => {
    const card = document.createElement("article");
    card.className = "mcp-card";
    const target = mcp.transport === "stdio"
      ? [mcp.command, ...(mcp.args || [])].filter(Boolean).join(" ")
      : mcp.url || "—";
    const testLabel = mcp.last_test_status === "ok" ? "测试:✓" : mcp.last_test_status === "fail" ? "测试:×" : "未测试";
    const managed = Boolean(mcp.managed);
    card.innerHTML = `
      <div class="mcp-card__head">
        <div>
          <strong>${escapeHtml(mcp.name)}</strong>
          <div class="mcp-card__badges">
            <span class="mcp-badge">${escapeHtml(mcp.transport)}</span>
            <span class="mcp-badge">${escapeHtml(mcp.source_type || "manual")}</span>
            <span class="mcp-badge">${escapeHtml(testLabel)}</span>
          </div>
        </div>
        <small>${managed ? "🔒 平台托管" : ""}</small>
      </div>
      <p>${escapeHtml(mcp.description || "暂无描述")}</p>
      <code>${escapeHtml(target)}</code>
      <div class="mcp-card__actions">
        <div></div>
        <div>
          <button class="filter-chip" type="button" data-mcp-reveal="${escapeHtml(mcp.name)}">显示</button>
          <button class="filter-chip" type="button" data-mcp-edit="${escapeHtml(mcp.name)}" ${managed ? "disabled title=\"平台托管\"" : ""}>编辑</button>
          <button class="filter-chip" type="button" data-mcp-test="${escapeHtml(mcp.name)}">测试</button>
          <button class="filter-chip" type="button" data-mcp-delete="${escapeHtml(mcp.name)}" ${managed ? "disabled title=\"平台托管\"" : ""}>删除</button>
        </div>
      </div>
    `;
    mcpList.appendChild(card);
  });
}

async function refreshMcps() {
  if (!mcpState.agentId) return;
  setMcpStatus("正在刷新 MCP…", "muted");
  try {
    const response = await fetch(mcpEndpoint());
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "MCP 列表加载失败");
    mcpState.items = Array.isArray(data.mcps) ? data.mcps : [];
    renderMcpItems();
    setMcpStatus("", "muted");
  } catch (error) {
    setMcpStatus(error.message || "MCP 列表加载失败", "error");
  }
}

async function openMcpPanel(agentId) {
  if (!mcpDrawer || !agentId) return;
  closeAgentContextMenu();
  mcpState.agentId = agentId;
  mcpState.agentName = agentList?.querySelector(`.agent-row[data-agent-id="${CSS.escape(agentId)}"]`)?.dataset.agentName || agentId;
  mcpState.items = [];
  if (mcpDrawerAgent) mcpDrawerAgent.textContent = mcpState.agentName;
  renderMcpItems();
  setMcpStatus("正在加载 MCP…", "muted");
  openAnimatedLayer(mcpDrawer);
  await refreshMcps();
}

function closeMcpPanel() {
  if (!mcpDrawer || mcpDrawer.hidden) return;
  closeAnimatedLayer(mcpDrawer, () => {
    mcpState.agentId = "";
    mcpState.agentName = "";
    mcpState.items = [];
    setMcpStatus("", "muted");
  });
}

function toggleMcpTransportFields() {
  if (!mcpEditForm) return;
  const transport = mcpEditForm.elements.transport.value;
  const isHttpTransport = transport === "http" || transport === "streamable_http";
  mcpEditForm.querySelectorAll(".mcp-http-field").forEach((item) => { item.hidden = !isHttpTransport; });
  mcpEditForm.querySelectorAll(".mcp-stdio-field").forEach((item) => { item.hidden = transport !== "stdio"; });
}

function openMcpEditModal(mcp = null) {
  if (!mcpEditModal || !mcpEditForm) return;
  mcpState.editingName = mcp?.name || "";
  mcpEditForm.reset();
  mcpEditForm.elements.original_name.value = mcp?.name || "";
  mcpEditForm.elements.transport.value = mcp?.transport || "http";
  mcpEditForm.elements.name.value = mcp?.name || "";
  mcpEditForm.elements.name.disabled = Boolean(mcp);
  mcpEditForm.elements.url.value = mcp?.url || "";
  mcpEditForm.elements.headers.value = stringifyKeyValues(mcp?.headers || {});
  mcpEditForm.elements.command.value = mcp?.command || "";
  mcpEditForm.elements.args.value = (mcp?.args || []).join("\n");
  mcpEditForm.elements.env.value = stringifyKeyValues(mcp?.env || {});
  mcpEditForm.elements.description.value = mcp?.description || "";
  if (mcpEditTitle) mcpEditTitle.textContent = mcp ? `编辑 MCP：${mcp.name}` : "新增 MCP";
  toggleMcpTransportFields();
  openAnimatedLayer(mcpEditModal, mcpEditForm.elements.name);
}

function closeMcpEditModal() {
  if (!mcpEditModal) return;
  closeAnimatedLayer(mcpEditModal, () => {
    mcpState.editingName = "";
    mcpEditForm?.reset();
  });
}

async function loadModelConfigs({ silent = false } = {}) {
  modelConfigState.loading = true;
  if (!silent) setModelConfigStatus("正在加载模型配置…", "muted");
  try {
    const response = await fetch("/api/model-configs");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "模型配置加载失败");
    modelConfigState.items = Array.isArray(data.items) ? data.items : [];
    renderModelConfigs();
    refreshModelConfigSelects();
    if (!silent) setModelConfigStatus("", "muted");
  } catch (error) {
    if (!silent) setModelConfigStatus(error.message || "模型配置加载失败", "error");
  } finally {
    modelConfigState.loading = false;
  }
}

function refreshModelConfigSelects() {
  const options = modelConfigState.items
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.model)}</option>`)
    .join("");
  if (createAgentModelConfig) {
    createAgentModelConfig.innerHTML = `<option value="">继承当前 Hermes active profile 配置</option>${options}`;
  }
  if (agentModelSelect) {
    agentModelSelect.innerHTML = options || `<option value="">暂无模型配置</option>`;
    agentModelSelect.disabled = modelConfigState.items.length === 0;
    if (saveAgentModel) saveAgentModel.disabled = modelConfigState.items.length === 0;
  }
}

function renderModelConfigs() {
  if (!modelConfigList) return;
  modelConfigList.innerHTML = "";
  if (modelConfigEmpty) modelConfigEmpty.hidden = modelConfigState.items.length > 0;
  modelConfigState.items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "mcp-card model-config-card";
    card.innerHTML = `
      <div class="mcp-card__head">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.model)}</small>
        </div>
        <div class="mcp-card__actions">
          <button class="filter-chip" type="button" data-model-config-test="${escapeHtml(item.id)}">测试</button>
          <button class="filter-chip" type="button" data-model-config-edit="${escapeHtml(item.id)}">编辑</button>
          <button class="filter-chip" type="button" data-model-config-delete="${escapeHtml(item.id)}">删除</button>
        </div>
      </div>
      <code>${escapeHtml(item.base_url)}</code>
    `;
    modelConfigList.appendChild(card);
  });
}

function openModelConfigEditModal(item = null) {
  if (!modelConfigEditModal || !modelConfigEditForm) return;
  modelConfigState.editingId = item?.id ? String(item.id) : "";
  modelConfigEditForm.reset();
  modelConfigEditForm.elements.id.value = item?.id || "";
  modelConfigEditForm.elements.name.value = item?.name || "";
  modelConfigEditForm.elements.model.value = item?.model || "";
  modelConfigEditForm.elements.base_url.value = item?.base_url || "";
  modelConfigEditForm.elements.api_key.value = item?.api_key || "";
  if (modelConfigEditTitle) modelConfigEditTitle.textContent = item ? `编辑模型配置：${item.name}` : "新增模型配置";
  openAnimatedLayer(modelConfigEditModal, modelConfigEditForm.elements.name);
}

function closeModelConfigEditModal() {
  if (!modelConfigEditModal) return;
  closeAnimatedLayer(modelConfigEditModal, () => {
    modelConfigState.editingId = "";
    modelConfigEditForm?.reset();
  });
}

async function saveModelConfigFromForm({ testAfter = false } = {}) {
  if (!modelConfigEditForm) return;
  const formData = new FormData(modelConfigEditForm);
  const id = String(formData.get("id") || "");
  const payload = {
    name: formData.get("name"),
    model: formData.get("model"),
    base_url: formData.get("base_url"),
    api_key: formData.get("api_key"),
  };
  const endpoint = id ? `/api/model-configs/${id}` : "/api/model-configs";
  const method = id ? "PUT" : "POST";
  try {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "模型配置保存失败");
    closeModelConfigEditModal();
    await loadModelConfigs({ silent: true });
    setModelConfigStatus("模型配置已保存。", "success");
    if (testAfter) await testModelConfig(data.item?.id);
  } catch (error) {
    setModelConfigStatus(error.message || "模型配置保存失败", "error");
  }
}

async function testModelConfig(id) {
  if (!id) return;
  setModelConfigStatus("正在测试模型连通性…", "muted");
  try {
    const response = await fetch(`/api/model-configs/${id}/test`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "模型连通性测试失败");
    const ok = data.ok === true || data.status === "ok";
    setModelConfigStatus(data.detail || (ok ? "测试通过。" : "测试失败。"), ok ? "success" : "error");
  } catch (error) {
    setModelConfigStatus(error.message || "模型连通性测试失败", "error");
  }
}

async function deleteModelConfig(id) {
  const item = modelConfigState.items.find((config) => String(config.id) === String(id));
  if (!item) return;
  const confirmed = await confirmAction({
    title: "删除模型配置",
    message: `确认删除 ${item.name} 吗？已写入 Agent profile 的配置不会受影响。`,
    confirmText: "删除",
    confirmVariant: "danger",
  });
  if (!confirmed) return;
  try {
    const response = await fetch(`/api/model-configs/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "模型配置删除失败");
    await loadModelConfigs({ silent: true });
    setModelConfigStatus("模型配置已删除。", "success");
  } catch (error) {
    setModelConfigStatus(error.message || "模型配置删除失败", "error");
  }
}

async function openAgentModelPanel(agentId) {
  if (!agentModelDrawer || !agentId) return;
  closeAgentContextMenu();
  modelConfigState.agentId = agentId;
  modelConfigState.agentName = agentList?.querySelector(`.agent-row[data-agent-id="${CSS.escape(agentId)}"]`)?.dataset.agentName || agentId;
  if (agentModelDrawerAgent) agentModelDrawerAgent.textContent = modelConfigState.agentName;
  setAgentModelStatus("正在加载当前模型…", "muted");
  openAnimatedLayer(agentModelDrawer);
  await loadModelConfigs({ silent: true });
  try {
    const response = await fetch(`/api/agents/${agentId}/model`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "当前模型读取失败");
    const model = data.model || {};
    if (agentModelCurrent) {
      const summary = [model.default || "未配置", model.base_url || ""].filter(Boolean).join(" · ");
      agentModelCurrent.textContent = `当前模型：${summary}`;
    }
    setAgentModelStatus("", "muted");
  } catch (error) {
    setAgentModelStatus(error.message || "当前模型读取失败", "error");
  }
}

function closeAgentModelPanel() {
  if (!agentModelDrawer) return;
  closeAnimatedLayer(agentModelDrawer, () => {
    modelConfigState.agentId = "";
    modelConfigState.agentName = "";
    setAgentModelStatus("", "muted");
  });
}

async function saveAgentModelSelection(event) {
  event.preventDefault();
  if (!modelConfigState.agentId || !agentModelSelect) return;
  const modelConfigId = agentModelSelect.value;
  if (!modelConfigId) {
    setAgentModelStatus("请选择模型配置。", "error");
    return;
  }
  if (saveAgentModel) saveAgentModel.disabled = true;
  try {
    const response = await fetch(`/api/agents/${modelConfigState.agentId}/model`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_config_id: modelConfigId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "模型配置保存失败");
    const restartHint = data.restart_required ? "，重启 Agent 后生效" : "";
    setAgentModelStatus(`模型配置已保存${restartHint}。`, "success");
    if (agentModelCurrent) {
      const model = data.model || {};
      agentModelCurrent.textContent = `当前模型：${[model.default || "未配置", model.base_url || ""].filter(Boolean).join(" · ")}`;
    }
  } catch (error) {
    setAgentModelStatus(error.message || "模型配置保存失败", "error");
  } finally {
    if (saveAgentModel) saveAgentModel.disabled = modelConfigState.items.length === 0;
  }
}

function buildMcpPayload() {
  const formData = new FormData(mcpEditForm);
  const transport = formData.get("transport") || "http";
  const payload = {
    name: String(formData.get("name") || "").trim(),
    transport,
    description: String(formData.get("description") || "").trim(),
  };
  if (transport === "http" || transport === "streamable_http") {
    payload.url = String(formData.get("url") || "").trim();
    payload.headers = parseKeyValueLines(formData.get("headers"));
  } else {
    payload.command = String(formData.get("command") || "").trim();
    payload.args = String(formData.get("args") || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    payload.env = parseKeyValueLines(formData.get("env"));
  }
  return payload;
}

async function saveMcpFromForm({ testAfter = false } = {}) {
  if (!mcpState.agentId || !mcpEditForm) return;
  const payload = buildMcpPayload();
  const editingName = mcpState.editingName;
  const method = editingName ? "PUT" : "POST";
  const url = editingName ? mcpEndpoint(editingName) : mcpEndpoint();
  setMcpStatus(editingName ? "正在保存 MCP…" : "正在新增 MCP…", "muted");
  try {
    let response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = await response.json().catch(() => ({}));
    if (response.status === 409 && !editingName) {
      const takeover = await confirmAction({
        title: "接管外部 MCP",
        message: "检测到 config.yaml 已有同名外部 MCP，是否接管并覆盖为平台可管理？",
        confirmText: "接管编辑",
        confirmVariant: "default",
      });
      if (!takeover) return;
      response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, takeover: true }),
      });
      data = await response.json().catch(() => ({}));
    }
    if (!response.ok || !data.ok) throw new Error(data.error || "MCP 保存失败");
    closeMcpEditModal();
      await refreshMcps();
    if (testAfter) {
      const testOk = await testMcp(editingName || payload.name);
      if (!testOk) return;
    }
    showMcpRestartPrompt("MCP 已保存。");
  } catch (error) {
    setMcpStatus(error.message || "MCP 保存失败", "error");
  }
}

async function revealMcp(name) {
  const confirmed = await confirmAction({ title: "显示 Secret", message: "确认在当前屏幕显示明文 secret 吗？", confirmText: "显示", confirmVariant: "default" });
  if (!confirmed) return;
  try {
    const response = await fetch(`${mcpEndpoint(name)}?reveal=1`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "MCP 加载失败");
    openMcpEditModal(data.mcp);
  } catch (error) {
    setMcpStatus(error.message || "MCP 加载失败", "error");
  }
}

async function editMcp(name) {
  try {
    const response = await fetch(mcpEndpoint(name));
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "MCP 加载失败");
    openMcpEditModal(data.mcp);
  } catch (error) {
    setMcpStatus(error.message || "MCP 加载失败", "error");
  }
}

async function testMcp(name) {
  const item = mcpState.items.find((mcp) => mcp.name === name);
  if (item?.transport === "stdio") {
    const confirmed = await confirmAction({ title: "执行本机命令", message: "stdio MCP 测试会在本机启动配置的 command，确认继续？", confirmText: "执行测试", confirmVariant: "danger" });
    if (!confirmed) return false;
  }
  setMcpStatus(`正在测试 ${name}…`, "muted");
  try {
    const response = await fetch(`${mcpEndpoint(name)}/test`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.detail || "MCP 测试失败");
    await refreshMcps();
    setMcpStatus(`${name}: ${data.detail || data.status}`, data.status === "ok" ? "success" : "error");
    return data.status === "ok";
  } catch (error) {
    setMcpStatus(error.message || "MCP 测试失败", "error");
    return false;
  }
}

async function deleteMcp(name) {
  const confirmed = await confirmAction({ title: "确认删除", message: `将从 config.yaml 移除 ${name}，确认继续？`, confirmText: "删除", confirmVariant: "danger" });
  if (!confirmed) return;
  setMcpStatus(`正在删除 ${name}…`, "muted");
  try {
    const response = await fetch(`${mcpEndpoint(name)}?confirm=1`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "MCP 删除失败");
    await refreshMcps();
    showMcpRestartPrompt(`${name} 已删除。`);
  } catch (error) {
    setMcpStatus(error.message || "MCP 删除失败", "error");
  }
}

async function setSkillsLetterFilter(letter) {
  const nextLetter = SKILL_ALPHA_OPTIONS.includes(letter) ? letter : "ALL";
  if (skillsState.activeLetter === nextLetter) return;
  skillsState.activeLetter = nextLetter;
  renderSkillAlphaNav();
  renderSkillItems();
  const filteredItems = getFilteredSkills();
  const nextSlug = filteredItems.some((skill) => skill.slug === skillsState.selectedSlug)
    ? skillsState.selectedSlug
    : filteredItems[0]?.slug || "";
  if (nextSlug) {
    await loadSkillDetail(nextSlug);
  } else {
    setSelectedSkillDetail(null);
  }
}

function openSkillsInstallModal() {
  if (!skillsInstallModal) return;
  openAnimatedLayer(skillsInstallModal, skillsInstallForm?.querySelector('input[name="repo_url"]'));
}

function closeSkillsInstallModal() {
  if (!skillsInstallModal) return;
  closeAnimatedLayer(skillsInstallModal, () => skillsInstallForm?.reset());
}

async function installSkillFromForm(event) {
  event.preventDefault();
  if (!skillsState.agentId || !skillsInstallForm) return;
  const formData = new FormData(skillsInstallForm);
  const repoUrl = String(formData.get("repo_url") || "").trim();
  if (!repoUrl) {
    setSkillsStatus("请输入 Git 仓库地址。", "error");
    return;
  }
  const payload = {
    repo_url: repoUrl,
    ref: formData.get("ref"),
    subdir: formData.get("subdir"),
    slug: formData.get("slug"),
  };
  const submitBtn = skillsInstallForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  setSkillsStatus("正在安装 skill…", "muted");
  try {
    const response = await fetch(`/api/agents/${skillsState.agentId}/skills/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "skill 安装失败");
    skillsInstallForm.reset();
    closeSkillsInstallModal();
    await refreshSkills(data.skill?.slug || "");
    showSkillsRestartPrompt("安装成功。");
  } catch (error) {
    setSkillsStatus(error.message || "skill 安装失败", "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function reinstallSelectedSkill() {
  if (!skillsState.agentId || !skillsState.selectedSlug) return;
  setSkillsStatus("正在重装 skill…", "muted");
  try {
    const response = await fetch(
      `/api/agents/${skillsState.agentId}/skills/${encodeURIComponent(skillsState.selectedSlug)}/reinstall`,
      { method: "POST" },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "skill 重装失败");
    await refreshSkills(data.skill?.slug || skillsState.selectedSlug);
    showSkillsRestartPrompt("重装成功。");
  } catch (error) {
    setSkillsStatus(error.message || "skill 重装失败", "error");
  }
}

async function uninstallSelectedSkill() {
  if (!skillsState.agentId || !skillsState.selectedSlug) return;
  const confirmed = await confirmAction({
    title: "确认卸载",
    message: `确认卸载 ${skillsState.selectedSlug} 吗？`,
    confirmText: "卸载",
    confirmVariant: "danger",
  });
  if (!confirmed) return;
  setSkillsStatus("正在卸载 skill…", "muted");
  try {
    const response = await fetch(
      `/api/agents/${skillsState.agentId}/skills/${encodeURIComponent(skillsState.selectedSlug)}`,
      { method: "DELETE" },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "skill 卸载失败");
    const removedSlug = skillsState.selectedSlug;
    setSelectedSkillDetail(null);
    await refreshSkills();
    showSkillsRestartPrompt(`${removedSlug} 已卸载。`);
  } catch (error) {
    setSkillsStatus(error.message || "skill 卸载失败", "error");
  }
}

async function openSoulPanel(agentId) {
  if (!soulDrawer || !agentId) return;
  closeAgentContextMenu();
  clearSoulPollTimer();
  const requestedAgentId = agentId;
  soulState.agentId = agentId;
  soulState.originalContent = "";
  soulState.runtimeStatus = "stopped";
  soulState.regenerating = false;
  if (soulEditor) {
    soulEditor.value = "";
    soulEditor.disabled = true;
  }
  renderMarkdownPreview("");
  syncSoulPreviewToEditor();
  setSoulStatus("正在加载 SOUL.md…", "muted");
  updateSoulDirtyState();
  openAnimatedLayer(soulDrawer);

  try {
    await refreshSoulContent({ focusEditor: true });
  } catch (error) {
    if (soulState.agentId !== requestedAgentId) return;
    setSoulStatus(error.message || "SOUL.md 加载失败", "error");
  } finally {
    if (soulState.agentId === requestedAgentId) updateSoulDirtyState();
  }
}

async function closeSoulPanel({ force = false } = {}) {
  if (!soulDrawer || soulDrawer.hidden) return;
  if (!force && hasUnsavedSoulChanges()) {
    const confirmed = await confirmAction({
      title: "确认关闭",
      message: "SOUL.md 有未保存修改，确认关闭吗？",
      confirmText: "关闭",
      confirmVariant: "warning",
    });
    if (!confirmed) return;
  }
  closeAnimatedLayer(soulDrawer, () => {
    clearSoulPollTimer();
    soulState.agentId = "";
    soulState.originalContent = "";
    soulState.runtimeStatus = "stopped";
    soulState.regenerating = false;
    setSoulStatus("", "muted");
  });
}

async function saveSoulContent() {
  if (!soulState.agentId || !soulEditor || !saveSoul) return;
  const content = soulEditor.value;
  if (!content.trim()) {
    setSoulStatus("SOUL.md 内容不能为空。", "error");
    updateSoulDirtyState();
    return;
  }
  soulState.saving = true;
  saveSoul.textContent = "保存中…";
  updateSoulDirtyState();
  try {
    const response = await fetch(`/api/agents/${soulState.agentId}/soul`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "SOUL.md 保存失败");
    }
    soulState.originalContent = data.content || "";
    soulState.runtimeStatus = data.agent?.runtime_status || soulState.runtimeStatus;
    if (soulEditor.value !== soulState.originalContent) {
      soulEditor.value = soulState.originalContent;
      renderMarkdownPreview(soulEditor.value);
      syncSoulPreviewToEditor();
    }
    const runningHint = soulState.runtimeStatus === "running" ? "，重启该 agent 后生效" : "";
    setSoulStatus(`已保存${runningHint}。`, "success");
  } catch (error) {
    setSoulStatus(error.message || "SOUL.md 保存失败", "error");
  } finally {
    soulState.saving = false;
    saveSoul.textContent = "保存";
    updateSoulDirtyState();
  }
}

async function regenerateSoulContent() {
  if (!soulState.agentId || !regenerateSoul) return;
  if (hasUnsavedSoulChanges()) {
    const confirmed = await confirmAction({
      title: "重新生成 SOUL.md",
      message: "当前有未保存修改，重新生成会覆盖文件内容。确认继续吗？",
      confirmText: "重新生成",
      confirmVariant: "warning",
    });
    if (!confirmed) return;
  }

  soulState.regenerating = true;
  regenerateSoul.textContent = "生成中…";
  if (soulEditor) soulEditor.disabled = true;
  setSoulStatus("正在重新生成 SOUL.md…", "muted");
  updateSoulDirtyState();
  try {
    const response = await fetch(`/api/agents/${soulState.agentId}/soul/regenerate`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "SOUL.md 重新生成失败");
    }
    pollSoulRegeneration();
  } catch (error) {
    soulState.regenerating = false;
    if (soulEditor) soulEditor.disabled = false;
    setSoulStatus(error.message || "SOUL.md 重新生成失败", "error");
    updateSoulDirtyState();
  } finally {
    regenerateSoul.textContent = "重新生成";
  }
}

function renderAgents(agents, stats) {
  if (!agentList) return;
  if (window.__BOOTSTRAP__) window.__BOOTSTRAP__.agents = agents;
  processSoundNotifications(agents);
  debugLog("render-agents", agents.map((agent) => ({
    agent_id: agent.agent_id,
    status: agent.status,
    interaction_state: agent.interaction_state,
    orchestration_state: agent.orchestration_state,
    runtime_status: agent.runtime_status,
    readiness_status: agent.readiness_status || "ready",
    queue_depth: agent.queue_depth || 0,
    current_task: agent.current_task,
  })));
  closeAgentContextMenu();
  const dispatchableAgents = agents.filter(isAgentDispatchable);
  const currentSelected = eventList?.dataset.selectedAgent || "";
  const selected = dispatchableAgents.some((agent) => agent.agent_id === currentSelected)
    ? currentSelected
    : (dispatchableAgents[0] && dispatchableAgents[0].agent_id) || "";
  agentList.innerHTML = "";
  // 多团队：选中团队时只显示该团队成员；否则按 team_id 分组渲染
  if (selectedKanbanTeam) {
    agents = agents.filter(kanbanAgentMatchesTeam);
  }
  const teams = (window.__BOOTSTRAP__?.teams) || [];
  const teamById = new Map(teams.map((t) => [t.team_id, t]));
  const groups = new Map(); // key: team_id|"", value: {label, agents: []}
  for (const agent of agents) {
    const key = agent.team_id || "";
    if (!groups.has(key)) {
      const team = key ? teamById.get(key) : null;
      groups.set(key, {
        label: team ? `${team.name}（${team.slug}）` : "",
        agents: [],
      });
    }
    groups.get(key).agents.push(agent);
  }
  for (const [teamKey, group] of groups) {
    if (group.label) {
      const header = document.createElement("div");
      header.className = "agent-team-header";
      header.textContent = group.label;
      agentList.appendChild(header);
    }
    for (const agent of group.agents) {
      if (isAgentDispatchable(agent)) {
        ensureTerminalSession(agent.agent_id);
      }
      agentList.appendChild(buildAgentRow(agent, agent.agent_id === selected));
    }
  }
  renderKanbanAssigneeOptions(agents);
  requestAnimationFrame(() => requestAnimationFrame(fitAllTerminalSessions));
  renderInteractions();
  if (agentEmpty) agentEmpty.hidden = agents.length > 0;
  if (sidebarStats && stats) {
    sidebarStats.innerHTML = stats
      .slice(0, 2)
      .map((s) => `<article class="mini-stat"><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></article>`)
      .join("");
  }
  if (dispatchableAgents.length > 0) {
    const active = dispatchableAgents.find((a) => a.agent_id === selected) || dispatchableAgents[0];
    setSelectedAgent(active.agent_id);
  } else {
    if (eventList) eventList.dataset.selectedAgent = "";
    if (terminalTitle) terminalTitle.textContent = "Agent Terminal";
    writeEmptyTerminalHint();
  }
  window.__HERMES_UI__?.onAgentsUpdate?.(agents, stats);
}

function setTransferStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message || "";
  element.hidden = !message;
  element.style.color = isError ? "#ff8a8a" : "#8ff0b3";
}

function setTeamRuntimeStatus(message, kind = "muted") {
  if (!teamRuntimeStatus) return;
  teamRuntimeStatus.textContent = message || "";
  teamRuntimeStatus.hidden = !message;
  teamRuntimeStatus.dataset.kind = kind;
}

function openTransferModal() {
  if (!transferModal) return;
  renderTransferAgents();
  setTransferStatus(transferExportStatus, "");
  setTransferStatus(transferImportStatus, "");
  setTeamRuntimeStatus("");
  setModelConfigStatus("", "muted");
  if (transferImportPreview) transferImportPreview.hidden = true;
  if (transferImportSubmit) transferImportSubmit.disabled = true;
  transferLastInspectedFile = null;
  openAnimatedLayer(transferModal, transferExportSubmit);
}

function closeTransferModal() {
  if (!transferModal) return;
  closeAnimatedLayer(transferModal);
}

function renderTransferAgents() {
  if (!transferAgentList) return;
  const agents = window.__BOOTSTRAP__?.agents || [];
  if (!agents.length) {
    transferAgentList.innerHTML = `<p class="form-hint">暂无可导出的 Agent。</p>`;
    return;
  }
  transferAgentList.innerHTML = agents.map((agent) => `
    <label class="transfer-agent-item">
      <span><strong>${escapeHtml(agent.name || agent.profile_name)}</strong><br><small>${escapeHtml(agent.role)} · ${escapeHtml(agent.profile_name)}</small></span>
      <input type="checkbox" value="${escapeHtml(agent.profile_name)}" checked>
    </label>
  `).join("");
}

function switchTransferTab(tabName) {
  transferModal?.querySelectorAll("[data-transfer-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.transferTab === tabName);
  });
  transferModal?.querySelectorAll("[data-transfer-pane]").forEach((pane) => {
    pane.hidden = pane.dataset.transferPane !== tabName;
  });
  if (tabName === "models") void loadModelConfigs();
}

async function runTeamRuntimeAction(action, button) {
  const label = teamRuntimeLabels[action] || action;
  const buttons = transferModal ? Array.from(transferModal.querySelectorAll("[data-team-runtime-action]")) : [];
  buttons.forEach((item) => { item.disabled = true; });
  setTeamRuntimeStatus(`正在${label}所有 Agent...`, "muted");
  try {
    const response = await fetch("/api/agents/runtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `全部${label}失败`);
    }
    const total = Array.isArray(data.results) ? data.results.length : 0;
    const skipped = Number(data.skipped || 0);
    const suffix = skipped ? `，跳过 ${skipped} 个未就绪 Agent` : "";
    setTeamRuntimeStatus(`已${label} ${total - skipped}/${total} 个 Agent${suffix}。`, "success");
  } catch (error) {
    setTeamRuntimeStatus(error.message || `全部${label}失败`, "error");
  } finally {
    buttons.forEach((item) => { item.disabled = false; });
    if (button) button.blur();
  }
}

async function initializeTeamAgents(button) {
  const confirmed = await confirmAction({
    title: "确认初始化 Agents",
    message: createInitializeAgentsConfirmMessage(),
    confirmText: "确认初始化",
    confirmVariant: "danger",
  });
  if (!confirmed) return;
  const buttons = transferModal ? Array.from(transferModal.querySelectorAll("[data-team-runtime-action], #team-initialize-agents")) : [];
  buttons.forEach((item) => { item.disabled = true; });
  setTeamRuntimeStatus("正在初始化所有 Agent...", "muted");
  try {
    const response = await fetch("/api/agents/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear_workspace: true, clear_history: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const kanbanError = Array.isArray(data.kanban?.errors) ? data.kanban.errors[0] : "";
      throw new Error(data.error || kanbanError || "初始化 Agents 失败");
    }
    const total = Array.isArray(data.results) ? data.results.length : 0;
    const failed = Number(data.failed || 0);
    const startup = data.startup || {};
    const started = Number(startup.started || 0);
    const skipped = Number(startup.skipped || 0);
    const startFailed = Number(startup.failed || 0);
    const suffix = skipped || startFailed ? `，启动 ${started} 个，跳过 ${skipped} 个，失败 ${startFailed} 个` : `，已启动 ${started} 个`;
    setTeamRuntimeStatus(`已初始化 ${total - failed}/${total} 个 Agent${suffix}。`, "success");
    if (Array.isArray(data.agents)) renderAgents(data.agents, null);
    kanbanState.links = [];
    kanbanState.pendingCreations = [];
    kanbanState.deletingTaskIds.clear();
    kanbanState.blockedTaskEnteredAt.clear();
    kanbanState.autoUnblockTaskIds.clear();
    clearKanbanAutoUnblockTimer();
    renderKanbanTasks();
  } catch (error) {
    setTeamRuntimeStatus(error.message || "初始化 Agents 失败", "error");
  } finally {
    buttons.forEach((item) => { item.disabled = false; });
    if (button) button.blur();
  }
}

async function exportTeamArchive() {
  const profileNames = Array.from(transferAgentList?.querySelectorAll("input:checked") || []).map((input) => input.value);
  if (!profileNames.length) {
    setTransferStatus(transferExportStatus, "请至少选择一个 Agent。", true);
    return;
  }
  transferExportSubmit.disabled = true;
  setTransferStatus(transferExportStatus, "正在导出…");
  try {
    const response = await fetch("/api/transfer/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_names: profileNames,
        options: {
          inline_skill_files: Boolean(transferInlineSkills?.checked),
          include_workspace: Boolean(transferIncludeWorkspace?.checked),
        },
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "导出失败");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
    const filename = match ? decodeURIComponent(match[1].replace(/"/g, "")) : "hermes-agent-team.zip";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setTransferStatus(transferExportStatus, "导出完成。请保存下载的 zip。");
  } catch (error) {
    setTransferStatus(transferExportStatus, error.message || "导出失败", true);
  } finally {
    transferExportSubmit.disabled = false;
  }
}

async function inspectTeamArchive() {
  const file = transferImportFile?.files?.[0];
  if (!file) {
    setTransferStatus(transferImportStatus, "请选择 zip 文件。", true);
    return;
  }
  transferInspectSubmit.disabled = true;
  if (transferImportSubmit) transferImportSubmit.disabled = true;
  setTransferStatus(transferImportStatus, "正在预检…");
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/transfer/inspect", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "预检失败");
    transferLastInspectedFile = file;
    renderImportPreview(data);
    if (transferImportSubmit) transferImportSubmit.disabled = false;
    setTransferStatus(transferImportStatus, "预检通过。确认后可导入。");
  } catch (error) {
    setTransferStatus(transferImportStatus, error.message || "预检失败", true);
  } finally {
    transferInspectSubmit.disabled = false;
  }
}

function renderImportPreview(data) {
  if (!transferImportPreview) return;
  const clear = data.will_clear || {};
  const secrets = data.missing_secrets || [];
  const rows = (data.agents || []).map((agent) => `
    <div class="transfer-preview-row"><span>${escapeHtml(agent.profile_name)}</span><small>${escapeHtml(agent.role || "worker")}</small></div>
  `).join("");
  const secretRows = secrets.length
    ? `<div class="transfer-secret-list"><strong>导入后需要补齐</strong>${secrets.map((item) => `<small>${escapeHtml(item)}</small>`).join("")}</div>`
    : `<p class="form-hint">未检测到需要手动补齐的凭据。</p>`;
  transferImportPreview.innerHTML = `
    <p class="form-hint">将导入 ${data.agents?.length || 0} 个 Agent；导入前会删除本机 ${clear.agents || 0} 个 Agent、${clear.workspaces || 0} 个 workspace，并清空运行历史。</p>
    ${rows || `<p class="form-hint">包内没有 Agent。</p>`}
    ${secretRows}
  `;
  transferImportPreview.hidden = false;
}

async function importTeamArchive() {
  const file = transferImportFile?.files?.[0];
  if (!file || file !== transferLastInspectedFile) {
    setTransferStatus(transferImportStatus, "请先预检当前文件。", true);
    return;
  }
  const confirmed = await confirmAction({
    title: "确认导入团队",
    message: "导入前将解雇并删除本机所有 agents、workspace 与运行历史，确认继续？",
    confirmText: "确认导入",
    confirmVariant: "danger",
  });
  if (!confirmed) return;
  transferImportSubmit.disabled = true;
  setTransferStatus(transferImportStatus, "正在导入…");
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/transfer/import", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "导入失败");
    const success = (data.results || []).filter((item) => item.success).length;
    setTransferStatus(transferImportStatus, `导入完成：${success}/${(data.results || []).length} 成功。`);
  } catch (error) {
    setTransferStatus(transferImportStatus, error.message || "导入失败", true);
  } finally {
    transferImportSubmit.disabled = false;
  }
}

function hydrateChatEvents() {
  const events = Array.isArray(window.__BOOTSTRAP__?.events) ? window.__BOOTSTRAP__.events : [];
  events.slice().reverse().forEach((event) => {
    rememberChatEvent(event);
  });
}

function createTerminalInstance(agentId) {
  const term = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 14,
    lineHeight: 1.42,
    scrollback: 5000,
    cols: defaultTerminalCols,
    rows: defaultTerminalRows,
    theme: {
      background: "#020201",
      foreground: "#fff8ea",
      cursor: "#f6cf75",
      selectionBackground: "#4a3511",
      black: "#090704",
      red: "#ff7b73",
      green: "#61e294",
      yellow: "#f0ab25",
      blue: "#b88935",
      magenta: "#d6a85a",
      cyan: "#f6cf75",
      white: "#f4efe4",
      brightBlack: "#b1a38f",
      brightWhite: "#fff8e8",
    },
  });
  const fitAddon = new FitAddon.FitAddon();
  const pane = document.createElement("div");
  pane.className = "terminal-pane";
  pane.dataset.agentId = agentId;
  term.loadAddon(fitAddon);
  registerTerminalUrlLinks(term);
  terminalViewport.appendChild(pane);
  term.open(pane);
  term.onData((data) => {
    const session = terminalSessions.get(agentId);
    if (session && agentId !== "__empty__") {
      sendTerminalSocketMessage(session, { type: "input", data });
    }
  });
  return {
    agentId,
    term,
    fitAddon,
    pane,
    ws: null,
    lastRows: 0,
    lastCols: 0,
    reconnectTimer: 0,
    connectToken: 0,
    reconnectEnabled: false,
    hasRenderedOutput: false,
  };
}

function ensureTerminalSession(agentId) {
  if (!agentId || !terminalViewport || !window.Terminal || !window.FitAddon) {
    return null;
  }
  let session = terminalSessions.get(agentId);
  if (session) return session;
  session = createTerminalInstance(agentId);
  terminalSessions.set(agentId, session);
  return session;
}

function writeTerminalNotice(session, message) {
  if (!session || !message) return;
  session.term.write(`\x1b[90m${message}\x1b[0m\r\n`);
}

function resetTerminalSessionView(session, message = "") {
  if (!session) return;
  session.term.reset();
  session.term.clear();
  session.hasRenderedOutput = false;
  if (message) writeTerminalNotice(session, message);
}

function buildTerminalSocketUrl(agentId) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/agents/${encodeURIComponent(agentId)}/terminal/ws`;
}

function clearTerminalReconnect(session) {
  if (!session?.reconnectTimer) return;
  window.clearTimeout(session.reconnectTimer);
  session.reconnectTimer = 0;
}

function disconnectTerminalSession(session) {
  if (!session || session.agentId === "__empty__") return;
  clearTerminalReconnect(session);
  session.reconnectEnabled = false;
  session.connectToken += 1;
  const ws = session.ws;
  session.ws = null;
  if (ws && ws.readyState < WebSocket.CLOSING) {
    ws.close();
  }
}

function sendTerminalSocketMessage(session, payload) {
  if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) return false;
  session.ws.send(JSON.stringify(payload));
  return true;
}

function scheduleTerminalReconnect(session, delay = terminalReconnectDelay) {
  if (!session || !session.reconnectEnabled || session.reconnectTimer) return;
  if ((eventList?.dataset.selectedAgent || "") !== session.agentId) return;
  session.reconnectTimer = window.setTimeout(() => {
    session.reconnectTimer = 0;
    connectTerminalSession(session);
  }, delay);
}

function handleTerminalSocketMessage(session, payload) {
  if (!session || !payload || typeof payload !== "object") return;
  if (payload.type === "ready") {
    debugLog("terminal-ready", {
      agentId: session.agentId,
      rows: payload.rows,
      cols: payload.cols,
      snapshotTextLength: String(payload.snapshot_text || "").length,
      snapshotAnsiLength: String(payload.snapshot_ansi || "").length,
    });
    session.reconnectEnabled = true;
    const snapRows = typeof payload.rows === "number" ? payload.rows : 0;
    const snapCols = typeof payload.cols === "number" ? payload.cols : 0;
    const ansi = String(payload.snapshot_ansi || "");
    debugLog("terminal-ready-detail", {
      agentId: session.agentId,
      payloadRows: snapRows,
      payloadCols: snapCols,
      termBefore: { rows: session.term.rows, cols: session.term.cols },
      paneSize: session.pane ? { w: session.pane.offsetWidth, h: session.pane.offsetHeight, active: session.pane.classList.contains("is-active") } : null,
      ansiLen: ansi.length,
      ansiHead: JSON.stringify(ansi.slice(0, 240)),
      ansiTail: JSON.stringify(ansi.slice(-240)),
    });
    if (snapRows > 0 && snapCols > 0) {
      try { session.term.resize(snapCols, snapRows); } catch (_) {}
      session.lastRows = snapRows;
      session.lastCols = snapCols;
    }
    if (!restoreTerminalSnapshot(session, payload) && !session.hasRenderedOutput) {
      session.term.reset();
      session.term.clear();
    }
    debugLog("terminal-ready-after", {
      agentId: session.agentId,
      termAfter: { rows: session.term.rows, cols: session.term.cols },
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fitTerminal();
      fitTerminal();
    }));
    return;
  }
  if (payload.type === "output") {
    logTerminalPayload("terminal-output", session, payload);
    if (!session.hasRenderedOutput) {
      session.term.reset();
      session.term.clear();
      session.hasRenderedOutput = true;
    }
    session.term.write(String(payload.data || ""));
    return;
  }
  if (payload.type === "status") {
    session.reconnectEnabled = false;
    resetTerminalSessionView(session, payload.message || "终端不可用");
  }
}

function connectTerminalSession(session) {
  if (!session || session.agentId === "__empty__") return;
  if (activeKanbanTerminalTaskId) return;
  if ((eventList?.dataset.selectedAgent || "") !== session.agentId) return;
  if (session.ws && (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  clearTerminalReconnect(session);
  session.reconnectEnabled = true;
  const token = session.connectToken + 1;
  session.connectToken = token;
  resetTerminalSessionView(session, "正在连接终端…");
  const ws = new WebSocket(buildTerminalSocketUrl(session.agentId));
  session.ws = ws;

  ws.addEventListener("open", () => {
    if (session.connectToken !== token) return;
    debugLog("terminal-ws-open", { agentId: session.agentId });
    requestAnimationFrame(() => requestAnimationFrame(fitTerminal));
  });

  ws.addEventListener("message", (event) => {
    if (session.connectToken !== token) return;
    try {
      const payload = JSON.parse(event.data);
      if (payload?.type !== "output") {
        debugLog("terminal-ws-message", {
          agentId: session.agentId,
          type: payload?.type,
          payload,
        });
      }
      handleTerminalSocketMessage(session, payload);
    } catch (e) {
      debugLog("terminal-ws-message-error", { agentId: session.agentId, error: String(e) });
    }
  });

  ws.addEventListener("close", () => {
    if (session.connectToken !== token) return;
    debugLog("terminal-ws-close", { agentId: session.agentId, reconnect: session.reconnectEnabled });
    session.ws = null;
    if (session.reconnectEnabled) {
      resetTerminalSessionView(session, "终端连接已断开，正在重连…");
      scheduleTerminalReconnect(session);
    }
  });

  ws.addEventListener("error", () => {
    debugLog("terminal-ws-error", { agentId: session.agentId });
  });
}

function writeEmptyTerminalHint() {
  if (!terminalViewport) return;
  terminalSessions.forEach((session) => {
    if (session.agentId !== "__empty__") disconnectTerminalSession(session);
    session.pane.classList.remove("is-active");
  });
  let session = terminalSessions.get("__empty__");
  if (!session && window.Terminal && window.FitAddon) {
    session = createTerminalInstance("__empty__");
    terminalSessions.set("__empty__", session);
  }
  if (session) {
    resetTerminalSessionView(session, "还没有员工。创建并启动员工后，这里会显示交互终端。");
    session.pane.classList.add("is-active");
    scheduleTerminalFit(0);
  }
}

function fitTerminalSession(session, tag = "") {
  if (!session) return;
  const pane = session.pane;
  const beforeRows = session.term.rows;
  const beforeCols = session.term.cols;
  const paneInfo = pane ? {
    offsetW: pane.offsetWidth,
    offsetH: pane.offsetHeight,
    clientW: pane.clientWidth,
    clientH: pane.clientHeight,
    isActive: pane.classList.contains("is-active"),
  } : null;
  try {
    session.fitAddon.fit();
    debugLog("terminal-fit", {
      tag,
      agentId: session.agentId,
      pane: paneInfo,
      before: { rows: beforeRows, cols: beforeCols },
      after: { rows: session.term.rows, cols: session.term.cols },
      last: { rows: session.lastRows, cols: session.lastCols },
    });
    if (session.agentId === "__empty__") return;
    if (session.term.rows !== session.lastRows || session.term.cols !== session.lastCols) {
      session.lastRows = session.term.rows;
      session.lastCols = session.term.cols;
      const sent = sendTerminalSocketMessage(session, {
        type: "resize",
        rows: session.term.rows,
        cols: session.term.cols,
      });
      debugLog("terminal-resize-sent", {
        tag,
        agentId: session.agentId,
        rows: session.term.rows,
        cols: session.term.cols,
        sent,
      });
    }
  } catch (e) {
    debugLog("terminal-fit-error", { tag, agentId: session.agentId, error: String(e), pane: paneInfo });
  }
}

function fitAllTerminalSessions() {
  terminalSessions.forEach((session) => fitTerminalSession(session));
}

function initTerminal() {
  if (!terminalViewport || !window.Terminal || !window.FitAddon) return;
  const selectedAgentId = eventList?.dataset.selectedAgent || "";
  if (selectedAgentId) {
    const session = ensureTerminalSession(selectedAgentId);
    if (session) connectTerminalSession(session);
  } else {
    writeEmptyTerminalHint();
  }
  scheduleTerminalFit(0);
  scheduleTerminalFit(80);
  requestAnimationFrame(() => requestAnimationFrame(fitTerminal));
}

function fitTerminal() {
  const agentId = eventList?.dataset.selectedAgent || "";
  const session = terminalSessions.get(agentId);
  if (!session || !session.pane.classList.contains("is-active")) return;
  fitTerminalSession(session);
}

function scheduleTerminalFit(delay = 120) {
  window.setTimeout(fitTerminal, delay);
}

function debounceTerminalFit(delay = 120) {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(fitTerminal, delay);
}

function setSelectedAgent(agentId, agentName, force = false, options = {}) {
  if (!agentList || !eventList) return;
  if (activeKanbanTerminalTaskId && !force) return;
  if (force) clearKanbanTerminalLog();
  const row = agentList.querySelector(`.agent-row[data-agent-id="${CSS.escape(agentId)}"]`);
  if (!row || row.dataset.readinessStatus !== "ready") return;
  if (!options.allowStopped && row.dataset.agentRuntimeStatus !== "running") return;
  const name = agentName || row?.dataset.agentName || agentId || "尚未选择";
  const changed = eventList.dataset.selectedAgent !== agentId;
  agentList.querySelectorAll(".agent-row").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.agentId === agentId);
  });
  eventList.dataset.selectedAgent = agentId;
  renderInteractions();
  if (terminalTitle) terminalTitle.textContent = agentId ? `${name} · Hermes Terminal` : "Agent Terminal";
  const session = ensureTerminalSession(agentId);
  terminalSessions.forEach((item, key) => {
    item.pane.classList.toggle("is-active", key === agentId);
    if (key !== agentId) disconnectTerminalSession(item);
  });
  debugLog("terminal-switch", {
    agentId,
    changed,
    force,
    sessionExists: !!session,
    paneSize: session?.pane ? { w: session.pane.offsetWidth, h: session.pane.offsetHeight } : null,
    termSize: session ? { rows: session.term.rows, cols: session.term.cols } : null,
  });
  if (session && (changed || force || !session.ws || session.ws.readyState > WebSocket.OPEN)) {
    requestAnimationFrame(() => {
      fitTerminalSession(session, "switch-pre-connect");
      connectTerminalSession(session);
      requestAnimationFrame(() => requestAnimationFrame(fitTerminal));
    });
  }
  scheduleTerminalFit(0);
}

function openAgentTerminal(agentId, agentName = "") {
  const agent = (window.__BOOTSTRAP__?.agents || []).find((item) => item.agent_id === agentId);
  if (!agent || (agent.readiness_status || "ready") !== "ready") return false;
  setSelectedAgent(agent.agent_id, agentName || agent.name, true, { allowStopped: true });
  openTerminalPanel();
  return true;
}

function handleRuntimeEvent(event) {
  if (!eventList) return;
  if (event.event_type === "agent.terminal.output" || event.event_type === "agent.terminal.snapshot") {
    return;
  }
  if (rememberChatEvent(event)) renderInteractions();
  if (String(event.event_type || "").startsWith("kanban.")) {
    if (kanbanState.pendingCreations.length) {
      kanbanState.pendingCreations.forEach((item) => window.clearTimeout(item.timeoutId));
      kanbanState.pendingCreations = [];
    }
    refreshKanbanTasks({ silent: true });
  }
}

function canDismissAgentRow(row) {
  if (!row) return false;
  const isIdle = row.dataset.agentStatus === "idle"
    && (row.dataset.agentOrchestrationState || "none") === "none";
  const isUnavailable = (row.dataset.readinessStatus || "ready") !== "ready"
    || (row.dataset.agentRuntimeStatus || "stopped") !== "running";
  return isIdle || isUnavailable;
}

function ensureAgentContextMenu() {
  if (agentContextMenu) return agentContextMenu;
  agentContextMenu = document.createElement("div");
  agentContextMenu.className = "agent-context-menu";
  agentContextMenu.hidden = true;
  agentContextMenu.dataset.mode = "danger";
  agentContextMenu.innerHTML = `
    <button class="agent-context-menu__item" type="button" data-agent-soul>
      SOUL.md
    </button>
    <button class="agent-context-menu__item" type="button" data-agent-skills>
      Skills
    </button>
    <button class="agent-context-menu__item" type="button" data-agent-mcp>
      MCP Servers
    </button>
    <button class="agent-context-menu__item" type="button" data-agent-model>
      模型配置
    </button>
    <button class="agent-context-menu__item" type="button" data-agent-open-workspace>
      打开工作目录
    </button>
    <div class="agent-context-menu__separator" data-config-separator></div>
    <button class="agent-context-menu__item agent-context-menu__item--danger" type="button" data-agent-delete>
      解雇
    </button>
  `;
  agentContextMenu.addEventListener("click", async (event) => {
    event.stopPropagation();
    const soulBtn = event.target.closest("[data-agent-soul]");
    if (soulBtn) {
      const agentId = agentContextMenu.dataset.agentId || "";
      if (agentId) openSoulPanel(agentId);
      closeAgentContextMenu();
      return;
    }
    const skillsBtn = event.target.closest("[data-agent-skills]");
    if (skillsBtn) {
      const agentId = agentContextMenu.dataset.agentId || "";
      if (agentId) openSkillsPanel(agentId);
      closeAgentContextMenu();
      return;
    }
    const mcpBtn = event.target.closest("[data-agent-mcp]");
    if (mcpBtn) {
      const agentId = agentContextMenu.dataset.agentId || "";
      if (agentId) openMcpPanel(agentId);
      closeAgentContextMenu();
      return;
    }
    const modelBtn = event.target.closest("[data-agent-model]");
    if (modelBtn) {
      const agentId = agentContextMenu.dataset.agentId || "";
      if (agentId) openAgentModelPanel(agentId);
      closeAgentContextMenu();
      return;
    }
    const workspaceBtn = event.target.closest("[data-agent-open-workspace]");
    if (workspaceBtn) {
      const agentId = agentContextMenu.dataset.agentId || "";
      if (!agentId || workspaceBtn.disabled) return;
      workspaceBtn.disabled = true;
      try {
        const response = await fetch(`/api/agents/${agentId}/open-workspace`, { method: "POST" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          alert(data.error || "打开工作目录失败");
          return;
        }
        closeAgentContextMenu();
      } finally {
        workspaceBtn.disabled = false;
      }
      return;
    }
    const btn = event.target.closest("[data-agent-delete]");
    if (!btn || btn.disabled) return;
    const agentId = agentContextMenu.dataset.agentId || "";
    const agentName = agentContextMenu.dataset.agentName || agentId;
    if (!agentId || deletingAgentId) return;

    const confirmed = await confirmAgentDismissal(agentName);
    if (!confirmed) {
      closeAgentContextMenu();
      return;
    }

    deletingAgentId = agentId;
    btn.disabled = true;
    try {
      const response = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        alert(data.error || "解雇失败");
        return;
      }
      closeAgentContextMenu();
    } finally {
      deletingAgentId = "";
      btn.disabled = false;
    }
  });
  document.body.appendChild(agentContextMenu);
  return agentContextMenu;
}

function positionAgentContextMenu(menu, clientX, clientY) {
  menu.hidden = false;
  const padding = 8;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(clientX, window.innerWidth - rect.width - padding);
  const top = Math.min(clientY, window.innerHeight - rect.height - padding);
  menu.style.left = `${Math.max(padding, left)}px`;
  menu.style.top = `${Math.max(padding, top)}px`;
}

function showAgentConfigMenu(row, trigger) {
  const menu = ensureAgentContextMenu();
  const soulBtn = menu.querySelector("[data-agent-soul]");
  const skillsBtn = menu.querySelector("[data-agent-skills]");
  const mcpBtn = menu.querySelector("[data-agent-mcp]");
  const modelBtn = menu.querySelector("[data-agent-model]");
  const separator = menu.querySelector("[data-config-separator]");
  const deleteBtn = menu.querySelector("[data-agent-delete]");
  const canDelete = canDismissAgentRow(row);
  const rect = trigger.getBoundingClientRect();
  menu.dataset.agentId = row.dataset.agentId || trigger.dataset.agentId || "";
  menu.dataset.agentName = row.dataset.agentName || "";
  menu.dataset.mode = "config";
  if (soulBtn) {
    const soulDisabled = (row.dataset.readinessStatus || "ready") === "preparing";
    soulBtn.hidden = false;
    soulBtn.disabled = soulDisabled;
    soulBtn.title = soulDisabled ? "SOUL.md 正在生成中" : "";
    soulBtn.textContent = soulDisabled ? "SOUL.md 生成中" : "SOUL.md";
  }
  if (skillsBtn) skillsBtn.hidden = false;
  if (mcpBtn) mcpBtn.hidden = false;
  if (modelBtn) modelBtn.hidden = false;
  if (separator) separator.hidden = false;
  if (deleteBtn) {
    deleteBtn.hidden = !canDelete;
    deleteBtn.disabled = !canDelete;
    deleteBtn.textContent = "解雇";
  }
  positionAgentContextMenu(menu, rect.left, rect.bottom + 8);
}

function closeAgentContextMenu() {
  if (!agentContextMenu) return;
  agentContextMenu.hidden = true;
  agentContextMenu.dataset.agentId = "";
  agentContextMenu.dataset.agentName = "";
}

function closeAllContextMenus() {
  closeAgentContextMenu();
  closeKanbanContextMenu();
  closeKanbanAssigneeMenu();
}

function confirmAgentDismissal(agentName) {
  const name = agentName || "该 Agent";
  return confirmAction({
    title: "确认解雇",
    message: `你要解雇 ${name} 吗？`,
    confirmText: "解雇",
    confirmVariant: "danger",
  });
}

function ensureConfirmModal() {
  if (confirmModal) return confirmModal;
  const modalEl = document.createElement("div");
  modalEl.className = "modal confirm-modal";
  modalEl.hidden = true;
  modalEl.innerHTML = `
    <div class="modal__backdrop" data-confirm-cancel></div>
    <div class="modal__panel panel confirm-modal__panel" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div class="modal__head">
        <h2 id="confirm-modal-title" data-confirm-title>确认操作</h2>
      </div>
      <p class="confirm-modal__message" data-confirm-message></p>
      <div class="modal__actions">
        <button type="button" class="filter-chip" data-confirm-cancel>取消</button>
        <button type="button" class="confirm-modal__confirm" data-confirm-submit>确定</button>
      </div>
    </div>
  `;
  modalEl.resolve = null;
  const closeWith = (value) => {
    const resolve = modalEl.resolve;
    modalEl.resolve = null;
    if (resolve) resolve(value);
    closeAnimatedLayer(modalEl);
  };
  modalEl.addEventListener("click", (event) => {
    if (event.target.closest("[data-confirm-submit]")) {
      closeWith(true);
      return;
    }
    if (event.target.closest("[data-confirm-cancel]")) {
      closeWith(false);
    }
  });
  document.body.appendChild(modalEl);
  confirmModal = modalEl;
  return confirmModal;
}

function confirmAction({ title = "确认操作", message = "", confirmText = "确定", confirmVariant = "danger", hideCancel = false } = {}) {
  const modal = ensureConfirmModal();
  modal.querySelector("[data-confirm-title]").textContent = title;
  const messageEl = modal.querySelector("[data-confirm-message]");
  messageEl.replaceChildren();
  if (message instanceof Node) {
    messageEl.appendChild(message);
  } else {
    messageEl.textContent = message;
  }
  const cancelBtn = modal.querySelector("button[data-confirm-cancel]");
  if (cancelBtn) cancelBtn.hidden = hideCancel;
  const confirmBtn = modal.querySelector("[data-confirm-submit]");
  confirmBtn.textContent = confirmText;
  confirmBtn.dataset.variant = confirmVariant;
  openAnimatedLayer(modal, confirmBtn);

  return new Promise((resolve) => {
    modal.resolve = resolve;
  });
}

function createInitializeAgentsConfirmMessage() {
  const wrapper = document.createElement("div");
  wrapper.className = "confirm-modal__checklist";
  const sections = [
    {
      title: "执行以下操作：",
      tone: "danger",
      items: ["关闭所有 Agent", "重建 Kanban board", "清空每个 workspace", "清空历史任务"],
    },
    {
      title: "保留以下内容：",
      tone: "safe",
      items: ["Agent 人设", "模型配置", "技能配置", "MCP 配置"],
    },
  ];
  sections.forEach((section) => {
    const card = document.createElement("section");
    card.className = `confirm-modal__checklist-section confirm-modal__checklist-section--${section.tone}`;
    const title = document.createElement("h3");
    title.textContent = section.title;
    const list = document.createElement("ul");
    section.items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.appendChild(listItem);
    });
    card.append(title, list);
    wrapper.appendChild(card);
  });
  const note = document.createElement("p");
  note.className = "confirm-modal__checklist-note";
  note.textContent = "完成后会自动启动就绪 Agent。";
  wrapper.appendChild(note);
  return wrapper;
}

if (agentList) {
  agentList.addEventListener("click", (event) => {
    closeAgentContextMenu();
    const configBtn = event.target.closest("[data-agent-config]");
    if (configBtn) {
      event.stopPropagation();
      const row = configBtn.closest(".agent-row");
      if (row) showAgentConfigMenu(row, configBtn);
      return;
    }
    const skillsBtn = event.target.closest("[data-skills-open]");
    if (skillsBtn) {
      event.stopPropagation();
      openSkillsPanel(skillsBtn.dataset.agentId || "");
      return;
    }
    const mcpBtn = event.target.closest("[data-mcp-open]");
    if (mcpBtn) {
      event.stopPropagation();
      openMcpPanel(mcpBtn.dataset.agentId || "");
      return;
    }
    const soulBtn = event.target.closest("[data-soul-open]");
    if (soulBtn) {
      event.stopPropagation();
      openSoulPanel(soulBtn.dataset.agentId || "");
      return;
    }
    const btn = event.target.closest("[data-session-action]");
    if (btn) {
      event.stopPropagation();
      if (btn.disabled) return;
      const action = btn.dataset.sessionAction;
      const agentId = btn.dataset.agentId;
      btn.disabled = true;
      fetch(`/api/agents/${agentId}/${action}`, { method: "POST" })
        .catch(() => {})
        .finally(() => { btn.disabled = false; });
      return;
    }
    const row = event.target.closest(".agent-row");
    if (!row) return;
    if (row.dataset.readinessStatus !== "ready" || row.dataset.agentRuntimeStatus !== "running") return;
    setSelectedAgent(row.dataset.agentId, row.dataset.agentName, true);
  });

  agentList.addEventListener("scroll", closeAgentContextMenu, { passive: true });
}

if (openTeamSettings) {
  openTeamSettings.addEventListener("click", openTransferModal);
}

if (transferModal) {
  transferModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeTransfer !== undefined) {
      closeTransferModal();
      return;
    }
    const tab = event.target.closest("[data-transfer-tab]");
    if (tab) switchTransferTab(tab.dataset.transferTab || "export");
    const runtimeBtn = event.target.closest("[data-team-runtime-action]");
    if (runtimeBtn) void runTeamRuntimeAction(runtimeBtn.dataset.teamRuntimeAction || "", runtimeBtn);
    const initBtn = event.target.closest("#team-initialize-agents");
    if (initBtn) void initializeTeamAgents(initBtn);
  });
}

transferExportSubmit?.addEventListener("click", exportTeamArchive);
transferInspectSubmit?.addEventListener("click", inspectTeamArchive);
transferImportSubmit?.addEventListener("click", importTeamArchive);
transferImportFile?.addEventListener("change", () => {
  transferLastInspectedFile = null;
  if (transferFileName) {
    transferFileName.textContent = transferImportFile.files?.[0]?.name || "选择 hermes-agent-team-时间.zip 文件";
  }
  if (transferImportSubmit) transferImportSubmit.disabled = true;
  if (transferImportPreview) transferImportPreview.hidden = true;
  setTransferStatus(transferImportStatus, "");
});

document.addEventListener("click", (event) => {
  if (agentContextMenu?.contains(event.target)) return;
  if (kanbanContextMenu?.contains(event.target)) return;
  if (kanbanAssigneeMenu?.contains(event.target)) return;
  closeAllContextMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (confirmModal && !confirmModal.hidden) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeAnimatedLayer(confirmModal, () => {
      const resolve = confirmModal.resolve;
      confirmModal.resolve = null;
      if (resolve) resolve(false);
    });
    return;
  }
  const modalClosers = [
    [modelConfigEditModal, closeModelConfigEditModal],
    [mcpEditModal, closeMcpEditModal],
    [skillsInstallModal, closeSkillsInstallModal],
    [modal, closeModal],
    [teamsManageModal, () => closeAnimatedLayer(teamsManageModal)],
    [transferModal, closeTransferModal],
  ];
  for (const [layer, close] of modalClosers) {
    if (layer && !layer.hidden) {
      event.preventDefault();
      close();
      return;
    }
  }
  closeAllContextMenus();
  if (terminalDrawer && !terminalDrawer.hidden) {
    closeTerminalPanel();
    return;
  }
  if (historyDrawer && !historyDrawer.hidden) {
    closeHistoryPanel();
    return;
  }
  if (soulDrawer && !soulDrawer.hidden) {
    void closeSoulPanel();
    return;
  }
  if (skillsDrawer && !skillsDrawer.hidden) {
    closeSkillsPanel();
    return;
  }
  if (agentModelDrawer && !agentModelDrawer.hidden) closeAgentModelPanel();
});

window.addEventListener("resize", closeAllContextMenus);
window.addEventListener("resize", () => {
  debounceTerminalFit(120);
  window.setTimeout(fitAllTerminalSessions, 180);
});

if (window.ResizeObserver && terminalViewport) {
  const terminalResizeObserver = new ResizeObserver(() => debounceTerminalFit(60));
  terminalResizeObserver.observe(terminalViewport);
}

if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    scheduleTerminalFit(0);
    scheduleTerminalFit(160);
    window.setTimeout(fitAllTerminalSessions, 200);
  });
}

async function ensureHermesReadyForAgentCreation(button) {
  if (button) button.disabled = true;
  try {
    const { response, data } = await checkHermesStatus({ force: true });
    if (response.ok && data.ok) {
      if (hermesProfileOptions) {
        hermesProfileOptions.innerHTML = (data.profiles || [])
          .map((profile) => `<option value="${escapeHtml(profile)}"></option>`)
          .join("");
      }
      return true;
    }
    await confirmAction({
      title: "需要配置 Hermes",
      message: data.message || "Hermes 当前不可用，请先安装并配置 Hermes Agent。",
      confirmText: "知道了",
      confirmVariant: "default",
      hideCancel: true,
    });
    return false;
  } catch (error) {
    await confirmAction({
      title: "检测失败",
      message: "无法检测 Hermes 状态，请确认服务正常运行后重试。",
      confirmText: "知道了",
      confirmVariant: "default",
      hideCancel: true,
    });
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

function openModal(returnTarget = null) {
  if (!modal) return;
  if (createAgentError) {
    createAgentError.hidden = true;
    createAgentError.textContent = "";
  }
  const teamSelect = document.getElementById("create-agent-team");
  if (teamSelect) {
    teamSelect.innerHTML = '<option value="">未分组</option>' + (window.__BOOTSTRAP__?.teams || [])
      .map(team => `<option value="${escapeHtml(team.slug)}">${escapeHtml(team.name)}</option>`).join("");
    teamSelect.value = selectedKanbanTeam || "";
  }
  openAnimatedLayer(modal, createAgentForm?.querySelector('input[name="name"]'), returnTarget);
}

function closeModal() {
  if (!modal) return;
  closeAnimatedLayer(modal, () => createAgentForm?.reset());
}

if (openCreateAgent) {
  openCreateAgent.addEventListener("click", async () => {
    if (await ensureHermesReadyForAgentCreation(openCreateAgent)) openModal(openCreateAgent);
  });
  window.setTimeout(() => {
    void checkHermesStatus().catch(() => {});
  }, 300);
}
if (openHistoryDrawer) openHistoryDrawer.addEventListener("click", openHistoryPanel);
if (kanbanTaskForm) kanbanTaskForm.addEventListener("submit", submitKanbanTask);
if (kanbanTaskInput) kanbanTaskInput.addEventListener("keydown", handleKanbanTaskInputKeydown);
if (kanbanAssigneeTrigger) kanbanAssigneeTrigger.addEventListener("click", (event) => {
  event.stopPropagation();
  if (kanbanAssigneeMenu && !kanbanAssigneeMenu.hidden) {
    closeKanbanAssigneeMenu();
  } else {
    openKanbanAssigneeMenu();
  }
});
if (kanbanPanelsToggle) kanbanPanelsToggle.addEventListener("click", toggleKanbanPanels);
if (kanbanRefresh) kanbanRefresh.addEventListener("click", () => refreshKanbanTasks());
if (kanbanAutoDispatch) {
  if (kanbanAutoDispatch instanceof HTMLInputElement && kanbanAutoDispatch.type === "checkbox") {
    kanbanAutoDispatch.addEventListener("change", toggleKanbanAutoDispatch);
  } else {
    kanbanAutoDispatch.addEventListener("click", toggleKanbanAutoDispatch);
  }
}
if (kanbanDispatch) kanbanDispatch.addEventListener("click", dispatchKanbanOnce);
if (kanbanProcessRefresh) {
  kanbanProcessRefresh.addEventListener("click", () => {
    if (activeKanbanTerminalLink && activeKanbanTerminalAgent) {
      refreshKanbanTaskLog(activeKanbanTerminalLink, activeKanbanTerminalAgent);
    }
  });
}
if (terminalDrawer) {
  terminalDrawer.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeTerminal !== undefined) {
      closeTerminalPanel();
    }
  });
}
if (historyDrawer) {
  historyDrawer.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeHistory !== undefined) {
      closeHistoryPanel();
    }
  });
}
if (soulDrawer) {
  soulDrawer.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeSoul !== undefined) {
      void closeSoulPanel();
    }
  });
}
if (skillsDrawer) {
  skillsDrawer.addEventListener("click", (event) => {
    const restartBtn = event.target.closest("[data-skills-restart-agent]");
    if (restartBtn) {
      event.preventDefault();
      restartCurrentSkillsAgent(restartBtn);
      return;
    }
    if (event.target instanceof HTMLElement && event.target.dataset.closeSkills !== undefined) {
      closeSkillsPanel();
    }
  });
}
if (mcpDrawer) {
  mcpDrawer.addEventListener("click", (event) => {
    const restartBtn = event.target.closest("[data-mcp-restart-agent]");
    if (restartBtn) {
      event.preventDefault();
      restartCurrentMcpAgent(restartBtn);
      return;
    }
    const revealBtn = event.target.closest("[data-mcp-reveal]");
    if (revealBtn) {
      revealMcp(revealBtn.dataset.mcpReveal || "");
      return;
    }
    const editBtn = event.target.closest("[data-mcp-edit]");
    if (editBtn && !editBtn.disabled) {
      editMcp(editBtn.dataset.mcpEdit || "");
      return;
    }
    const testBtn = event.target.closest("[data-mcp-test]");
    if (testBtn) {
      testMcp(testBtn.dataset.mcpTest || "");
      return;
    }
    const deleteBtn = event.target.closest("[data-mcp-delete]");
    if (deleteBtn && !deleteBtn.disabled) {
      deleteMcp(deleteBtn.dataset.mcpDelete || "");
      return;
    }
    if (event.target instanceof HTMLElement && event.target.dataset.closeMcp !== undefined) {
      closeMcpPanel();
    }
  });
}
if (agentModelDrawer) {
  agentModelDrawer.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeAgentModel !== undefined) {
      closeAgentModelPanel();
    }
  });
}
if (openMcpEdit) openMcpEdit.addEventListener("click", () => openMcpEditModal());
if (mcpRefresh) mcpRefresh.addEventListener("click", () => refreshMcps());
if (mcpEditModal) {
  mcpEditModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeMcpEdit !== undefined) {
      closeMcpEditModal();
    }
  });
}
if (mcpEditForm) {
  mcpEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveMcpFromForm();
  });
  mcpEditForm.elements.transport.addEventListener("change", toggleMcpTransportFields);
}
if (mcpSaveTest) {
  mcpSaveTest.addEventListener("click", () => saveMcpFromForm({ testAfter: true }));
}
if (openModelConfigEdit) openModelConfigEdit.addEventListener("click", () => openModelConfigEditModal());
if (modelConfigList) {
  modelConfigList.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-model-config-edit]");
    if (editBtn) {
      const item = modelConfigState.items.find((config) => String(config.id) === String(editBtn.dataset.modelConfigEdit));
      if (item) openModelConfigEditModal(item);
      return;
    }
    const testBtn = event.target.closest("[data-model-config-test]");
    if (testBtn) {
      testModelConfig(testBtn.dataset.modelConfigTest || "");
      return;
    }
    const deleteBtn = event.target.closest("[data-model-config-delete]");
    if (deleteBtn) {
      deleteModelConfig(deleteBtn.dataset.modelConfigDelete || "");
    }
  });
}
if (modelConfigEditModal) {
  modelConfigEditModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModelConfigEdit !== undefined) {
      closeModelConfigEditModal();
    }
  });
}
if (modelConfigEditForm) {
  modelConfigEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveModelConfigFromForm();
  });
}
if (modelConfigSaveTest) {
  modelConfigSaveTest.addEventListener("click", () => saveModelConfigFromForm({ testAfter: true }));
}
if (agentModelForm) agentModelForm.addEventListener("submit", saveAgentModelSelection);
if (openSkillsInstall) openSkillsInstall.addEventListener("click", openSkillsInstallModal);
if (skillsInstallModal) {
  skillsInstallModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeSkillsInstall !== undefined) {
      closeSkillsInstallModal();
    }
  });
}
if (skillsList) {
  skillsList.addEventListener("click", (event) => {
    const row = event.target.closest(".skill-row");
    if (!row) return;
    loadSkillDetail(row.dataset.slug || "");
  });
}
if (skillsAlphaNav) {
  skillsAlphaNav.addEventListener("click", (event) => {
    const button = event.target.closest(".skill-alpha-chip");
    if (!button || button.disabled) return;
    setSkillsLetterFilter(button.dataset.letter || "ALL");
  });
}
if (skillsInstallForm) skillsInstallForm.addEventListener("submit", installSkillFromForm);
if (skillsRefresh) skillsRefresh.addEventListener("click", () => refreshSkills());
if (skillsReinstall) skillsReinstall.addEventListener("click", reinstallSelectedSkill);
if (skillsUninstall) skillsUninstall.addEventListener("click", uninstallSelectedSkill);
if (soulEditor) {
  soulEditor.addEventListener("input", () => {
    const scrollRatio = getScrollRatio(soulEditor);
    renderMarkdownPreview(soulEditor.value);
    if (soulPreview) setScrollRatio(soulPreview, scrollRatio);
    updateSoulDirtyState();
  });
  soulEditor.addEventListener("scroll", () => {
    syncSoulScroll(soulEditor, soulPreview, "editor");
  });
}
if (soulPreview) {
  soulPreview.addEventListener("scroll", () => {
    syncSoulScroll(soulPreview, soulEditor, "preview");
  });
}
if (saveSoul) saveSoul.addEventListener("click", saveSoulContent);
if (regenerateSoul) regenerateSoul.addEventListener("click", regenerateSoulContent);
if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal !== undefined) {
      closeModal();
    }
  });
}

const teamManagement = {};

if (createAgentForm) {

// ===== 多团队：团队管理弹窗 =====
let teamsManageSelected = "";

async function fetchTeamsList() {
  const response = await fetch("/api/teams");
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "团队加载失败，请重试");
  return Array.isArray(data.teams) ? data.teams : [];
}

function renderTeamsManageList(teams) {
  if (!teamsManageList) return;
  if (!teams.length) {
    teamsManageList.innerHTML = `<p class="form-hint">还没有团队，先创建一个。</p>`;
    return;
  }
  teamsManageList.innerHTML = "";
  for (const team of teams) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "team-item" + (team.slug === teamsManageSelected ? " is-active" : "");
    btn.dataset.slug = team.slug;
    btn.innerHTML = `
      <span class="team-item__name">${escapeHtml(team.name)}</span>
      <span class="team-item__meta">${escapeHtml(team.slug)} · ${team.member_count || 0} 成员 · 板 ${escapeHtml(team.board_name || "-")}</span>`;
    btn.addEventListener("click", () => {
      teamsManageSelected = team.slug;
      renderTeamsManageList(teamsCache);
      renderTeamDetail(team);
    });
    teamsManageList.appendChild(btn);
  }
}

let teamsCache = [];

async function refreshTeamsManage() {
  teamsCache = await fetchTeamsList();
  window.__HERMES_APP__?.setTeams(teamsCache);
  renderTeamsManageList(teamsCache);
  const current = teamsCache.find((t) => t.slug === teamsManageSelected);
  if (current) renderTeamDetail(current);
  else if (teamsManageDetail) {
    teamsManageDetail.innerHTML = `<p class="form-hint">从左侧选择一个团队查看成员。</p>`;
  }
}

function renderTeamDetail(team) {
  if (!teamsManageDetail) return;
  const members = Array.isArray(team?.members) ? team.members : [];
  const memberIds = new Set(members.map((m) => m.agent_id));
  const allAgents = window.__BOOTSTRAP__?.agents || [];
  const hasLeader = members.some((member) => member.role === "leader");
  const joinable = allAgents.filter((a) => !memberIds.has(a.agent_id) && !(hasLeader && a.role === "leader"));

  const memberRows = members.length
    ? members
        .map(
          (m) => `
        <div class="team-member-row">
          <div class="team-member-row__main">
            <span class="team-member-row__name">${escapeHtml(m.name || m.profile_name)}${m.role === "leader" ? " · 负责人" : ""}</span>
            <span class="team-member-row__sub">${escapeHtml(m.profile_name)} · ${escapeHtml(m.status || "")} · ${escapeHtml(m.runtime_status || "")}</span>
          </div>
          <button class="filter-chip" type="button" data-team-remove="${escapeHtml(m.agent_id)}">移出</button>
        </div>`
        )
        .join("")
    : `<p class="form-hint">该团队暂无成员。</p>`;

  const options = joinable.length
    ? joinable
        .map(
          (a) =>
            `<option value="${escapeHtml(a.agent_id)}">${escapeHtml(a.name || a.profile_name)}（${escapeHtml(a.role)}${a.team_id ? " · 已在他组" : ""}）</option>`
        )
        .join("")
    : `<option value="">暂无可加入的 agent</option>`;

  teamsManageDetail.innerHTML = `
    <div class="team-detail__head">
      <h3>${escapeHtml(team.name)}</h3>
      <span class="form-hint">${escapeHtml(team.slug)} · 看板 ${escapeHtml(team.board_name || "-")}</span>
      <button class="filter-chip" type="button" id="team-delete-btn">解散团队</button>
    </div>
    ${team.description ? `<p class="team-manage__hint">${escapeHtml(team.description)}</p>` : ""}
    <div class="team-detail__members">${memberRows}</div>
    <form class="team-manage__join" id="team-join-form">
      <select name="agent_id" required>
        <option value="">选择要加入的 agent…</option>
        ${options}
      </select>
      <button type="submit" class="primary-button primary-button--sm">拉入团队</button>
    </form>
    <p class="form-hint">加入已有成员会移动其团队归属；移出成员保留 Profile、技能和记忆。</p>
    <p class="form-error" id="team-detail-error" role="alert" hidden></p>`;

  let memberOperationPending = false;
  function setMemberBusy(busy) {
    memberOperationPending = busy;
    teamsManageDetail.querySelectorAll("button, select").forEach(control => { control.disabled = busy; });
  }
  const joinForm = teamsManageDetail.querySelector("#team-join-form");
  joinForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (memberOperationPending) return;
    const agentId = new FormData(joinForm).get("agent_id");
    const errEl = teamsManageDetail.querySelector("#team-detail-error");
    if (errEl) errEl.hidden = true;
    setMemberBusy(true);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(team.slug)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "加入失败");
      await refreshTeamsManage();
    } catch (e) {
      if (errEl) { errEl.textContent = e.message; errEl.hidden = false; }
    } finally {
      setMemberBusy(false);
    }
  });

  teamsManageDetail.querySelectorAll("[data-team-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (memberOperationPending) return;
      const agentId = btn.dataset.teamRemove;
      setMemberBusy(true);
      try {
        const response = await fetch(`/api/teams/${encodeURIComponent(team.slug)}/members/${encodeURIComponent(agentId)}`, {
          method: "DELETE",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "移出失败");
        await refreshTeamsManage();
      } catch (e) {
        const errEl = teamsManageDetail.querySelector("#team-detail-error");
        if (errEl) { errEl.textContent = e.message; errEl.hidden = false; }
      } finally {
        setMemberBusy(false);
      }
    });
  });

  teamsManageDetail.querySelector("#team-delete-btn")?.addEventListener("click", async () => {
    if (memberOperationPending) return;
    if (members.length) {
      const error = teamsManageDetail.querySelector("#team-detail-error");
      error.textContent = "请先移出所有成员，再删除团队。Agent Profile 不会被删除。";
      error.hidden = false;
      return;
    }
    if (!confirm(`确定删除空团队「${team.name}」？此操作不会删除 Agent Profile。`)) return;
    setMemberBusy(true);
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(team.slug)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "解散失败");
      teamsManageSelected = "";
      await refreshTeamsManage();
      if (teamsManageDetail) teamsManageDetail.innerHTML = `<p class="form-hint">团队已解散。</p>`;
    } catch (e) {
      const errEl = teamsManageDetail.querySelector("#team-detail-error");
      if (errEl) { errEl.textContent = e.message; errEl.hidden = false; }
    } finally {
      setMemberBusy(false);
    }
  });
}

let teamModalRequest = 0;
function resetTeamForm() {
  createTeamForm.reset();
  delete createTeamForm.dataset.editSlug;
  createTeamForm.elements.namedItem("slug").readOnly = false;
  createTeamForm.querySelector('button[type="submit"]').textContent = "创建团队";
  createTeamError.hidden = true;
}
async function openTeamManager(slug = "", edit = false) {
  const requestId = ++teamModalRequest;
  resetTeamForm();
  teamsManageSelected = slug;
  createTeamForm.hidden = !!slug && !edit;
  const submitBtn = createTeamForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  teamsManageDetail.innerHTML = '<p class="form-hint" role="status">正在加载团队…</p>';
  openAnimatedLayer(teamsManageModal, teamsManageModal.querySelector('[data-close-teams-manage]'));
  try {
    const teams = await fetchTeamsList();
    if (requestId !== teamModalRequest || teamsManageModal.hidden) return;
    teamsCache = teams;
    window.__HERMES_APP__?.setTeams(teams);
    renderTeamsManageList(teams);
    const team = teams.find((item) => item.slug === slug);
    if (slug && !team) throw new Error("团队不存在或已被删除，请关闭后重试");
    if (team) renderTeamDetail(team);
    else teamsManageDetail.innerHTML = '<p class="form-hint">创建团队后可添加已有 Agent。</p>';
    if (edit && team) {
      createTeamForm.dataset.editSlug = team.slug;
      for (const key of ["slug", "name", "description"]) {
        createTeamForm.elements.namedItem(key).value = team[key] || "";
      }
      createTeamForm.elements.namedItem("slug").readOnly = true;
      submitBtn.textContent = "保存更改";
    }
    submitBtn.disabled = false;
    if (!createTeamForm.hidden) createTeamForm.elements.namedItem(edit ? "name" : "slug").focus();
  } catch (error) {
    if (requestId !== teamModalRequest) return;
    teamsManageDetail.innerHTML = `<p class="form-error" role="alert">${escapeHtml(error.message)}</p><button type="button" class="filter-chip" id="team-load-retry">重试</button>`;
    teamsManageDetail.querySelector("#team-load-retry").addEventListener("click", () => { void openTeamManager(slug, edit); });
  }
}
teamManagement.open = openTeamManager;
openTeamsPage?.addEventListener("click", () => { void openTeamManager(); });
document.getElementById("open-teams-manage-modal")?.addEventListener("click", () => {
  closeAnimatedLayer(transferModal);
  void openTeamManager();
});

document.querySelectorAll("[data-close-teams-manage]").forEach((el) => {
  el.addEventListener("click", () => closeAnimatedLayer(teamsManageModal));
});

createTeamForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = createTeamForm.querySelector('button[type="submit"]');
  if (submitBtn?.disabled) return;
  const formData = new FormData(createTeamForm);
  const editSlug = createTeamForm.dataset.editSlug;
  if (submitBtn) submitBtn.disabled = true;
  try {
    const response = await fetch(editSlug ? `/api/teams/${encodeURIComponent(editSlug)}` : "/api/teams", {
      method: editSlug ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: formData.get("slug"),
        name: formData.get("name"),
        description: formData.get("description"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "创建失败");
    createTeamError.hidden = true;
    resetTeamForm();
    teamsManageSelected = data.team?.slug || teamsManageSelected;
    await refreshTeamsManage();
    window.__HERMES_UI__?.refreshTeams?.();
  } catch (e) {
    if (createTeamError) { createTeamError.textContent = e.message; createTeamError.hidden = false; }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

  createAgentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(createAgentForm);
    const payload = {
      name: formData.get("name"),
      profile_name: formData.get("profile_name"),
      team: formData.get("team") || "",
      role: formData.get("role"),
      description: formData.get("description"),
    };
    const modelConfigId = String(formData.get("model_config_id") || "");
    const submitBtn = createAgentForm.querySelector('button[type="submit"]');
    if (submitBtn?.disabled) return;
    const originalSubmitText = submitBtn?.textContent || "入职";
    if (createAgentError) {
      createAgentError.hidden = true;
      createAgentError.textContent = "";
      createAgentError.dataset.kind = "error";
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "接入中…";
    }
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (createAgentError) {
          createAgentError.textContent = data.error || "创建失败";
          createAgentError.hidden = false;
        }
        return;
      }
      if (modelConfigId && data.agent?.agent_id) {
        const modelResponse = await fetch(`/api/agents/${data.agent.agent_id}/model`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_config_id: modelConfigId }),
        });
        const modelData = await modelResponse.json().catch(() => ({}));
        if (!modelResponse.ok || !modelData.ok) {
          if (createAgentError) {
            createAgentError.textContent = modelData.error || "Agent 已创建，但模型配置应用失败";
            createAgentError.hidden = false;
          }
          return;
        }
      }
      closeModal();
    } catch (error) {
      if (createAgentError) {
        createAgentError.textContent = error.message || "网络异常，请稍后重试";
        createAgentError.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalSubmitText;
      }
    }
  });
}

const _sseToken = getStoredApiToken();
const stream = new EventSource(
  _sseToken ? `/api/events/stream?token=${encodeURIComponent(_sseToken)}` : "/api/events/stream"
);
stream.addEventListener("event", (event) => {
  const payload = JSON.parse(event.data);
  handleRuntimeEvent(payload);
});
stream.addEventListener("agents", (event) => {
  const payload = JSON.parse(event.data);
  debugLog("sse-agents", payload);
  if (window.__BOOTSTRAP__ && payload.teams) window.__BOOTSTRAP__.teams = payload.teams;
  renderAgents(payload.agents || [], payload.stats || []);
});
stream.onmessage = (event) => {
  try {
    const payload = JSON.parse(event.data);
    if (payload && payload.event_type) handleRuntimeEvent(payload);
  } catch (e) {
    /* ignore */
  }
};

hydrateChatEvents();
hydrateNotificationStates(window.__BOOTSTRAP__?.agents || []);
renderKanbanAssigneeOptions(window.__BOOTSTRAP__?.agents || []);
renderAgents(window.__BOOTSTRAP__?.agents || [], window.__BOOTSTRAP__?.stats || []);
renderKanbanTasks();
renderKanbanPanelsToggle();
initKanbanTeamOrnamentMotion();
renderKanbanAutoDispatch();
void loadModelConfigs({ silent: true });
void loadKanbanSettings();
initTerminal();
if (eventList?.dataset.selectedAgent) {
  const row = agentList?.querySelector(`.agent-row[data-agent-id="${CSS.escape(eventList.dataset.selectedAgent)}"]`);
  if (row?.dataset.readinessStatus === "ready" && row?.dataset.agentRuntimeStatus === "running") {
    setSelectedAgent(eventList.dataset.selectedAgent, row?.dataset.agentName, true);
  }
}

window.__HERMES_APP__ = {
  teamManagement,
  kanbanLinkMatchesTeam,
  setTeams(teams) {
    window.__BOOTSTRAP__.teams = teams;
    const memberships = new Map(teams.flatMap(team => (team.members || []).map(member => [member.agent_id, team.team_id])));
    if (teams.every(team => Array.isArray(team.members))) {
      window.__BOOTSTRAP__.agents = (window.__BOOTSTRAP__.agents || []).map(agent => ({...agent, team_id: memberships.get(agent.agent_id) || null}));
    }
    renderKanbanAssigneeOptions();
    renderKanbanTasks();
    window.__HERMES_UI__?.onTeamsUpdate?.();
  },
  openKanbanTask,
  openAgentTerminal,
  kanbanRoleLabel,
  kanbanStatusLabel,
  kanbanDisplayStatus,
  kanbanColumnForStatus,
  agentForKanbanLink,
  formatDateTime,
  escapeHtml,
  getAgentDisplayStatus,
  openSoulPanel,
  openSkillsPanel,
  openMcpPanel,
  openAgentModelPanel,
  openTransferModal,
  openModal,
  toggleKanbanAutoDispatch,
  clearDoneKanbanTasks,
  clearColumnKanbanTasks,
};
