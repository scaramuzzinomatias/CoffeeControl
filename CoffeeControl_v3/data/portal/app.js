(function () {
  const form = document.getElementById("configForm");
  if (!form) return;

  const elements = {
    err: document.getElementById("err"),
    ok: document.getElementById("ok"),
    status: document.getElementById("status"),
    scanBtn: document.getElementById("scanBtn"),
    scanStatus: document.getElementById("scanStatus"),
    scanList: document.getElementById("scanList"),
    selectedNet: document.getElementById("selectedNet"),
    selectedNetMode: document.getElementById("selectedNetMode"),
    selectedNetName: document.getElementById("selectedNetName"),
    ssidInput: document.getElementById("ssidInput"),
    passInput: document.getElementById("wifiPass"),
    urlInput: document.getElementById("urlInput"),
    urlSection: document.getElementById("urlSection"),
    priceInput: document.getElementById("priceInput"),
    testBtn: document.getElementById("testBtn"),
    saveBtn: document.getElementById("saveBtn"),
    showPass: document.getElementById("showPass"),
    deviceInfo: document.getElementById("deviceInfo"),
    diagEventsBtn: document.getElementById("diagEventsBtn"),
    diagMdbBtn: document.getElementById("diagMdbBtn"),
    diagTimeBtn: document.getElementById("diagTimeBtn"),
    diagStatus: document.getElementById("diagStatus"),
    diagEventsOutput: document.getElementById("diagEventsOutput"),
    diagMdbOutput: document.getElementById("diagMdbOutput")
  };

  const state = {
    selectedSSID: "",
    requiresUrl: true
  };

  function setVisible(node, visible) {
    if (!node) return;
    node.classList.toggle("hidden", !visible);
    if (!visible) {
      node.style.display = "none";
      return;
    }

    if (node.classList.contains("selected-net")) {
      node.style.display = "flex";
    } else {
      node.style.display = "";
    }
  }

  function clearAlerts() {
    setVisible(elements.err, false);
    setVisible(elements.ok, false);
    setVisible(elements.status, false);
  }

  function showError(text) {
    if (!elements.err) return;
    elements.err.textContent = text;
    setVisible(elements.err, true);
    setVisible(elements.ok, false);
    setVisible(elements.status, false);
  }

  function showOk(text) {
    if (!elements.ok) return;
    elements.ok.textContent = text;
    setVisible(elements.ok, true);
    setVisible(elements.err, false);
    setVisible(elements.status, false);
  }

  function showStatus(text) {
    if (!elements.status) return;
    elements.status.textContent = text;
    setVisible(elements.status, true);
    setVisible(elements.err, false);
  }

  function setBusy(mode) {
    const busy = Boolean(mode);
    if (elements.scanBtn) {
      elements.scanBtn.disabled = busy;
      elements.scanBtn.textContent = mode === "scan" ? "Escaneando..." : "Escanear redes";
    }
    if (elements.testBtn) {
      elements.testBtn.disabled = busy;
      elements.testBtn.textContent = mode === "test" ? "Probando..." : "Probar conexion";
    }
    if (elements.saveBtn) {
      elements.saveBtn.disabled = busy;
      elements.saveBtn.textContent = mode === "save" ? "Guardando..." : "Guardar y conectar";
    }
  }

  function updateSelectedNet(ssid, modeText) {
    if (!ssid) {
      state.selectedSSID = "";
      setVisible(elements.selectedNet, false);
      if (elements.selectedNetName) elements.selectedNetName.textContent = "";
      return;
    }

    state.selectedSSID = ssid;
    if (elements.selectedNetMode) elements.selectedNetMode.textContent = modeText;
    if (elements.selectedNetName) elements.selectedNetName.textContent = ssid;
    setVisible(elements.selectedNet, true);
  }

  function markSelectedButton() {
    if (!elements.scanList) return;
    elements.scanList.querySelectorAll(".net-btn").forEach((button) => {
      button.classList.toggle("is-active", Boolean(state.selectedSSID) && button.dataset.ssid === state.selectedSSID);
    });
  }

  function syncTypedSSID() {
    const current = (elements.ssidInput?.value || "").trim();
    if (!current) {
      updateSelectedNet("", "");
      markSelectedButton();
      return;
    }

    if (current !== state.selectedSSID) {
      updateSelectedNet(current, "SSID manual listo para guardar");
      state.selectedSSID = "";
    }
    markSelectedButton();
  }

  function showScanStatus(text) {
    if (!elements.scanStatus) return;
    elements.scanStatus.textContent = text;
    setVisible(elements.scanStatus, true);
  }

  function showDiagStatus(text) {
    if (!elements.diagStatus) return;
    if (!text) {
      setVisible(elements.diagStatus, false);
      elements.diagStatus.textContent = "";
      return;
    }
    elements.diagStatus.textContent = text;
    setVisible(elements.diagStatus, true);
  }

  function fillDeviceInfo(info) {
    if (!elements.deviceInfo) return;
    const pieces = [
      "ID: " + (info.mac || "-"),
      "FW: " + (info.fw || "-"),
      "Modo: " + (info.mode || "-"),
      "Precio: " + (info.price || "-")
    ];
    if (info.price_profile) {
      pieces.push("Perfil MDB: " + info.price_profile);
    }
    elements.deviceInfo.textContent = pieces.join(" | ");
  }

  function applyPortalInfo(info) {
    state.requiresUrl = Boolean(info.requires_url);
    if (elements.urlSection) {
      setVisible(elements.urlSection, state.requiresUrl);
    }

    if (elements.ssidInput && info.ssid) elements.ssidInput.value = info.ssid;
    if (elements.passInput && info.pass) elements.passInput.value = info.pass;
    if (elements.urlInput && info.url) elements.urlInput.value = info.url;
    if (elements.priceInput && info.price) elements.priceInput.value = info.price;

    fillDeviceInfo(info);
    syncTypedSSID();
  }

  async function loadPortalInfo() {
    try {
      const response = await fetch("/info", { cache: "no-store" });
      if (!response.ok) throw new Error("info");
      const info = await response.json();
      applyPortalInfo(info);
    } catch (_error) {
      if (elements.deviceInfo) {
        elements.deviceInfo.textContent = "No se pudo leer la informacion del equipo.";
      }
    }
  }

  function prettyJson(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_error) {
      return String(value || "");
    }
  }

  function formatUptime(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return seconds + "s";
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    if (hours <= 0) return minutes + "m " + seconds + "s";
    return hours + "h " + remMinutes + "m " + seconds + "s";
  }

  function resetReasonLabel(code) {
    const map = {
      0: "UNKNOWN",
      1: "POWERON",
      2: "EXT",
      3: "SW",
      4: "PANIC",
      5: "INT_WDT",
      6: "TASK_WDT",
      7: "WDT",
      8: "DEEPSLEEP",
      9: "BROWNOUT",
      10: "SDIO"
    };
    return map[Number(code)] || ("CODE_" + String(code));
  }

  function backendHealthLabel(arg1) {
    if (arg1 === -1) return "WiFi desconectado";
    if (arg1 === -2) return "Sin respuesta del backend";
    if (arg1 > 0) return "HTTP " + arg1;
    return "Estado desconocido";
  }

  function nfcDenyLabel(arg1) {
    if (arg1 === 403) return "rechazado por backend";
    if (arg1 === 401) return "máquina no autorizada o secret inválido";
    if (arg1 === 1) return "límite diario alcanzado offline";
    if (arg1 === 2) return "tarjeta desconocida offline";
    if (arg1 > 0) return "HTTP " + arg1;
    return "motivo no identificado";
  }

  function describeEvent(event) {
    const name = String(event?.name || event?.code || "UNKNOWN");
    const arg1 = Number(event?.arg1 || 0);
    const arg2 = Number(event?.arg2 || 0);

    switch (name) {
      case "BOOT":
        return "Arranque del equipo. Reset: " + resetReasonLabel(arg1) + ".";
      case "WIFI_CONNECT_OK":
        return "WiFi conectado correctamente. RSSI " + arg1 + " dBm.";
      case "WIFI_CONNECT_FAIL":
        return "No pudo conectarse al WiFi guardado.";
      case "WIFI_RECONNECTED":
        return "WiFi reconectado. RSSI " + arg1 + " dBm.";
      case "BACKEND_HEALTH_OK":
        return "Backend alcanzable. /health respondió HTTP " + arg1 + ".";
      case "BACKEND_HEALTH_FAIL":
        return "Falla de conectividad con backend: " + backendHealthLabel(arg1) + ".";
      case "BACKEND_REGISTER_OK":
        return "Máquina aprobada por backend. Precio activo " + arg2 + ".";
      case "BACKEND_REGISTER_PENDING":
        return "Máquina pendiente de aprobación en backend.";
      case "BACKEND_REGISTER_FAIL":
        return "Falló el registro de máquina: " + backendHealthLabel(arg1) + ".";
      case "BACKEND_CARDS_OK":
        return "Cache de tarjetas descargada. Tarjetas: " + arg1 + ".";
      case "BACKEND_CARDS_FAIL":
        return "Falló la descarga de tarjetas. Detalle: " + backendHealthLabel(arg1) + ".";
      case "NFC_READ":
        return "Se leyó una tarjeta NFC.";
      case "NFC_APPROVED_ONLINE":
        return "Tarjeta aprobada online por backend.";
      case "NFC_APPROVED_OFFLINE":
        return "Tarjeta aprobada offline con cache local.";
      case "NFC_DENIED":
        return "Tarjeta rechazada: " + nfcDenyLabel(arg1) + ".";
      case "QUEUE_ENQUEUE":
        return "Evento guardado offline. Pendientes en cola: " + arg2 + ".";
      case "QUEUE_FULL":
        return "Cola offline llena. El equipo descartó nuevos eventos.";
      case "QUEUE_FLUSH_OK":
        return "Cola offline sincronizada. Enviados: " + arg1 + ", pendientes: " + arg2 + ".";
      case "QUEUE_FLUSH_FAIL":
        return "Falló la sincronización de cola offline. Código: " + arg1 + ".";
      case "QUEUE_PERSIST_FAIL":
        return "Falló la persistencia local de la cola offline.";
      case "MDB_RESET":
        return "La máquina expendedora reinició el periférico cashless.";
      case "MDB_BEGIN_SESSION":
        return "Sesión MDB iniciada. Fondos ofrecidos: " + arg2 + ".";
      case "MDB_VEND_REQUEST":
        return "La máquina pidió venta. Selección " + arg1 + ", monto " + arg2 + ".";
      case "MDB_VEND_SUCCESS":
        return "Venta confirmada por la máquina. Selección " + arg1 + ", monto " + arg2 + ".";
      case "MDB_VEND_FAILURE":
        return "Venta fallida o cancelada. Selección " + arg1 + ", monto " + arg2 + ".";
      case "MDB_VEND_END":
        return "La máquina cerró la sesión MDB.";
      case "SESSION_TIMEOUT":
        return "La sesión venció sin cierre correcto. Duración " + formatUptime(arg2) + ".";
      case "MDB_SETUP_CONFIG":
        return "Se capturó SETUP CONFIG del VMC. Level " + arg1 + ".";
      case "MDB_SETUP_PRICES":
        return "Se capturó SETUP PRICES. Min " + arg1 + ", max " + arg2 + ".";
      case "MDB_EXPANSION_REQUEST_ID":
        return "El VMC consultó el REQUEST ID del lector cashless.";
      case "MDB_TIME_DATE_REQUEST_SENT":
        return "El lector pidió la hora MDB al VMC en el siguiente POLL.";
        case "MDB_TIME_DATE_FILE": {
        const hour = (arg1 >> 8) & 0xFF;
        const minute = arg1 & 0xFF;
        const year = (arg2 >> 24) & 0xFF;
        const month = (arg2 >> 16) & 0xFF;
        const day = (arg2 >> 8) & 0xFF;
        const second = arg2 & 0xFF;
        return "La máquina envió fecha/hora MDB: 20" + String(year).padStart(2, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0") + " " + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":" + String(second).padStart(2, "0") + ".";
        }
        case "MDB_GATEWAY_RESET":
          return "La máquina reinició el Communications Gateway 0x18.";
        case "MDB_GATEWAY_SETUP":
          return "La máquina hizo SETUP del gateway. Feature level " + arg1 + ".";
        case "MDB_GATEWAY_CONTROL":
          return "La máquina cambió el estado del gateway con CONTROL " + arg1 + ".";
        case "MDB_GATEWAY_IDENTIFICATION":
          return "La máquina consultó la identificación del gateway 0x18.";
        case "MDB_GATEWAY_FEATURE_ENABLE":
          return "La máquina habilitó features del gateway. Máscara " + arg2 + ".";
        case "MDB_GATEWAY_TIME_DATE_REQUEST":
          return "La máquina pidió fecha/hora al gateway para sincronizar su reloj.";
        case "MDB_GATEWAY_REPORT":
          return "La máquina envió un REPORT al gateway.";
        case "REMOTE_CONFIG_APPLIED":
          return arg1 ? "Se aplicó una configuración remota nueva." : "Llegó una configuración remota pero ya estaba vigente.";
        default:
          return "Evento técnico sin traducción específica.";
      }
  }

  function formatMdbTimeDate(payload) {
    const timeDate = payload?.time_date || {};
    if (timeDate?.valid && timeDate?.iso) {
      return String(timeDate.iso);
    }
    return "—";
  }

  function renderDiagEventsPayload(payload) {
    const events = payload?.events || [];
    const lines = [
      "Capacidad: " + String(payload?.capacity || 0),
      "Eventos guardados: " + String(payload?.count || 0),
      ""
    ];

    if (!events.length) {
      lines.push("No hay eventos registrados todavía.");
      return lines.join("\n");
    }

    events.forEach((event, index) => {
      lines.push("[" + (index + 1) + "] " + String(event.name || event.code));
      lines.push("  Uptime: " + formatUptime(event.ms || 0));
      lines.push("  Lectura: " + describeEvent(event));
      lines.push("  Arg1=" + String(event.arg1 || 0) + " | Arg2=" + String(event.arg2 || 0));
      lines.push("");
    });

    return lines.join("\n").trim();
  }

    function renderDiagMdbPayload(payload) {
      const raw = Array.isArray(payload?.raw) ? payload.raw.join(", ") : "—";
      const expansionRaw = Array.isArray(payload?.expansion_raw) ? payload.expansion_raw.join(", ") : "—";
      const cashlessLines = [
        "Config vista: " + (payload?.seen_config ? "Sí" : "No"),
        "Precios vistos: " + (payload?.seen_prices ? "Sí" : "No"),
        "REQUEST ID visto: " + (payload?.seen_request_id ? "Sí" : "No"),
        "Time/Date visto: " + (payload?.seen_time_date ? "Sí" : "No"),
        "Solicitud manual pendiente: " + (payload?.time_date_probe_pending ? "Sí" : "No"),
      "Último subcmd: " + String(payload?.last_subcmd ?? "—"),
      "Último largo: " + String(payload?.last_len ?? "—"),
      "VMC level: " + String(payload?.vmc_level ?? "—"),
      "Display: " + String(payload?.display_columns ?? "—") + " x " + String(payload?.display_rows ?? "—"),
      "Display info: " + String(payload?.display_info ?? "—"),
      "Max price: " + String(payload?.max_price ?? "—"),
      "Min price: " + String(payload?.min_price ?? "—"),
      "Último visto: " + formatUptime(payload?.last_seen_ms || 0),
      "Último expansion subcmd: " + String(payload?.last_expansion_subcmd ?? "—"),
        "Último expansion visto: " + formatUptime(payload?.last_expansion_seen_ms || 0),
        "Fecha/hora MDB: " + formatMdbTimeDate(payload),
        "Raw setup: " + raw,
        "Raw expansion: " + expansionRaw
      ];
      const gateway = payload?.gateway || null;
      if (!gateway) return cashlessLines.join("\n");
      const gatewayRaw = Array.isArray(gateway?.raw) ? gateway.raw.join(", ") : "—";
      const gatewayTime = gateway?.time_date?.valid && gateway?.time_date?.iso ? String(gateway.time_date.iso) : "—";
      const gatewayLines = [
        "",
        "Gateway 0x18",
        "Setup visto: " + (gateway?.seen_setup ? "Sí" : "No"),
        "Control visto: " + (gateway?.seen_control ? "Sí" : "No"),
        "Identificación vista: " + (gateway?.seen_identification ? "Sí" : "No"),
        "Feature enable visto: " + (gateway?.seen_feature_enable ? "Sí" : "No"),
        "Time/Date request vista: " + (gateway?.seen_time_date_request ? "Sí" : "No"),
        "Gateway enabled: " + (gateway?.gateway_enabled ? "Sí" : "No"),
        "Feature level VMC: " + String(gateway?.vmc_feature_level ?? "—"),
        "Feature level gateway: " + String(gateway?.gateway_feature_level ?? "—"),
        "Features habilitadas: " + String(gateway?.enabled_features ?? "—"),
        "Control state: " + String(gateway?.control_state ?? "—"),
        "Último cmd: " + String(gateway?.last_cmd ?? "—"),
        "Último visto: " + formatUptime(gateway?.last_seen_ms || 0),
        "Última hora entregada: " + gatewayTime,
        "Raw gateway: " + gatewayRaw
      ];
      return cashlessLines.concat(gatewayLines).join("\n");
    }

  async function requestMdbTimeDate() {
    if (elements.diagTimeBtn) {
      elements.diagTimeBtn.disabled = true;
      elements.diagTimeBtn.textContent = "Solicitando...";
    }
    showDiagStatus("Armando solicitud manual de hora MDB para el próximo POLL...");

    try {
      const response = await fetch("/diag/mdb/request-time", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("time-probe");
      const payload = await response.json();
      showDiagStatus(payload?.message || "Solicitud de hora MDB armada.");
      await loadDiagnostics("mdb");
    } catch (_error) {
      showDiagStatus("No se pudo armar la solicitud manual de hora MDB.");
    } finally {
      if (elements.diagTimeBtn) {
        elements.diagTimeBtn.disabled = false;
        elements.diagTimeBtn.textContent = "Solicitar hora MDB";
      }
    }
  }

  function renderDiagOutput(node, payload, formatter) {
    if (!node) return;
    node.textContent = formatter ? formatter(payload) : prettyJson(payload);
    setVisible(node, true);
  }

  async function loadDiagnostics(kind) {
    const isEvents = kind === "events";
    const button = isEvents ? elements.diagEventsBtn : elements.diagMdbBtn;
    const output = isEvents ? elements.diagEventsOutput : elements.diagMdbOutput;
    const endpoint = isEvents ? "/diag/events?limit=20" : "/diag/mdb";
    const idleLabel = isEvents ? "Ver eventos" : "Ver setup MDB";
    const busyLabel = isEvents ? "Cargando..." : "Leyendo...";

    if (button) {
      button.disabled = true;
      button.textContent = busyLabel;
    }
    showDiagStatus(isEvents ? "Leyendo los ultimos eventos del equipo..." : "Leyendo el ultimo setup MDB capturado...");

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error("diag");
      const payload = await response.json();
      renderDiagOutput(output, payload, isEvents ? renderDiagEventsPayload : renderDiagMdbPayload);
      showDiagStatus(isEvents ? "Eventos actualizados." : "Diagnóstico MDB actualizado.");
    } catch (_error) {
      showDiagStatus("No se pudo leer el diagnóstico desde el portal.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = idleLabel;
      }
    }
  }

  function readForm() {
    const data = new FormData(form);
    return {
      ssid: String(data.get("ssid") || "").trim(),
      pass: String(data.get("pass") || ""),
      url: String(data.get("url") || "").trim(),
      priceRaw: String(data.get("price") || "").trim()
    };
  }

  function validateForm() {
    const data = readForm();
    const price = Number(data.priceRaw);

    if (!data.ssid) {
      showError("El SSID es requerido.");
      return null;
    }

    if (state.requiresUrl && !data.url) {
      showError("La URL del servidor es requerida.");
      return null;
    }

    if (data.url && !/^https?:\/\//i.test(data.url)) {
      showError("La URL debe comenzar con http:// o https://.");
      return null;
    }

    if (!/^\d+$/.test(data.priceRaw) || !Number.isFinite(price) || price <= 0) {
      showError("El precio debe ser un numero entero mayor a cero.");
      return null;
    }

    return data;
  }

  function renderNetworks(items) {
    if (!elements.scanList) return;

    elements.scanList.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      setVisible(elements.scanList, false);
      showScanStatus("No se encontraron redes visibles. Podes cargar el SSID manualmente.");
      syncTypedSSID();
      return;
    }

    showScanStatus("Toca una red para seleccionarla claramente o escribe una red oculta manualmente.");
    setVisible(elements.scanList, true);

    items.forEach((net) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "net-btn";
      button.dataset.ssid = net.ssid;

      const name = document.createElement("strong");
      name.textContent = net.ssid;
      button.appendChild(name);

      const meta = document.createElement("span");
      meta.className = "net-meta";
      meta.textContent = (net.secure ? "Contrasena requerida" : "Red abierta") + " | Senal " + net.rssi + " dBm";
      button.appendChild(meta);

      button.addEventListener("click", () => {
        if (elements.ssidInput) elements.ssidInput.value = net.ssid;
        updateSelectedNet(net.ssid, "Red detectada seleccionada");
        markSelectedButton();
        elements.passInput?.focus();
      });

      elements.scanList.appendChild(button);
    });

    if (state.selectedSSID) {
      markSelectedButton();
    } else {
      syncTypedSSID();
    }
  }

  async function scanNetworks() {
    clearAlerts();
    setBusy("scan");
    setVisible(elements.scanList, false);
    showScanStatus("Buscando redes WiFi cercanas...");

    try {
      const response = await fetch("/scan", { cache: "no-store" });
      if (!response.ok) throw new Error("scan");
      const items = await response.json();
      renderNetworks(items);
    } catch (_error) {
      showScanStatus("No se pudo completar el escaneo. Podes cargar el SSID manualmente.");
    } finally {
      setBusy("");
    }
  }

  async function testConnection() {
    const data = validateForm();
    if (!data) return;

    clearAlerts();
    showStatus("Probando conexion WiFi y backend...");
    setBusy("test");

    try {
      const body = new URLSearchParams();
      body.set("ssid", data.ssid);
      body.set("pass", data.pass);
      body.set("url", data.url);

      const response = await fetch("/test", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
      const payload = await response.json().catch(() => null);
      if (!payload) throw new Error("json");

      let message = payload.message || "No se pudo completar la prueba.";
      if (payload.extra) message += " " + payload.extra;

      if (payload.ok) {
        showOk(message);
      } else {
        showError(message);
      }
    } catch (_error) {
      showError("No se pudo ejecutar la prueba de conexion desde el portal.");
    } finally {
      setBusy("");
    }
  }

  async function saveConfig(event) {
    event.preventDefault();
    const data = validateForm();
    if (!data) return;

    clearAlerts();
    showStatus("Guardando configuracion y reiniciando la maquina...");
    setBusy("save");

    try {
      const body = new URLSearchParams();
      body.set("ssid", data.ssid);
      body.set("pass", data.pass);
      body.set("url", data.url);
      body.set("price", data.priceRaw);

      const response = await fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "Error al guardar");
        throw new Error(text || "Error al guardar");
      }

      showOk("Listo. La maquina se conectara en unos segundos y aparecera en el panel de administracion.");
      setVisible(form, false);
      setVisible(elements.status, false);
    } catch (error) {
      showError(error.message || "No se pudo guardar la configuracion desde el portal.");
      setBusy("");
    }
  }

  elements.scanBtn?.addEventListener("click", scanNetworks);
  elements.testBtn?.addEventListener("click", testConnection);
  elements.diagEventsBtn?.addEventListener("click", () => loadDiagnostics("events"));
  elements.diagMdbBtn?.addEventListener("click", () => loadDiagnostics("mdb"));
  elements.diagTimeBtn?.addEventListener("click", requestMdbTimeDate);
  elements.ssidInput?.addEventListener("input", syncTypedSSID);
  elements.showPass?.addEventListener("change", function () {
    if (!elements.passInput) return;
    elements.passInput.type = this.checked ? "text" : "password";
  });
  form.addEventListener("submit", saveConfig);

  loadPortalInfo();
})();
