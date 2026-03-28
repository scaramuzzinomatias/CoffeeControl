const CURRENT_ORIGIN = /^https?:\/\//.test(window.location.origin) ? window.location.origin : "";
const STORAGE_COMPANIES_KEY = "cc_mgr_companies";
const STORAGE_ACTIVE_COMPANY_KEY = "cc_mgr_company";
const STORAGE_SESSIONS_KEY = "cc_mgr_sessions";

let COMPANIES = loadCompanies();
let SESSIONS = loadSessions();
let ACTIVE_COMPANY_ID = localStorage.getItem(STORAGE_ACTIVE_COMPANY_KEY) || "";
let BASE = "";
let TOKEN = "";
let CURRENT_ROLE = null;
let CURRENT_USER = null;
let currentPage = "home";
let healthState = null;
let lastRefreshAt = null;
let refreshTimer = null;
let installPromptEvent = null;

let dashboardToday = null;
let dashboardMonthly = null;
let machinesState = [];
let alertsState = { summary: { total_open: 0, danger_count: 0, warn_count: 0, by_type: [] }, alerts: [] };
let reportState = { overview: null, machines: [], employees: [], departments: [] };

let machineFilters = { q: "", mode: "all" };
let alertFilters = { severity: "all" };
let reportFilters = buildDefaultReportFilters();

bootstrapCompanies();
hydrateActiveCompany();

document.getElementById("loginPass").addEventListener("keydown", event => {
  if (event.key === "Enter") doLogin();
});
document.getElementById("showLoginPass").addEventListener("change", event => {
  document.getElementById("loginPass").type = event.target.checked ? "text" : "password";
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeSheet();
});
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPromptEvent = event;
  document.getElementById("installBtn").classList.remove("hidden");
});
window.addEventListener("online", () => pingHealth(true));
window.addEventListener("offline", () => {
  healthState = { ok: false, message: "Sin conexión local" };
  updateStatusStrip();
});

registerServiceWorker();

if (TOKEN) {
  showApp();
} else if (activeCompany()) {
  showLogin();
} else {
  showCompanyScreen();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;
  navigator.serviceWorker.register("/coffeecontrol-gerente-sw.js").catch(() => {});
}

function loadCompanies() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_COMPANIES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function loadSessions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_SESSIONS_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (_) {
    return {};
  }
}

function saveCompaniesState() {
  localStorage.setItem(STORAGE_COMPANIES_KEY, JSON.stringify(COMPANIES));
}

function saveSessionsState() {
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(SESSIONS));
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function makeCompanyId() {
  return `company_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function bootstrapCompanies() {
  const normalizedOrigin = normalizeUrl(CURRENT_ORIGIN);
  if (!normalizedOrigin) return;
  const existing = COMPANIES.find(company => normalizeUrl(company.url) === normalizedOrigin);
  if (existing) return;
  COMPANIES.unshift({
    id: makeCompanyId(),
    name: "Instalación actual",
    url: normalizedOrigin
  });
  saveCompaniesState();
  if (!ACTIVE_COMPANY_ID) {
    ACTIVE_COMPANY_ID = COMPANIES[0].id;
    localStorage.setItem(STORAGE_ACTIVE_COMPANY_KEY, ACTIVE_COMPANY_ID);
  }
}

function activeCompany() {
  return COMPANIES.find(company => company.id === ACTIVE_COMPANY_ID) || null;
}

function hydrateActiveCompany() {
  const company = activeCompany();
  BASE = company ? normalizeUrl(company.url) : "";
  const session = company ? SESSIONS[company.id] : null;
  TOKEN = session?.token || "";
  const decoded = decodeJwtPayload(TOKEN);
  CURRENT_ROLE = decoded?.role || session?.role || null;
  CURRENT_USER = decoded?.username || session?.username || null;
}

function persistSessionForCurrentCompany(payload) {
  const company = activeCompany();
  if (!company) return;
  SESSIONS[company.id] = {
    token: payload.token,
    username: payload.username,
    role: payload.role,
    saved_at: new Date().toISOString()
  };
  saveSessionsState();
  hydrateActiveCompany();
}

function clearSessionForCurrentCompany() {
  const company = activeCompany();
  if (!company) return;
  delete SESSIONS[company.id];
  saveSessionsState();
  TOKEN = "";
  CURRENT_ROLE = null;
  CURRENT_USER = null;
}

function selectCompany(companyId) {
  ACTIVE_COMPANY_ID = companyId;
  localStorage.setItem(STORAGE_ACTIVE_COMPANY_KEY, companyId);
  hydrateActiveCompany();
  closeSheet();
  if (TOKEN) {
    showApp();
    return;
  }
  showLogin();
}

function backToCompanies() {
  setInlineBanner("loginErr", "");
  showCompanyScreen();
}

function saveCompany() {
  const name = String(document.getElementById("companyName").value || "").trim();
  const url = normalizeUrl(document.getElementById("companyUrl").value);
  if (!name || !url) {
    setInlineBanner("companyErr", "Completá nombre y backend para guardar la empresa.");
    return;
  }
  const existing = COMPANIES.find(company => normalizeUrl(company.url) === url);
  if (existing) {
    existing.name = name;
    saveCompaniesState();
    renderCompanyList();
    setInlineBanner("companyErr", "La empresa ya existía. Actualicé su nombre.", true);
    document.getElementById("companyName").value = "";
    document.getElementById("companyUrl").value = "";
    return;
  }
  const company = { id: makeCompanyId(), name, url };
  COMPANIES.push(company);
  saveCompaniesState();
  setInlineBanner("companyErr", "Empresa guardada.", true);
  document.getElementById("companyName").value = "";
  document.getElementById("companyUrl").value = "";
  renderCompanyList();
}

function removeCompany(companyId) {
  const company = COMPANIES.find(item => item.id === companyId);
  if (!company) return;
  if (!confirm(`¿Eliminar ${company.name} de esta app? Solo borra el perfil local.`)) return;
  COMPANIES = COMPANIES.filter(item => item.id !== companyId);
  delete SESSIONS[companyId];
  saveCompaniesState();
  saveSessionsState();
  if (ACTIVE_COMPANY_ID === companyId) {
    ACTIVE_COMPANY_ID = COMPANIES[0]?.id || "";
    if (ACTIVE_COMPANY_ID) {
      localStorage.setItem(STORAGE_ACTIVE_COMPANY_KEY, ACTIVE_COMPANY_ID);
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_COMPANY_KEY);
    }
    hydrateActiveCompany();
  }
  renderCompanyList();
}

function showCompanyScreen() {
  stopRefreshLoop();
  document.getElementById("companyScreen").classList.remove("hidden");
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.add("hidden");
  renderCompanyList();
  setInlineBanner("loginErr", "");
}

function showLogin() {
  document.getElementById("companyScreen").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
  renderSelectedCompany();
  document.getElementById("loginUser").focus();
}

async function showApp() {
  const decoded = decodeJwtPayload(TOKEN);
  CURRENT_ROLE = decoded?.role || CURRENT_ROLE;
  CURRENT_USER = decoded?.username || CURRENT_USER;
  if (!isManagerAppRole(CURRENT_ROLE)) {
    clearSessionForCurrentCompany();
    setInlineBanner("loginErr", "Esta app es solo para admin, gerente o supervisor.");
    showLogin();
    return;
  }

  document.getElementById("companyScreen").classList.add("hidden");
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  renderTabbar();
  updateStatusStrip();
  renderCurrentPage();
  await refreshAllData(true);
  startRefreshLoop();
}

function renderCompanyList() {
  const node = document.getElementById("companyList");
  if (!COMPANIES.length) {
    node.innerHTML = `<div class="empty-state">Todavía no hay empresas cargadas. Agregá una instalación y después entrá con sus credenciales.</div>`;
    return;
  }
  node.innerHTML = COMPANIES.map(company => {
    const hasSession = Boolean(SESSIONS[company.id]?.token);
    const active = company.id === ACTIVE_COMPANY_ID;
    return `
      <article class="company-card ${active ? "active" : ""}">
        <div class="meta-row">
          <div>
            <strong>${escHtml(company.name)}</strong>
            <small>${escHtml(company.url)}</small>
          </div>
          <span class="badge ${hasSession ? "ok" : "neutral"}">${hasSession ? "Sesión guardada" : "Sin sesión"}</span>
        </div>
        <div class="inline-actions">
          <button class="btn btn-primary btn-sm" type="button" onclick="selectCompany('${escJs(company.id)}')">Usar empresa</button>
          <button class="btn btn-ghost btn-sm" type="button" onclick="openCompanyInBrowser('${escJs(company.id)}')">Abrir web</button>
          <button class="btn btn-danger btn-sm" type="button" onclick="removeCompany('${escJs(company.id)}')">Quitar</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderSelectedCompany() {
  const company = activeCompany();
  const node = document.getElementById("selectedCompanyCard");
  if (!company) {
    node.innerHTML = `<div class="empty-state">Seleccioná una empresa para continuar.</div>`;
    return;
  }
  const session = SESSIONS[company.id];
  node.innerHTML = `
    <div class="meta-row">
      <div>
        <strong>${escHtml(company.name)}</strong>
        <p class="muted">${escHtml(company.url)}</p>
      </div>
      <span class="badge ${session?.token ? "ok" : "neutral"}">${session?.token ? "Sesión recordada" : "Ingreso manual"}</span>
    </div>
  `;
}

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escJs(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function parseJsonSafe(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function decodeJwtPayload(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  try {
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

function isManagerAppRole(role) {
  return role === "admin" || role === "gerente" || role === "supervisor";
}

function timeSince(iso) {
  if (!iso) return "Sin dato";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "Sin dato";
  if (diff < 60000) return "Hace instantes";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

function formatDateTime(iso) {
  if (!iso) return "Sin dato";
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return value.toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatCurrency(cents) {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-AR").format(Number(value || 0));
}

function setInlineBanner(id, message, success = false) {
  const node = document.getElementById(id);
  if (!node) return;
  if (!message) {
    node.classList.add("hidden");
    node.classList.remove("success");
    node.textContent = "";
    return;
  }
  node.classList.remove("hidden");
  node.classList.toggle("success", !!success);
  node.textContent = message;
}

function showToast(message, tone = "") {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.className = `toast ${tone}`.trim();
  node.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => node.classList.add("hidden"), 3200);
}

function openSheet({ eyebrow = "", title = "", body = "", footer = "" }) {
  document.getElementById("sheetEyebrow").textContent = eyebrow;
  document.getElementById("sheetTitle").textContent = title;
  document.getElementById("sheetBody").innerHTML = body;
  document.getElementById("sheetFooter").innerHTML = footer;
  const sheet = document.getElementById("sheet");
  sheet.classList.remove("hidden");
  sheet.setAttribute("aria-hidden", "false");
}

function closeSheet() {
  const sheet = document.getElementById("sheet");
  sheet.classList.add("hidden");
  sheet.setAttribute("aria-hidden", "true");
  document.getElementById("sheetBody").innerHTML = "";
  document.getElementById("sheetFooter").innerHTML = "";
}

function openAdminPanel() {
  if (!BASE) return;
  window.open(`${BASE}/`, "_blank", "noopener");
}

function openCompanyInBrowser(companyId) {
  const company = COMPANIES.find(item => item.id === companyId);
  if (!company?.url) return;
  window.open(company.url, "_blank", "noopener");
}

async function installApp() {
  if (!installPromptEvent) {
    showToast("La instalación web no está disponible en este navegador.", "warn");
    return;
  }
  installPromptEvent.prompt();
  await installPromptEvent.userChoice.catch(() => {});
  installPromptEvent = null;
  document.getElementById("installBtn").classList.add("hidden");
}

function roleLabel(role = CURRENT_ROLE) {
  return {
    admin: "Administrador",
    gerente: "Gerente",
    supervisor: "Supervisor"
  }[role] || role || "Sin rol";
}

function updateStatusStrip() {
  const company = activeCompany();
  const statusCompany = document.getElementById("statusCompany");
  const statusBackend = document.getElementById("statusBackend");
  const statusUser = document.getElementById("statusUser");
  const statusRefresh = document.getElementById("statusRefresh");
  if (!statusCompany) return;

  statusCompany.className = "status-pill";
  statusCompany.textContent = company ? company.name : "Sin empresa";

  statusBackend.className = `status-pill ${healthState?.ok ? "ok" : "warn"}`;
  statusBackend.textContent = healthState?.ok ? "Backend en línea" : (healthState?.message || "Sin verificar");

  statusUser.className = "status-pill";
  statusUser.textContent = CURRENT_USER ? `${CURRENT_USER} · ${roleLabel()}` : "Sin sesión";

  statusRefresh.className = "status-pill";
  statusRefresh.textContent = lastRefreshAt ? `Actualizado ${timeSince(lastRefreshAt)}` : "Sin sincronizar";
}

function renderTabbar() {
  const tabs = [
    { id: "home", label: "Inicio" },
    { id: "machines", label: "Máquinas" },
    { id: "reports", label: "Reportes" },
    { id: "alerts", label: "Alertas" }
  ];
  const node = document.getElementById("tabbar");
  node.innerHTML = tabs.map(tab => `
    <button class="tab-btn ${currentPage === tab.id ? "active" : ""}" type="button" onclick="setPage('${tab.id}')">
      ${escHtml(tab.label)}
    </button>
  `).join("");
}

async function setPage(page) {
  currentPage = page;
  renderTabbar();
  renderCurrentPage();
  if (page === "reports" && !reportState.overview) {
    await loadReportsData();
    renderCurrentPage();
  }
  if (page === "alerts" && !alertsState.alerts.length) {
    await loadAlertsData();
    renderCurrentPage();
  }
}

function buildDefaultReportFilters() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    from: toDateInput(start),
    to: toDateInput(end),
    department: ""
  };
}

function toDateInput(value) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function requestJson(method, pathname, { body, headers = {}, token = TOKEN } = {}) {
  if (!BASE) throw new Error("No hay empresa seleccionada");
  const finalHeaders = { ...headers };
  if (body !== undefined && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const json = text ? parseJsonSafe(text, text) : null;
  if (!response.ok) {
    const message = typeof json === "object" && json?.error ? json.error : `HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = json;
    throw err;
  }
  return json;
}

async function pingHealth(silent = false) {
  if (!BASE) return;
  try {
    await requestJson("GET", "/health", { token: null });
    healthState = { ok: true, message: "Backend en línea" };
  } catch (err) {
    healthState = { ok: false, message: "Backend sin respuesta" };
    if (!silent) showToast("No pude contactar el backend de esta empresa.", "warn");
  }
  updateStatusStrip();
}

async function doLogin() {
  const user = String(document.getElementById("loginUser").value || "").trim();
  const pass = String(document.getElementById("loginPass").value || "");
  if (!user || !pass) {
    setInlineBanner("loginErr", "Completá usuario y contraseña.");
    return;
  }
  try {
    setInlineBanner("loginErr", "");
    const login = await requestJson("POST", "/api/auth/login", {
      token: null,
      body: { username: user, password: pass }
    });
    if (!isManagerAppRole(login.role)) {
      setInlineBanner("loginErr", "Esta app está pensada para admin, gerente o supervisor.");
      return;
    }
    persistSessionForCurrentCompany(login);
    document.getElementById("loginPass").value = "";
    await showApp();
  } catch (err) {
    setInlineBanner("loginErr", err.message || "No pude iniciar sesión.");
  }
}

async function refreshAllData(silent = true) {
  if (!TOKEN) return;
  try {
    await pingHealth(true);
    const [today, monthly, machines, alerts] = await Promise.all([
      requestJson("GET", "/api/dashboard/today"),
      requestJson("GET", "/api/dashboard/monthly"),
      requestJson("GET", "/api/machines"),
      requestJson("GET", "/api/alerts/active?limit=12")
    ]);
    dashboardToday = today;
    dashboardMonthly = monthly;
    machinesState = machines.machines || [];
    alertsState = alerts || { summary: { total_open: 0, danger_count: 0, warn_count: 0, by_type: [] }, alerts: [] };
    if (currentPage === "reports") {
      await loadReportsData();
    }
    lastRefreshAt = new Date().toISOString();
    renderCurrentPage();
    updateStatusStrip();
  } catch (err) {
    if (err.status === 401) {
      clearSessionForCurrentCompany();
      showToast("La sesión expiró. Volvé a ingresar.", "warn");
      showLogin();
      return;
    }
    if (err.status === 403) {
      showToast("Esta cuenta no tiene acceso a la app gerente.", "warn");
      clearSessionForCurrentCompany();
      showLogin();
      return;
    }
    if (!silent) showToast(err.message || "No pude actualizar la información.", "warn");
    updateStatusStrip();
  }
}

async function loadAlertsData() {
  alertsState = await requestJson("GET", "/api/alerts/active?limit=40");
}

async function loadReportsData() {
  const query = buildQuery(reportFilters);
  const [overview, machines, employees, departments] = await Promise.all([
    requestJson("GET", `/api/reports/overview${query}`),
    requestJson("GET", `/api/reports/machines${query}`),
    requestJson("GET", `/api/reports/employees${query}`),
    requestJson("GET", `/api/reports/departments${query}`)
  ]);
  reportState = {
    overview,
    machines: machines.machines || [],
    employees: employees.employees || [],
    departments: departments.departments || []
  };
}

function startRefreshLoop() {
  stopRefreshLoop();
  refreshTimer = window.setInterval(() => refreshAllData(true), 60000);
}

function stopRefreshLoop() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

function renderCurrentPage() {
  const node = document.getElementById("view");
  if (!node) return;
  if (currentPage === "home") {
    node.innerHTML = renderHomeView();
  } else if (currentPage === "machines") {
    node.innerHTML = renderMachinesView();
  } else if (currentPage === "reports") {
    node.innerHTML = renderReportsView();
  } else if (currentPage === "alerts") {
    node.innerHTML = renderAlertsView();
  }
}

function renderHomeView() {
  const today = dashboardToday?.summary || {};
  const monthly = dashboardMonthly || {};
  const offlineCount = machinesState.filter(machine => !machine.online).length;
  const openAlerts = alertsState?.summary?.total_open || 0;
  const featuredAlerts = (alertsState.alerts || []).slice(0, 3);
  const topEmployees = (dashboardToday?.employees || []).slice(0, 5);
  const focusMachines = [...machinesState]
    .sort((a, b) => machineAttentionScore(b) - machineAttentionScore(a))
    .slice(0, 4);

  return `
    <section class="dashboard-hero">
      <div class="hero-top">
        <div>
          <div class="eyebrow">Inicio</div>
          <h2>Panorama del día</h2>
          <p class="muted">Una lectura rápida para detectar desvíos, consumos inusuales y máquinas que necesitan atención.</p>
        </div>
        <span class="badge ok">${escHtml(activeCompany()?.name || "Empresa")}</span>
      </div>
      <div class="metric-grid">
        ${metricCard("Consumos hoy", formatNumber(today.total_taps_today || 0), "Taps aprobados del día")}
        ${metricCard("Gasto hoy", formatCurrency(today.total_spent_cents || 0), "Monto acumulado del día")}
        ${metricCard("Alertas abiertas", formatNumber(openAlerts), `${formatNumber(alertsState?.summary?.danger_count || 0)} críticas`)}
        ${metricCard("Máquinas offline", formatNumber(offlineCount), `${formatNumber(machinesState.length - offlineCount)} operativas`)}
      </div>
    </section>

    <section class="section-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Prioridad inmediata</div>
          <h3>Qué mirar ahora</h3>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" onclick="setPage('alerts')">Ver alertas</button>
      </div>
      ${featuredAlerts.length ? `<div class="alert-list">${featuredAlerts.map(renderCompactAlert).join("")}</div>` : `<div class="empty-state">No hay alertas abiertas en este momento.</div>`}
    </section>

    <div class="split-grid">
      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="eyebrow">Consumo del día</div>
            <h3>Empleados destacados</h3>
          </div>
        </div>
        ${topEmployees.length ? renderMiniList(topEmployees.map(employee => ({
          title: employee.employee_name,
          meta: compactJoin([employee.department, `${formatNumber(employee.taps_today)} consumos`]),
          value: formatCurrency(employee.spent_today_cents || 0)
        }))) : `<div class="empty-state">Todavía no hay consumos para mostrar.</div>`}
      </section>

      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="eyebrow">Mes actual</div>
            <h3>Seguimiento mensual</h3>
          </div>
        </div>
        <div class="mini-grid">
          <article class="summary-tile">
            <div class="metric-label">Gasto mensual</div>
            <div class="metric-value">${formatCurrency(monthly.total_spent_cents || 0)}</div>
            <div class="metric-note">${formatNumber((monthly.employees || []).length)} empleados con consumo en el mes</div>
          </article>
          <article class="summary-tile">
            <div class="metric-label">Bloqueados hoy</div>
            <div class="metric-value">${formatNumber(today.blocked_employees || 0)}</div>
            <div class="metric-note">${formatNumber(today.warning_employees || 0)} en advertencia</div>
          </article>
        </div>
      </section>
    </div>

    <section class="section-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Máquinas</div>
          <h3>Focos operativos</h3>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" onclick="setPage('machines')">Abrir máquinas</button>
      </div>
      <div class="machine-grid">
        ${focusMachines.map(renderMachineCard).join("")}
      </div>
    </section>
  `;
}

function renderMachinesView() {
  const filtered = machinesState.filter(machine => {
    const q = machineFilters.q.trim().toLowerCase();
    const haystack = `${machine.name} ${machine.location || ""} ${machine.wifi_ssid || ""}`.toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (machineFilters.mode === "offline") return !machine.online;
    if (machineFilters.mode === "attention") return machineAttentionScore(machine) > 0;
    return true;
  });

  return `
    <section class="section-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Máquinas</div>
          <h3>Vista ejecutiva de operación</h3>
          <p class="muted">Seguimiento rápido de estado, conectividad, consumo y stock.</p>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <input type="search" placeholder="Buscar por nombre, ubicación o SSID" value="${escHtml(machineFilters.q)}" oninput="updateMachineSearch(this.value)">
        </div>
        <div class="chip-row">
          ${filterChip("all", "Todas", machineFilters.mode, "setMachineMode")}
          ${filterChip("offline", "Offline", machineFilters.mode, "setMachineMode")}
          ${filterChip("attention", "Con foco", machineFilters.mode, "setMachineMode")}
        </div>
      </div>
    </section>

    <section class="section-card">
      <div class="machine-grid">
        ${filtered.length ? filtered.map(renderMachineCard).join("") : `<div class="empty-state">No hay máquinas que coincidan con el filtro actual.</div>`}
      </div>
    </section>
  `;
}

function renderReportsView() {
  const overview = reportState.overview?.summary;
  return `
    <section class="section-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Reportes</div>
          <h3>Rango móvil para reunión y seguimiento</h3>
          <p class="muted">Consumo agregado por máquina, empleado y área con foco en lectura rápida.</p>
        </div>
      </div>
      <div class="report-grid">
        <label class="field">
          <span>Desde</span>
          <input type="date" value="${escHtml(reportFilters.from)}" onchange="setReportFilter('from', this.value)">
        </label>
        <label class="field">
          <span>Hasta</span>
          <input type="date" value="${escHtml(reportFilters.to)}" onchange="setReportFilter('to', this.value)">
        </label>
      </div>
      <div class="inline-actions">
        <button class="btn btn-primary" type="button" onclick="applyReportFilters()">Actualizar reportes</button>
      </div>
    </section>

    ${overview ? `
      <section class="section-card">
        <div class="metric-grid">
          ${metricCard("Aprobados", formatNumber(overview.approved_taps || 0), "Consumos aprobados en el rango")}
          ${metricCard("Rechazados", formatNumber(overview.denied_taps || 0), "Intentos denegados")}
          ${metricCard("Total eventos", formatNumber(overview.total_events || 0), "Taps registrados")}
          ${metricCard("Monto", formatCurrency(overview.spent_cents || 0), "Consumo económico acumulado")}
        </div>
      </section>

      <div class="split-grid">
        <section class="section-card">
          <div class="section-head">
            <div>
              <div class="eyebrow">Máquinas</div>
              <h3>Top del rango</h3>
            </div>
          </div>
          ${renderRankingList(reportState.machines.slice(0, 6), row => ({
            title: row.name,
            meta: compactJoin([row.location, `${formatNumber(row.taps_count)} consumos`]),
            value: formatCurrency(row.spent_cents || 0)
          }))}
        </section>

        <section class="section-card">
          <div class="section-head">
            <div>
              <div class="eyebrow">Áreas</div>
              <h3>Participación</h3>
            </div>
          </div>
          ${renderRankingList(reportState.departments.slice(0, 6), row => ({
            title: row.department,
            meta: `${formatNumber(row.employees_count)} empleados activos`,
            value: formatCurrency(row.spent_cents || 0)
          }))}
        </section>
      </div>

      <section class="section-card">
        <div class="section-head">
          <div>
            <div class="eyebrow">Empleados</div>
            <h3>Mayor consumo del rango</h3>
          </div>
        </div>
        ${renderRankingList(reportState.employees.slice(0, 8), row => ({
          title: row.name,
          meta: compactJoin([row.department, `${formatNumber(row.taps_count)} consumos`, row.access_level_name || null]),
          value: formatCurrency(row.spent_cents || 0)
        }))}
      </section>
    ` : `
      <section class="section-card">
        <div class="empty-state">Todavía no cargué los reportes. Tocá “Actualizar reportes” para consultar el rango seleccionado.</div>
      </section>
    `}
  `;
}

function renderAlertsView() {
  const filtered = (alertsState.alerts || []).filter(alert => {
    if (alertFilters.severity === "all") return true;
    return alert.severity === alertFilters.severity;
  });

  return `
    <section class="section-card">
      <div class="section-head">
        <div>
          <div class="eyebrow">Alertas</div>
          <h3>Alertas operativas activas</h3>
          <p class="muted">Lectura pensada para detectar qué necesita atención ahora mismo.</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" onclick="reloadAlerts()">Actualizar</button>
      </div>
      <div class="metric-grid">
        ${metricCard("Abiertas", formatNumber(alertsState.summary.total_open || 0), "Alertas todavía sin resolver")}
        ${metricCard("Críticas", formatNumber(alertsState.summary.danger_count || 0), "Impacto alto")}
        ${metricCard("Advertencias", formatNumber(alertsState.summary.warn_count || 0), "Seguimiento cercano")}
        ${metricCard("Tipos", formatNumber((alertsState.summary.by_type || []).length), "Familias activas")}
      </div>
      <div class="chip-row">
        ${filterChip("all", "Todas", alertFilters.severity, "setAlertSeverity")}
        ${filterChip("danger", "Críticas", alertFilters.severity, "setAlertSeverity")}
        ${filterChip("warn", "Advertencias", alertFilters.severity, "setAlertSeverity")}
      </div>
    </section>

    <section class="section-card">
      <div class="alert-list">
        ${filtered.length ? filtered.map(renderAlertCard).join("") : `<div class="empty-state">No hay alertas para el filtro actual.</div>`}
      </div>
    </section>
  `;
}

function metricCard(label, value, note) {
  return `
    <article class="metric-card">
      <div class="metric-label">${escHtml(label)}</div>
      <div class="metric-value">${escHtml(value)}</div>
      <div class="metric-note">${escHtml(note)}</div>
    </article>
  `;
}

function compactJoin(parts) {
  return parts.filter(Boolean).join(" · ");
}

function filterChip(value, label, activeValue, callbackName) {
  return `<button class="chip ${value === activeValue ? "active" : ""}" type="button" onclick="${callbackName}('${escJs(value)}')">${escHtml(label)}</button>`;
}

function renderMiniList(items) {
  return `
    <ul class="mini-list">
      ${items.map(item => `
        <li>
          <div>
            <strong>${escHtml(item.title)}</strong>
            <span>${escHtml(item.meta || "")}</span>
          </div>
          <strong>${escHtml(item.value || "")}</strong>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderRankingList(items, mapper) {
  if (!items.length) return `<div class="empty-state">No hay datos para este rango.</div>`;
  return `
    <div class="report-list">
      ${items.map((item, index) => {
        const data = mapper(item, index);
        return `
          <article class="report-list-item">
            <div>
              <strong>${index + 1}. ${escHtml(data.title)}</strong>
              <p class="muted">${escHtml(data.meta || "")}</p>
            </div>
            <strong>${escHtml(data.value || "")}</strong>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function machineAttentionScore(machine) {
  let score = 0;
  if (!machine.online) score += 5;
  if (machine.backend_ok === false) score += 3;
  if (machine.blocked) score += 4;
  if ((machine.stock_summary?.empty_items || 0) > 0) score += 3;
  if ((machine.stock_summary?.low_items || 0) > 0) score += 2;
  return score;
}

function machineStatusBadge(machine) {
  if (machine?.blocked) return `<span class="badge danger">Bloqueada</span>`;
  if (machine?.online) return `<span class="badge ok">Online</span>`;
  return `<span class="badge warn">Offline</span>`;
}

function backendBadge(machine) {
  if (machine?.backend_ok === true) return `<span class="badge ok">Backend OK</span>`;
  if (machine?.online) return `<span class="badge warn">Backend sin respuesta</span>`;
  return `<span class="badge neutral">Sin telemetría</span>`;
}

function stockSummaryLabel(machine) {
  const data = machine?.stock_summary || {};
  if (!(Number(data.configured_items) > 0)) return "Stock sin configurar";
  const parts = [`${formatNumber(data.configured_items)} selecciones`];
  if (Number(data.empty_items) > 0) parts.push(`Sin stock ${formatNumber(data.empty_items)}`);
  else if (Number(data.low_items) > 0) parts.push(`Bajo ${formatNumber(data.low_items)}`);
  else parts.push("OK");
  return parts.join(" · ");
}

function renderMachineCard(machine) {
  return `
    <article class="machine-card">
      <header>
        <div>
          <div class="chip-row">
            ${machineStatusBadge(machine)}
            ${backendBadge(machine)}
          </div>
          <h3>${escHtml(machine.name)}</h3>
          <p class="muted">${escHtml(machine.location || "Sin ubicación")}</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openMachineDetail(${Number(machine.id)})">Detalle</button>
      </header>
      <div class="mini-grid">
        <article class="machine-stat">
          <div class="metric-label">Hoy</div>
          <strong>${formatNumber(machine.taps_today || 0)} consumos</strong>
          <p class="muted">${timeSince(machine.last_tap_at)}</p>
        </article>
        <article class="machine-stat">
          <div class="metric-label">Mes</div>
          <strong>${formatCurrency(machine.cost_month_cents || 0)}</strong>
          <p class="muted">${formatNumber(machine.taps_month || 0)} taps</p>
        </article>
      </div>
      <div class="stack">
        <div class="status-text">${escHtml(stockSummaryLabel(machine))}</div>
        <div class="status-text">${escHtml(compactJoin([machine.wifi_ssid, machine.wifi_ip])) || "Sin datos de red"}</div>
      </div>
    </article>
  `;
}

function renderCompactAlert(alert) {
  return `
    <article class="alert-row">
      <div>
        <strong>${escHtml(alert.title)}</strong>
        <p class="muted">${escHtml(alert.message)}</p>
      </div>
      <span class="badge ${alert.severity}">${escHtml(alert.alert_type_label)}</span>
    </article>
  `;
}

function renderAlertCard(alert) {
  return `
    <article class="alert-card">
      <div class="meta-row">
        <div>
          <div class="chip-row">
            <span class="badge ${alert.severity}">${escHtml(alert.alert_type_label)}</span>
            ${alert.employee_department ? `<span class="badge neutral">${escHtml(alert.employee_department)}</span>` : ""}
          </div>
          <h3>${escHtml(alert.title)}</h3>
          <p class="muted">${escHtml(alert.message)}</p>
        </div>
      </div>
      ${alert.highlight ? `<div class="summary-tile"><div class="metric-label">Contexto</div><div class="metric-note">${escHtml(alert.highlight)}</div></div>` : ""}
      <div class="stack">
        ${alert.machine_name ? `<div class="status-text">Máquina: ${escHtml(compactJoin([alert.machine_name, alert.machine_location]))}</div>` : ""}
        ${alert.employee_name ? `<div class="status-text">Empleado: ${escHtml(compactJoin([alert.employee_name, alert.employee_department]))}</div>` : ""}
        <div class="status-text">Vista: ${escHtml(timeSince(alert.last_seen_at))} · Notificación ${escHtml(timeSince(alert.last_notified_at))}</div>
      </div>
    </article>
  `;
}

function updateMachineSearch(value) {
  machineFilters.q = String(value || "");
  renderCurrentPage();
}

function setMachineMode(mode) {
  machineFilters.mode = mode;
  renderCurrentPage();
}

function setAlertSeverity(severity) {
  alertFilters.severity = severity;
  renderCurrentPage();
}

function setReportFilter(key, value) {
  reportFilters[key] = value;
}

async function applyReportFilters() {
  try {
    await loadReportsData();
    renderCurrentPage();
  } catch (err) {
    showToast(err.message || "No pude cargar los reportes.", "warn");
  }
}

async function reloadAlerts() {
  try {
    await loadAlertsData();
    renderCurrentPage();
  } catch (err) {
    showToast(err.message || "No pude cargar las alertas.", "warn");
  }
}

function openMachineDetail(machineId) {
  const machine = machinesState.find(item => Number(item.id) === Number(machineId));
  if (!machine) return;
  openSheet({
    eyebrow: "Máquina",
    title: machine.name,
    body: `
      <section class="summary-card">
        <div class="chip-row">
          ${machineStatusBadge(machine)}
          ${backendBadge(machine)}
        </div>
        <div class="stack">
          <div class="status-text"><strong>Ubicación:</strong> ${escHtml(machine.location || "Sin ubicación")}</div>
          <div class="status-text"><strong>Último tap:</strong> ${escHtml(formatDateTime(machine.last_tap_at))}</div>
          <div class="status-text"><strong>Último ping:</strong> ${escHtml(formatDateTime(machine.last_seen))}</div>
          <div class="status-text"><strong>Red:</strong> ${escHtml(compactJoin([machine.wifi_ssid, machine.wifi_ip])) || "Sin dato"}</div>
          <div class="status-text"><strong>Stock:</strong> ${escHtml(stockSummaryLabel(machine))}</div>
        </div>
      </section>
      <section class="summary-card">
        <div class="mini-grid">
          <article class="summary-tile">
            <div class="metric-label">Consumos hoy</div>
            <div class="metric-value">${formatNumber(machine.taps_today || 0)}</div>
          </article>
          <article class="summary-tile">
            <div class="metric-label">Consumos mes</div>
            <div class="metric-value">${formatNumber(machine.taps_month || 0)}</div>
          </article>
          <article class="summary-tile">
            <div class="metric-label">Monto mes</div>
            <div class="metric-value">${formatCurrency(machine.cost_month_cents || 0)}</div>
          </article>
          <article class="summary-tile">
            <div class="metric-label">Estado stock</div>
            <div class="metric-note">${escHtml(stockSummaryLabel(machine))}</div>
          </article>
        </div>
      </section>
    `,
    footer: `
      <button class="btn btn-ghost" type="button" onclick="closeSheet()">Cerrar</button>
      <button class="btn btn-primary" type="button" onclick="setPage('machines');closeSheet()">Volver a máquinas</button>
    `
  });
}

function openSessionSheet() {
  const company = activeCompany();
  const decoded = decodeJwtPayload(TOKEN);
  const scopes = decoded?.department_scopes || [];
  openSheet({
    eyebrow: "Sesión",
    title: "Empresa activa",
    body: `
      <section class="summary-card">
        <div class="stack">
          <div class="status-text"><strong>Empresa:</strong> ${escHtml(company?.name || "Sin empresa")}</div>
          <div class="status-text"><strong>Backend:</strong> ${escHtml(company?.url || "Sin backend")}</div>
          <div class="status-text"><strong>Usuario:</strong> ${escHtml(CURRENT_USER || "Sin usuario")}</div>
          <div class="status-text"><strong>Rol:</strong> ${escHtml(roleLabel())}</div>
          ${scopes.length ? `<div class="status-text"><strong>Áreas:</strong> ${escHtml(scopes.join(" · "))}</div>` : ""}
        </div>
      </section>
    `,
    footer: `
      <div class="session-actions">
        <button class="btn btn-ghost" type="button" onclick="backToCompanySelector()">Cambiar empresa</button>
        <button class="btn btn-ghost" type="button" onclick="openAdminPanel()">Abrir panel web</button>
        <button class="btn btn-danger" type="button" onclick="logoutCurrentCompany()">Cerrar sesión</button>
      </div>
    `
  });
}

function backToCompanySelector() {
  closeSheet();
  stopRefreshLoop();
  showCompanyScreen();
}

function logoutCurrentCompany() {
  clearSessionForCurrentCompany();
  closeSheet();
  stopRefreshLoop();
  showLogin();
}
