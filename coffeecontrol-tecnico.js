const CURRENT_ORIGIN = /^https?:\/\//.test(window.location.origin) ? window.location.origin : "";
const STORAGE_URL_KEY = "cc_tech_url";
const STORAGE_TOKEN_KEY = "cc_tech_token";
const FALLBACK_URL_KEY = "cc_url2";

let BASE = (CURRENT_ORIGIN || localStorage.getItem(STORAGE_URL_KEY) || localStorage.getItem(FALLBACK_URL_KEY) || "http://localhost:3000").replace(/\/$/, "");
let TOKEN = localStorage.getItem(STORAGE_TOKEN_KEY) || "";
let CURRENT_ROLE = null;
let CURRENT_USER = null;
let MACHINES = [];
let PENDING = [];
let currentPage = "machines";
let healthState = null;
let lastRefreshAt = null;
let refreshTimer = null;
let installPromptEvent = null;

let machineFilters = { q: "", mode: "all" };
let stockState = { machine: null, data: null };
let remoteWifiState = { machine: null, commandId: null, pollTimer: null };

const roleLabels = {
  admin: "Administrador",
  gerente: "Gerente",
  supervisor: "Supervisor",
  tecnico: "Tecnico",
  distribuidor: "Distribuidor"
};

document.getElementById("loginUrl").value = BASE;
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
  healthState = { ok: false, message: "Sin conexion local" };
  updateStatusStrip();
});

registerServiceWorker();
if (TOKEN) showApp();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;
  navigator.serviceWorker.register("/coffeecontrol-tecnico-sw.js").catch(() => {});
}

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function isManagerRole(role = CURRENT_ROLE) {
  return role === "admin" || role === "gerente";
}

function isTechnicalRole(role = CURRENT_ROLE) {
  return role === "tecnico" || role === "distribuidor";
}

function canOperateMachines(role = CURRENT_ROLE) {
  return isManagerRole(role) || isTechnicalRole(role);
}

function canManageMachineSetup(role = CURRENT_ROLE) {
  return isManagerRole(role) || role === "distribuidor";
}

function canUseTechApp(role = CURRENT_ROLE) {
  return canOperateMachines(role);
}

function defaultPageForRole(role = CURRENT_ROLE) {
  return canManageMachineSetup(role) ? "pending" : "machines";
}

function timeSince(iso) {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return "Hace instantes";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Hace segundos";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `Hace ${days} dia${days === 1 ? "" : "s"}`;
}

function formatDateTime(iso) {
  if (!iso) return "Sin dato";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function numericRssi(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function rssiDescriptor(value) {
  if (value === null) return "Sin dato";
  if (value >= -60) return "Muy buena";
  if (value >= -72) return "Buena";
  if (value >= -82) return "Media";
  return "Debil";
}

function formatMachineRssi(value) {
  const rssi = numericRssi(value);
  if (rssi === null) return "Sin dato";
  return `${rssi} dBm · ${rssiDescriptor(rssi)}`;
}

function machineBackendBadge(machine) {
  if (machine?.backend_ok === true) return { tone: "ok", label: "Backend OK" };
  if (machine?.online) return { tone: "warn", label: "Backend sin respuesta" };
  return { tone: "neutral", label: "Sin telemetria" };
}

function machineStatusBadge(machine) {
  if (machine?.blocked) return { tone: "danger", label: "Bloqueada" };
  return machine?.online ? { tone: "ok", label: "Online" } : { tone: "warn", label: "Offline" };
}

function machineStockSummary(machine) {
  const data = machine?.stock_summary || {};
  if (!(parseInt(data.configured_items || 0, 10) > 0)) return "Stock sin configurar";
  const parts = [`${data.configured_items} seleccion${data.configured_items === 1 ? "" : "es"}`];
  if ((data.low_items || 0) > 0) parts.push(`Bajo ${data.low_items}`);
  if ((data.empty_items || 0) > 0) parts.push(`Sin stock ${data.empty_items}`);
  if ((data.low_items || 0) === 0 && (data.empty_items || 0) === 0) parts.push("OK");
  return parts.join(" · ");
}

function machineNetworkSummary(machine) {
  const parts = [];
  if (machine?.wifi_ssid) parts.push(machine.wifi_ssid);
  if (machine?.wifi_ip) parts.push(`IP ${machine.wifi_ip}`);
  if (numericRssi(machine?.wifi_rssi) !== null) parts.push(formatMachineRssi(machine.wifi_rssi));
  return parts.length ? parts.join(" · ") : "Sin telemetria de red";
}

function stockItemDisplayName(item) {
  return item?.product_name || `Seleccion ${item?.item_id ?? "?"}`;
}

function stockStatusBadge(item) {
  const toneMap = { bs: "ok", bw: "warn", bd: "danger" };
  const tone = toneMap[item?.status_badge] || "neutral";
  return `<span class="badge ${tone}">${escHtml(item?.status_label || "Sin dato")}</span>`;
}

function stockMovementLabel(type) {
  return {
    sale: "Venta confirmada",
    restock: "Reposicion",
    adjustment: "Ajuste",
    unconfigured_sale: "Venta sin seleccion configurada"
  }[type] || type || "Movimiento";
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

function showToast(message, tone = "ok") {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.className = `toast ${tone}`;
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
  stopRemoteWifiScanPoll();
  const sheet = document.getElementById("sheet");
  sheet.classList.add("hidden");
  sheet.setAttribute("aria-hidden", "true");
  document.getElementById("sheetBody").innerHTML = "";
  document.getElementById("sheetFooter").innerHTML = "";
}

function openAdminPanel() {
  const base = (document.getElementById("loginUrl")?.value || BASE).trim().replace(/\/$/, "");
  if (!base) return;
  window.open(`${base}/`, "_blank", "noopener");
}

async function installApp() {
  if (!installPromptEvent) {
    showToast("La instalacion web no esta disponible en este navegador.", "warn");
    return;
  }
  installPromptEvent.prompt();
  try {
    await installPromptEvent.userChoice;
  } catch (_) {}
  installPromptEvent = null;
  document.getElementById("installBtn").classList.add("hidden");
}

async function api(method, path, body) {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const raw = await response.text();
  const data = raw ? parseJsonSafe(raw, { raw }) : {};
  if (response.status === 401) {
    doLogout("Sesion expirada");
    throw new Error(data.error || "Sesion expirada");
  }
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
  return data;
}

async function pingHealth(silent = false) {
  try {
    const response = await fetch(`${BASE}/health`, { cache: "no-store" });
    if (!response.ok) throw new Error("Health no disponible");
    healthState = { ok: true, message: "Backend activo" };
  } catch (_) {
    healthState = { ok: false, message: "Backend no responde" };
    if (!silent) showToast("No se pudo consultar /health del backend.", "warn");
  }
  updateStatusStrip();
}

function updateStatusStrip() {
  const backendNode = document.getElementById("statusBackend");
  const userNode = document.getElementById("statusUser");
  const refreshNode = document.getElementById("statusRefresh");
  if (backendNode) {
    backendNode.className = `status-pill ${healthState?.ok ? "ok" : "warn"}`;
    backendNode.textContent = healthState?.message || "Backend sin validar";
  }
  if (userNode) {
    userNode.className = "status-pill";
    userNode.textContent = CURRENT_USER ? `${CURRENT_USER.username} · ${roleLabels[CURRENT_ROLE] || CURRENT_ROLE}` : "Sin sesion";
  }
  if (refreshNode) {
    refreshNode.className = "status-pill";
    refreshNode.textContent = lastRefreshAt ? `Actualizado ${timeSince(lastRefreshAt)}` : "Sincronizacion pendiente";
  }
}

async function doLogin() {
  BASE = document.getElementById("loginUrl").value.trim().replace(/\/$/, "");
  localStorage.setItem(STORAGE_URL_KEY, BASE);
  localStorage.setItem(FALLBACK_URL_KEY, BASE);
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  setInlineBanner("loginErr", "");
  if (!BASE || !username || !password) {
    setInlineBanner("loginErr", "Completa backend, usuario y contrasena.");
    return;
  }
  try {
    const response = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = parseJsonSafe(await response.text(), {});
    if (!response.ok) throw new Error(data.error || "No se pudo iniciar sesion");
    TOKEN = data.token || "";
    const payload = decodeJwtPayload(TOKEN);
    if (!payload || !canUseTechApp(payload.role)) {
      TOKEN = "";
      throw new Error("Esta app es solo para tecnico, distribuidor o cuentas gerenciales.");
    }
    localStorage.setItem(STORAGE_TOKEN_KEY, TOKEN);
    showApp();
  } catch (error) {
    setInlineBanner("loginErr", error.message || "Error de ingreso");
  }
}

function clearRefreshTimer() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

function doLogout(message = "") {
  TOKEN = "";
  CURRENT_ROLE = null;
  CURRENT_USER = null;
  MACHINES = [];
  PENDING = [];
  clearRefreshTimer();
  stopRemoteWifiScanPoll();
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  updateStatusStrip();
  if (message) showToast(message, "warn");
}

function showApp() {
  const payload = decodeJwtPayload(TOKEN);
  if (!payload || !canUseTechApp(payload.role)) {
    doLogout("La sesion no corresponde a un rol tecnico.");
    return;
  }
  CURRENT_ROLE = payload.role;
  CURRENT_USER = payload;
  currentPage = defaultPageForRole(payload.role);
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  renderTabbar();
  navigate(currentPage);
  refreshAllData(false);
  clearRefreshTimer();
  refreshTimer = setInterval(() => refreshAllData(true), 30000);
}

function renderTabbar() {
  const pages = [{ id: "machines", label: "Maquinas" }];
  if (canManageMachineSetup()) pages.push({ id: "pending", label: "Pendientes", count: PENDING.length || 0 });
  pages.push({ id: "account", label: "Cuenta" });
  document.getElementById("tabbar").innerHTML = pages.map(page => `
    <button type="button" class="tab-btn ${currentPage === page.id ? "active" : ""}" onclick="navigate('${page.id}')">
      ${page.label}${page.count ? `<span class="count">${page.count}</span>` : ""}
    </button>`).join("");
}

function navigate(page) {
  const allowed = ["machines", "account"];
  if (canManageMachineSetup()) allowed.push("pending");
  currentPage = allowed.includes(page) ? page : "machines";
  renderTabbar();
  renderCurrentPage();
}

async function refreshAllData(silent = false) {
  try {
    await loadMachines(silent);
    if (canManageMachineSetup()) await loadPending(silent);
    await pingHealth(true);
    lastRefreshAt = new Date().toISOString();
    updateStatusStrip();
    renderCurrentPage();
    if (!silent) showToast("Informacion actualizada.", "ok");
  } catch (error) {
    renderCurrentPage();
    if (!silent) showToast(error.message || "No se pudo sincronizar.", "danger");
  }
}

async function loadMachines(silent = false) {
  try {
    const data = await api("GET", "/api/machines");
    MACHINES = data.machines || [];
    if (currentPage === "machines") renderCurrentPage();
  } catch (error) {
    if (!silent) throw error;
  }
}

async function loadPending(silent = false) {
  if (!canManageMachineSetup()) return;
  try {
    const data = await api("GET", "/api/machines/pending");
    PENDING = data.pending || [];
    renderTabbar();
    if (currentPage === "pending") renderCurrentPage();
  } catch (error) {
    if (!silent) throw error;
  }
}

function setMachineFilter(mode) {
  machineFilters.mode = mode;
  renderMachinesPage();
}

function setMachineSearch(value) {
  machineFilters.q = value || "";
  renderMachinesPage();
}

function getFilteredMachines() {
  const query = machineFilters.q.trim().toLowerCase();
  return MACHINES.filter(machine => {
    if (query) {
      const haystack = `${machine.name || ""} ${machine.location || ""} ${machine.wifi_ssid || ""} ${machine.wifi_ip || ""} ${machine.backend_error || ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (machineFilters.mode === "online" && !machine.online) return false;
    if (machineFilters.mode === "offline" && machine.online) return false;
    if (machineFilters.mode === "alerts") {
      const summary = machine.stock_summary || {};
      const stockAlert = (summary.low_items || 0) > 0 || (summary.empty_items || 0) > 0;
      const networkAlert = !machine.online || machine.backend_ok === false || machine.blocked;
      if (!stockAlert && !networkAlert) return false;
    }
    return true;
  });
}

function renderCurrentPage() {
  if (currentPage === "pending" && canManageMachineSetup()) return renderPendingPage();
  if (currentPage === "account") return renderAccountPage();
  return renderMachinesPage();
}

function renderMachinesPage() {
  const cards = getFilteredMachines().map(renderMachineCard).join("") || '<div class="empty-state">No hay maquinas para mostrar con los filtros actuales.</div>';
  document.getElementById("view").innerHTML = `
    <section class="page-card">
      <div class="page-title">
        <div>
          <div class="eyebrow">Operacion tecnica</div>
          <h2>Maquinas</h2>
          <p>Consulta estado, backend, red, stock y ejecuta acciones remotas desde el celular.</p>
        </div>
        <div class="stack-actions">
          <button class="btn btn-ghost btn-sm" type="button" onclick="refreshAllData(false)">Sincronizar</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <input type="search" value="${escHtml(machineFilters.q)}" placeholder="Buscar por nombre, ubicacion o red..." oninput="setMachineSearch(this.value)">
        </div>
        <div class="filter-row">
          <button type="button" class="filter-chip ${machineFilters.mode === "all" ? "active" : ""}" onclick="setMachineFilter('all')">Todas</button>
          <button type="button" class="filter-chip ${machineFilters.mode === "online" ? "active" : ""}" onclick="setMachineFilter('online')">Online</button>
          <button type="button" class="filter-chip ${machineFilters.mode === "offline" ? "active" : ""}" onclick="setMachineFilter('offline')">Offline</button>
          <button type="button" class="filter-chip ${machineFilters.mode === "alerts" ? "active" : ""}" onclick="setMachineFilter('alerts')">Alertas</button>
        </div>
      </div>
    </section>
    <section class="stack">${cards}</section>`;
}

function renderMachineCard(machine) {
  const status = machineStatusBadge(machine);
  const backend = machineBackendBadge(machine);
  return `
    <article class="machine-card">
      <header>
        <div class="machine-title">
          <h3>${escHtml(machine.name || "Maquina sin nombre")}</h3>
          <div class="machine-location">${escHtml(machine.location || "Ubicacion sin definir")}</div>
        </div>
        <div>
          <span class="badge ${status.tone}">${status.label}</span>
          <span class="badge ${backend.tone}" style="margin-left:8px">${backend.label}</span>
        </div>
      </header>
      <div class="detail-list">
        <div class="detail-row"><span>Red</span><strong>${escHtml(machineNetworkSummary(machine))}</strong></div>
        <div class="detail-row"><span>Stock</span><strong>${escHtml(machineStockSummary(machine))}</strong></div>
        <div class="detail-row"><span>Ultimo contacto</span><strong>${escHtml(timeSince(machine.last_seen))}</strong></div>
      </div>
      <div class="metric-grid">
        <div class="metric"><div class="metric-label">Cafes hoy</div><div class="metric-value">${machine.taps_today || 0}</div></div>
        <div class="metric"><div class="metric-label">Cafes mes</div><div class="metric-value">${machine.taps_month || 0}</div></div>
      </div>
      ${machine.backend_error ? `<div class="inline-banner" style="margin-top:14px">${escHtml(machine.backend_error)}</div>` : ""}
      <div class="action-row">
        <button class="btn btn-ghost btn-sm" type="button" onclick="openMachineDetail(${machine.id})">Detalle</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openMachineStock(${machine.id})">Stock</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openRemoteWifi(${machine.id})" ${machine.online ? "" : "disabled"}>WiFi</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="restartMachine(${machine.id})" ${machine.online ? "" : "disabled"}>Reiniciar</button>
      </div>
    </article>`;
}

function renderPendingPage() {
  const cards = PENDING.length ? PENDING.map(item => `
    <article class="pending-card">
      <header>
        <div><div class="eyebrow">Pendiente</div><h3>${escHtml(item.mac)}</h3></div>
        <span class="badge warn">Sin aprobar</span>
      </header>
      <div class="pending-meta">
        Vista por primera vez ${escHtml(timeSince(item.first_seen))}<br>
        Ultimo ping ${escHtml(timeSince(item.last_ping))}
      </div>
      <div class="action-row">
        <button class="btn btn-primary btn-sm" type="button" onclick="openApprovePending(${item.id})">Aprobar</button>
        <button class="btn btn-danger btn-sm" type="button" onclick="rejectPending(${item.id})">Rechazar</button>
      </div>
    </article>`).join("") : '<div class="empty-state">No hay maquinas pendientes en este momento.</div>';

  document.getElementById("view").innerHTML = `
    <section class="page-card">
      <div class="page-title">
        <div>
          <div class="eyebrow">Onboarding</div>
          <h2>Maquinas pendientes</h2>
          <p>Aprobacion de equipos nuevos y asignacion inicial de nombre y ubicacion.</p>
        </div>
        <div class="stack-actions">
          <button class="btn btn-ghost btn-sm" type="button" onclick="loadPending(false)">Actualizar</button>
        </div>
      </div>
    </section>
    <section class="stack">${cards}</section>`;
}

function renderAccountPage() {
  const scopes = Array.isArray(CURRENT_USER?.department_scopes) && CURRENT_USER.department_scopes.length
    ? CURRENT_USER.department_scopes.join(", ")
    : "Sin alcance por area";
  document.getElementById("view").innerHTML = `
    <section class="stack">
      <article class="account-card">
        <header>
          <div><div class="eyebrow">Sesion</div><h3>${escHtml(CURRENT_USER?.username || "Sin usuario")}</h3></div>
          <span class="badge neutral">${escHtml(roleLabels[CURRENT_ROLE] || CURRENT_ROLE || "Sin rol")}</span>
        </header>
        <div class="stack-list">
          <div class="detail-row"><span>Backend</span><strong>${escHtml(BASE)}</strong></div>
          <div class="detail-row"><span>Alcance</span><strong>${escHtml(scopes)}</strong></div>
          <div class="detail-row"><span>Ultima sincronizacion</span><strong>${escHtml(lastRefreshAt ? formatDateTime(lastRefreshAt) : "Sin datos")}</strong></div>
        </div>
      </article>
      <article class="account-card">
        <header><div><div class="eyebrow">Acciones</div><h3>Atajos operativos</h3></div></header>
        <div class="action-row">
          <button class="btn btn-primary btn-sm" type="button" onclick="refreshAllData(false)">Sincronizar</button>
          <button class="btn btn-ghost btn-sm" type="button" onclick="openAdminPanel()">Abrir panel completo</button>
          <button class="btn btn-ghost btn-sm" type="button" onclick="installApp()">Instalar PWA</button>
          <button class="btn btn-danger btn-sm" type="button" onclick="doLogout()">Cerrar sesion</button>
        </div>
      </article>
      <article class="account-card">
        <header><div><div class="eyebrow">Recorte</div><h3>Enfoque de esta app</h3></div></header>
        <div class="muted">Esta version movil prioriza maquinas, WiFi, reinicio, stock y onboarding. Reportes, auditoria y gestion gerencial siguen viviendo en el panel completo.</div>
      </article>
    </section>`;
}

function getMachineById(machineId) {
  return MACHINES.find(machine => machine.id === machineId) || null;
}

function openMachineDetail(machineId) {
  const machine = getMachineById(machineId);
  if (!machine) return showToast("No se encontro la maquina seleccionada.", "danger");
  const status = machineStatusBadge(machine);
  const backend = machineBackendBadge(machine);
  const summary = machine.stock_summary || {};
  openSheet({
    eyebrow: "Maquina",
    title: machine.name || "Detalle",
    body: `
      <div class="summary-grid">
        <article class="summary-card"><span>Estado</span><strong>${escHtml(status.label)}</strong></article>
        <article class="summary-card"><span>Backend</span><strong>${escHtml(backend.label)}</strong></article>
        <article class="summary-card"><span>Bajo minimo</span><strong>${parseInt(summary.low_items || 0, 10)}</strong></article>
        <article class="summary-card"><span>Sin stock</span><strong>${parseInt(summary.empty_items || 0, 10)}</strong></article>
      </div>
      <div class="detail-list">
        <div class="detail-row"><span>Ubicacion</span><strong>${escHtml(machine.location || "Sin definir")}</strong></div>
        <div class="detail-row"><span>SSID</span><strong>${escHtml(machine.wifi_ssid || "Sin dato")}</strong></div>
        <div class="detail-row"><span>IP</span><strong>${escHtml(machine.wifi_ip || "Sin dato")}</strong></div>
        <div class="detail-row"><span>RSSI</span><strong>${escHtml(formatMachineRssi(machine.wifi_rssi))}</strong></div>
        <div class="detail-row"><span>Ultimo contacto</span><strong>${escHtml(timeSince(machine.last_seen))}</strong></div>
        <div class="detail-row"><span>URL backend</span><strong>${escHtml(machine.backend_url || "Sin dato")}</strong></div>
      </div>
      ${machine.backend_error ? `<div class="inline-banner" style="margin-top:14px">${escHtml(machine.backend_error)}</div>` : ""}
      <div class="action-row">
        <button class="btn btn-ghost btn-sm" type="button" onclick="openMachineStock(${machine.id})">Stock</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openRemoteWifi(${machine.id})" ${machine.online ? "" : "disabled"}>WiFi</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="restartMachine(${machine.id})" ${machine.online ? "" : "disabled"}>Reiniciar</button>
        ${canManageMachineSetup() ? `<button class="btn btn-ghost btn-sm" type="button" onclick="openMachineEdit(${machine.id})">Editar datos</button>` : ""}
      </div>`
  });
}

function openMachineEdit(machineId) {
  const machine = getMachineById(machineId);
  if (!machine) return showToast("No se encontro la maquina.", "danger");
  openSheet({
    eyebrow: "Setup",
    title: `Editar ${machine.name}`,
    body: `
      <label class="field"><span>Nombre</span><input id="machineEditName" type="text" value="${escHtml(machine.name || "")}"></label>
      <label class="field"><span>Ubicacion</span><input id="machineEditLocation" type="text" value="${escHtml(machine.location || "")}"></label>
      <div id="machineEditMsg" class="inline-banner hidden"></div>`,
    footer: `
      <button class="btn btn-ghost btn-sm" type="button" onclick="closeSheet()">Cancelar</button>
      <button class="btn btn-primary btn-sm" type="button" onclick="saveMachineEdit(${machine.id})">Guardar</button>`
  });
}

async function saveMachineEdit(machineId) {
  const name = (document.getElementById("machineEditName")?.value || "").trim();
  const location = (document.getElementById("machineEditLocation")?.value || "").trim();
  if (!name) return setInlineBanner("machineEditMsg", "El nombre es obligatorio.");
  try {
    await api("PATCH", `/api/machines/${machineId}`, { name, location: location || null });
    closeSheet();
    await refreshAllData(true);
    showToast("Datos de maquina actualizados.", "ok");
  } catch (error) {
    setInlineBanner("machineEditMsg", error.message || "No se pudo guardar.");
  }
}

async function restartMachine(machineId) {
  const machine = getMachineById(machineId);
  if (!machine?.online) return showToast("La maquina esta offline. El reinicio remoto no se puede encolar.", "warn");
  if (!window.confirm(`Enviar reinicio remoto a "${machine.name}"?`)) return;
  try {
    await api("POST", `/api/machines/${machineId}/commands`, { type: "reboot" });
    showToast(`Reinicio remoto enviado a ${machine.name}.`, "ok");
    await refreshAllData(true);
  } catch (error) {
    showToast(error.message || "No se pudo enviar el reinicio.", "danger");
  }
}

function openRemoteWifi(machineId) {
  const machine = getMachineById(machineId);
  if (!machine) return showToast("No se encontro la maquina.", "danger");
  if (!machine.online) return showToast("La maquina esta offline. El cambio remoto de WiFi requiere equipo online.", "warn");
  remoteWifiState.machine = machine;
  openSheet({
    eyebrow: "WiFi remoto",
    title: machine.name,
    body: `
      <label class="field"><span>SSID</span><input id="wifiSsid" type="text" value="${escHtml(machine.wifi_ssid || "")}"></label>
      <label class="field"><span>Nueva contrasena</span><input id="wifiPass" type="password" placeholder="Vacia para conservar la actual"></label>
      <label class="toggle-inline"><input type="checkbox" onchange="document.getElementById('wifiPass').type=this.checked?'text':'password'"><span>Mostrar contrasena</span></label>
      <label class="field"><span>URL backend</span><input id="wifiUrl" type="url" value="${escHtml(machine.backend_url || "")}"></label>
      <div class="action-row"><button class="btn btn-ghost btn-sm" type="button" id="wifiScanBtn" onclick="scanRemoteWifi(${machine.id})">Escanear redes</button></div>
      <div id="wifiScanStatus" class="inline-banner hidden"></div>
      <div id="wifiScanList" class="selection-list"></div>
      <div id="wifiMsg" class="inline-banner hidden"></div>`,
    footer: `
      <button class="btn btn-ghost btn-sm" type="button" onclick="closeSheet()">Cancelar</button>
      <button class="btn btn-primary btn-sm" type="button" onclick="submitRemoteWifi(${machine.id})">Guardar y reiniciar</button>`
  });
}

function stopRemoteWifiScanPoll() {
  if (remoteWifiState.pollTimer) clearTimeout(remoteWifiState.pollTimer);
  remoteWifiState.pollTimer = null;
  remoteWifiState.commandId = null;
}

function setRemoteWifiStatus(message, success = false) {
  setInlineBanner("wifiScanStatus", message, success);
}

function renderRemoteWifiNetworks(networks) {
  const list = document.getElementById("wifiScanList");
  if (!list) return;
  if (!Array.isArray(networks) || !networks.length) {
    list.innerHTML = "";
    return;
  }
  const current = document.getElementById("wifiSsid")?.value || "";
  list.innerHTML = networks.map(net => `
    <article class="stock-item-card">
      <header>
        <div class="stock-title"><h3>${escHtml(net.ssid)}</h3><div class="muted">${net.secure ? "Con contrasena" : "Red abierta"} · ${escHtml(String(net.rssi))} dBm</div></div>
        ${current === net.ssid ? '<span class="badge ok">Seleccionada</span>' : ""}
      </header>
      <div class="action-row"><button class="btn btn-ghost btn-sm" type="button" onclick="selectRemoteWifiSsid(${JSON.stringify(net.ssid)})">Usar esta red</button></div>
    </article>`).join("");
}

function selectRemoteWifiSsid(ssid) {
  const input = document.getElementById("wifiSsid");
  if (input) input.value = ssid;
  setRemoteWifiStatus(`Red seleccionada: ${ssid}`, true);
}

async function pollRemoteWifiCommand(machineId, commandId, attempt = 0) {
  try {
    const data = await api("GET", `/api/machines/${machineId}/commands/${commandId}`);
    const command = data.command;
    if (!command) throw new Error("Sin estado de comando");
    if (command.status === "completed") {
      const networks = command.result?.networks || [];
      setRemoteWifiStatus(command.result?.message || `Escaneo completado (${networks.length} redes).`, true);
      renderRemoteWifiNetworks(networks);
      document.getElementById("wifiScanBtn")?.removeAttribute("disabled");
      stopRemoteWifiScanPoll();
      return;
    }
    if (command.status === "failed") {
      setRemoteWifiStatus(command.result?.message || "El escaneo remoto fallo.");
      document.getElementById("wifiScanBtn")?.removeAttribute("disabled");
      stopRemoteWifiScanPoll();
      return;
    }
    if (attempt >= 20) {
      setRemoteWifiStatus("El escaneo esta tardando mas de lo esperado.");
      document.getElementById("wifiScanBtn")?.removeAttribute("disabled");
      stopRemoteWifiScanPoll();
      return;
    }
    remoteWifiState.pollTimer = setTimeout(() => pollRemoteWifiCommand(machineId, commandId, attempt + 1), 2000);
  } catch (error) {
    setRemoteWifiStatus(error.message || "No se pudo consultar el escaneo.");
    document.getElementById("wifiScanBtn")?.removeAttribute("disabled");
    stopRemoteWifiScanPoll();
  }
}

async function scanRemoteWifi(machineId) {
  stopRemoteWifiScanPoll();
  renderRemoteWifiNetworks([]);
  setRemoteWifiStatus("Pidiendo a la maquina que escanee redes...");
  document.getElementById("wifiScanBtn")?.setAttribute("disabled", "disabled");
  try {
    const data = await api("POST", `/api/machines/${machineId}/commands`, { type: "wifi_scan" });
    remoteWifiState.commandId = data.command?.id || null;
    if (!remoteWifiState.commandId) throw new Error("No se recibio el ID del comando.");
    pollRemoteWifiCommand(machineId, remoteWifiState.commandId, 0);
  } catch (error) {
    setRemoteWifiStatus(error.message || "No se pudo iniciar el escaneo.");
    document.getElementById("wifiScanBtn")?.removeAttribute("disabled");
  }
}

async function submitRemoteWifi(machineId) {
  const ssid = (document.getElementById("wifiSsid")?.value || "").trim();
  const pass = document.getElementById("wifiPass")?.value || "";
  const url = (document.getElementById("wifiUrl")?.value || "").trim();
  if (!ssid) return setInlineBanner("wifiMsg", "El SSID es obligatorio.");
  if (url && !/^https?:\/\//i.test(url)) return setInlineBanner("wifiMsg", "La URL debe empezar con http:// o https://");
  try {
    await api("POST", `/api/machines/${machineId}/commands`, {
      type: "wifi_update",
      payload: { ssid, pass, url, preserve_password: pass === "" }
    });
    closeSheet();
    showToast("Cambio remoto de WiFi enviado. La maquina reiniciara al aplicar la nueva config.", "ok");
    await refreshAllData(true);
  } catch (error) {
    setInlineBanner("wifiMsg", error.message || "No se pudo enviar la configuracion.");
  }
}

async function openMachineStock(machineId) {
  const machine = getMachineById(machineId);
  if (!machine) return showToast("No se encontro la maquina.", "danger");
  openSheet({ eyebrow: "Stock", title: machine.name, body: '<div class="empty-state">Cargando stock...</div>' });
  try {
    const data = await api("GET", `/api/machines/${machineId}/stock`);
    stockState = { machine, data };
    renderMachineStockSheet();
  } catch (error) {
    openSheet({ eyebrow: "Stock", title: machine.name, body: `<div class="inline-banner">${escHtml(error.message || "No se pudo cargar el stock.")}</div>` });
  }
}

function getStockItem(stockItemId) {
  return (stockState.data?.items || []).find(item => item.id === stockItemId) || null;
}

function renderMachineStockSheet() {
  const machine = stockState.machine;
  const summary = stockState.data?.summary || {};
  const items = stockState.data?.items || [];
  const movements = stockState.data?.movements || [];
  const itemsHtml = items.length ? items.map(item => `
    <article class="stock-item-card">
      <header>
        <div class="stock-title"><h3>${escHtml(stockItemDisplayName(item))}</h3><div class="muted">Seleccion ${item.item_id}${item.slot_label ? ` · Slot ${escHtml(item.slot_label)}` : ""}</div></div>
        ${stockStatusBadge(item)}
      </header>
      <div class="detail-list">
        <div class="detail-row"><span>Stock actual</span><strong>${item.current_units}${item.capacity_units > 0 ? ` / ${item.capacity_units}` : ""}</strong></div>
        <div class="detail-row"><span>Minimo</span><strong>${item.min_units}</strong></div>
        <div class="detail-row"><span>Actualizado</span><strong>${escHtml(timeSince(item.updated_at))}</strong></div>
      </div>
      <div class="action-row">
        <button class="btn btn-ghost btn-sm" type="button" onclick="openStockItemForm(${item.id})">Editar</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openStockRestock(${item.id})">Reponer</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="openStockAdjust(${item.id})">Ajustar</button>
        <button class="btn ${item.active ? "btn-danger" : "btn-warn"} btn-sm" type="button" onclick="toggleStockActive(${item.id}, ${item.active ? "false" : "true"})">${item.active ? "Dar de baja" : "Reactivar"}</button>
      </div>
    </article>`).join("") : '<div class="empty-state">Todavia no hay selecciones configuradas para esta maquina.</div>';

  const movementsHtml = movements.length ? movements.map(move => `
    <article class="movement-card">
      <div class="movement-top">
        <strong>${escHtml(stockMovementLabel(move.movement_type))}</strong>
        <span class="badge neutral">${move.quantity_delta > 0 ? "+" : ""}${move.quantity_delta}</span>
      </div>
      <div class="movement-meta">
        ${escHtml(move.product_name || `Seleccion ${move.item_id ?? "?"}`)}<br>
        Stock resultante: ${move.current_units === null || move.current_units === undefined ? "Sin dato" : move.current_units}<br>
        Actor: ${escHtml(move.actor_username || "Sistema")} · ${escHtml(formatDateTime(move.created_at))}
      </div>
    </article>`).join("") : '<div class="empty-state">No hay movimientos de stock registrados todavia.</div>';

  openSheet({
    eyebrow: "Stock operativo",
    title: machine.name,
    body: `
      <div class="summary-grid">
        <article class="summary-card"><span>Selecciones activas</span><strong>${summary.configured_items || 0}</strong></article>
        <article class="summary-card"><span>Bajo minimo</span><strong>${summary.low_items || 0}</strong></article>
        <article class="summary-card"><span>Sin stock</span><strong>${summary.empty_items || 0}</strong></article>
        <article class="summary-card"><span>Unidades</span><strong>${summary.total_units || 0}</strong></article>
      </div>
      <div class="action-row">
        <button class="btn btn-ghost btn-sm" type="button" onclick="openMachineStock(${machine.id})">Actualizar</button>
        <button class="btn btn-primary btn-sm" type="button" onclick="openStockItemForm()">Nueva seleccion</button>
      </div>
      <div class="section-title">Selecciones</div>
      <div class="selection-list">${itemsHtml}</div>
      <div class="section-title">Ultimos movimientos</div>
      <div class="selection-list">${movementsHtml}</div>`
  });
}

function openStockItemForm(stockItemId = 0) {
  const item = stockItemId ? getStockItem(stockItemId) : null;
  openSheet({
    eyebrow: stockItemId ? "Editar seleccion" : "Nueva seleccion",
    title: item ? stockItemDisplayName(item) : "Seleccion de stock",
    body: `
      <div class="field-grid">
        <label class="field"><span>item_id</span><input id="stockItemIdField" type="number" min="0" value="${item ? item.item_id : ""}"></label>
        <label class="field"><span>Producto</span><input id="stockProductField" type="text" value="${escHtml(item?.product_name || "")}"></label>
      </div>
      <div class="field-grid">
        <label class="field"><span>Slot</span><input id="stockSlotField" type="text" value="${escHtml(item?.slot_label || "")}"></label>
        <label class="field"><span>Minimo</span><input id="stockMinField" type="number" min="0" value="${item ? item.min_units : 2}"></label>
      </div>
      <div class="field-grid">
        <label class="field"><span>Capacidad</span><input id="stockCapacityField" type="number" min="0" value="${item ? item.capacity_units : 0}"></label>
        <label class="field"><span>Stock actual</span><input id="stockCurrentField" type="number" min="0" value="${item ? Math.max(item.current_units, 0) : 0}"></label>
      </div>
      <label class="toggle-inline"><input id="stockActiveField" type="checkbox" ${item ? (item.active ? "checked" : "") : "checked"}><span>Seleccion activa</span></label>
      <label class="field"><span>Nota</span><textarea id="stockNoteField" placeholder="Ajuste inicial o comentario operativo"></textarea></label>
      <div id="stockItemMsg" class="inline-banner hidden"></div>`,
    footer: `
      <button class="btn btn-ghost btn-sm" type="button" onclick="renderMachineStockSheet()">Volver</button>
      <button class="btn btn-primary btn-sm" type="button" onclick="saveStockItem(${stockItemId || 0})">Guardar</button>`
  });
}

async function saveStockItem(stockItemId = 0) {
  const payload = {
    item_id: parseInt(document.getElementById("stockItemIdField")?.value || "", 10),
    product_name: (document.getElementById("stockProductField")?.value || "").trim(),
    slot_label: (document.getElementById("stockSlotField")?.value || "").trim(),
    capacity_units: parseInt(document.getElementById("stockCapacityField")?.value || "0", 10),
    current_units: parseInt(document.getElementById("stockCurrentField")?.value || "0", 10),
    min_units: parseInt(document.getElementById("stockMinField")?.value || "0", 10),
    active: !!document.getElementById("stockActiveField")?.checked,
    note: (document.getElementById("stockNoteField")?.value || "").trim()
  };
  if (!Number.isInteger(payload.item_id) || payload.item_id < 0) return setInlineBanner("stockItemMsg", "item_id debe ser un entero mayor o igual a cero.");
  if (!payload.product_name) return setInlineBanner("stockItemMsg", "El nombre del producto es obligatorio.");
  try {
    if (stockItemId) {
      await api("PATCH", `/api/machines/${stockState.machine.id}/stock/${stockItemId}`, payload);
    } else {
      await api("POST", `/api/machines/${stockState.machine.id}/stock`, payload);
    }
    showToast("Stock guardado correctamente.", "ok");
    await openMachineStock(stockState.machine.id);
    await refreshAllData(true);
  } catch (error) {
    setInlineBanner("stockItemMsg", error.message || "No se pudo guardar el item.");
  }
}

function openStockRestock(stockItemId) {
  const item = getStockItem(stockItemId);
  if (!item) return showToast("No se encontro la seleccion elegida.", "danger");
  openSheet({
    eyebrow: "Reposicion",
    title: stockItemDisplayName(item),
    body: `
      <div class="field-grid">
        <label class="field"><span>Stock actual</span><input type="number" value="${item.current_units}" disabled></label>
        <label class="field"><span>Agregar unidades</span><input id="stockRestockQty" type="number" min="1" value="1"></label>
      </div>
      <label class="field"><span>Nota</span><textarea id="stockRestockNote" placeholder="Reposicion manual"></textarea></label>
      <div id="stockRestockMsg" class="inline-banner hidden"></div>`,
    footer: `
      <button class="btn btn-ghost btn-sm" type="button" onclick="renderMachineStockSheet()">Volver</button>
      <button class="btn btn-primary btn-sm" type="button" onclick="saveStockRestock(${stockItemId})">Guardar</button>`
  });
}

async function saveStockRestock(stockItemId) {
  const quantity = parseInt(document.getElementById("stockRestockQty")?.value || "", 10);
  if (!Number.isInteger(quantity) || quantity <= 0) return setInlineBanner("stockRestockMsg", "La reposicion debe ser un entero mayor a cero.");
  try {
    await api("POST", `/api/machines/${stockState.machine.id}/stock/${stockItemId}/restock`, {
      quantity,
      note: (document.getElementById("stockRestockNote")?.value || "").trim()
    });
    showToast("Reposicion registrada.", "ok");
    await openMachineStock(stockState.machine.id);
    await refreshAllData(true);
  } catch (error) {
    setInlineBanner("stockRestockMsg", error.message || "No se pudo registrar la reposicion.");
  }
}

function openStockAdjust(stockItemId) {
  const item = getStockItem(stockItemId);
  if (!item) return showToast("No se encontro la seleccion elegida.", "danger");
  openSheet({
    eyebrow: "Ajuste",
    title: stockItemDisplayName(item),
    body: `
      <div class="field-grid">
        <label class="field"><span>Stock actual</span><input type="number" value="${item.current_units}" disabled></label>
        <label class="field"><span>Nuevo stock</span><input id="stockAdjustCurrent" type="number" min="0" value="${Math.max(item.current_units, 0)}"></label>
      </div>
      <label class="field"><span>Nota</span><textarea id="stockAdjustNote" placeholder="Diferencia de conteo o correccion manual"></textarea></label>
      <div id="stockAdjustMsg" class="inline-banner hidden"></div>`,
    footer: `
      <button class="btn btn-ghost btn-sm" type="button" onclick="renderMachineStockSheet()">Volver</button>
      <button class="btn btn-primary btn-sm" type="button" onclick="saveStockAdjust(${stockItemId})">Guardar</button>`
  });
}

async function saveStockAdjust(stockItemId) {
  const currentUnits = parseInt(document.getElementById("stockAdjustCurrent")?.value || "", 10);
  if (!Number.isInteger(currentUnits) || currentUnits < 0) return setInlineBanner("stockAdjustMsg", "El nuevo stock debe ser un entero mayor o igual a cero.");
  try {
    await api("POST", `/api/machines/${stockState.machine.id}/stock/${stockItemId}/adjust`, {
      current_units: currentUnits,
      note: (document.getElementById("stockAdjustNote")?.value || "").trim()
    });
    showToast("Ajuste registrado.", "ok");
    await openMachineStock(stockState.machine.id);
    await refreshAllData(true);
  } catch (error) {
    setInlineBanner("stockAdjustMsg", error.message || "No se pudo registrar el ajuste.");
  }
}

async function toggleStockActive(stockItemId, nextActive) {
  const item = getStockItem(stockItemId);
  if (!item) return showToast("No se encontro la seleccion.", "danger");
  const action = nextActive ? "reactivar" : "dar de baja";
  if (!window.confirm(`Quieres ${action} ${stockItemDisplayName(item)}?`)) return;
  try {
    await api("PATCH", `/api/machines/${stockState.machine.id}/stock/${stockItemId}`, {
      active: !!nextActive,
      note: nextActive ? "Reactivacion manual de seleccion" : "Seleccion dada de baja"
    });
    showToast("Estado de stock actualizado.", "ok");
    await openMachineStock(stockState.machine.id);
    await refreshAllData(true);
  } catch (error) {
    showToast(error.message || "No se pudo actualizar el estado.", "danger");
  }
}

function openApprovePending(pendingId) {
  const pending = PENDING.find(item => item.id === pendingId);
  if (!pending) return showToast("No se encontro la maquina pendiente.", "danger");
  openSheet({
    eyebrow: "Aprobar",
    title: pending.mac,
    body: `
      <label class="field"><span>Nombre de la maquina</span><input id="pendingName" type="text" placeholder="Maquina cafeteria piso 1"></label>
      <label class="field"><span>Ubicacion</span><input id="pendingLocation" type="text" placeholder="Piso 1, area ingreso"></label>
      <div id="pendingApproveMsg" class="inline-banner hidden"></div>`,
    footer: `
      <button class="btn btn-ghost btn-sm" type="button" onclick="closeSheet()">Cancelar</button>
      <button class="btn btn-primary btn-sm" type="button" onclick="approvePending(${pendingId})">Aprobar</button>`
  });
}

async function approvePending(pendingId) {
  const name = (document.getElementById("pendingName")?.value || "").trim();
  const location = (document.getElementById("pendingLocation")?.value || "").trim();
  if (!name) return setInlineBanner("pendingApproveMsg", "El nombre es obligatorio.");
  try {
    await api("POST", `/api/machines/pending/${pendingId}/approve`, { name, location: location || null });
    closeSheet();
    await loadPending(true);
    await loadMachines(true);
    renderCurrentPage();
    showToast("Maquina aprobada correctamente.", "ok");
  } catch (error) {
    setInlineBanner("pendingApproveMsg", error.message || "No se pudo aprobar la maquina.");
  }
}

async function rejectPending(pendingId) {
  if (!window.confirm("Rechazar esta maquina pendiente?")) return;
  try {
    await api("POST", `/api/machines/pending/${pendingId}/reject`);
    await loadPending(true);
    renderCurrentPage();
    showToast("Pendiente rechazado.", "ok");
  } catch (error) {
    showToast(error.message || "No se pudo rechazar la maquina.", "danger");
  }
}
