// Harmonisation Promesses multi-navigateur (Gecko utilise `browser.*`, Chromium `chrome.*`).
// Alias `ext` pour éviter tout conflit avec les wrappers d'exécution de certains navigateurs (ex: Opera).
const ext = globalThis.browser || globalThis.chrome;
const DEFAULTS = { enabled: true, periodMin: 100, maxPacks: 10, background: true, notify: true };
const LOGIN_URL = "https://www.wiki-masters.com/login";
const PULLS_URL = "https://www.wiki-masters.com/pulls";

const $ = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);
const fmt = (t) => (t ? new Date(t).toLocaleString("fr-FR") : "—");

function sanitizeSettings(input = {}) {
  const p = parseInt(input.periodMin, 10);
  const m = parseInt(input.maxPacks, 10);
  return {
    enabled: Boolean(input.enabled),
    periodMin: !isNaN(p) ? Math.min(1440, Math.max(1, p)) : DEFAULTS.periodMin,
    maxPacks: !isNaN(m) ? Math.min(10, Math.max(1, m)) : DEFAULTS.maxPacks,
    background: Boolean(input.background),
    notify: Boolean(input.notify),
  };
}

function getStatusBadgeClass(statusType, isRunning) {
  if (isRunning) return "status-badge status-running";
  switch (statusType) {
    case "SUCCESS":
      return "status-badge status-success";
    case "AUTH_REQUIRED":
    case "VERIFICATION_REQUIRED":
    case "CANCELLED":
      return "status-badge status-warning";
    case "ERROR":
      return "status-badge status-error";
    default:
      return "status-badge";
  }
}

async function refresh() {
  if (typeof document === "undefined") return;
  const s = { ...DEFAULTS, ...(await ext.storage.local.get(null)) };
  const isRunning = Boolean(s.running && Date.now() - s.running < 5 * 60000);

  $("enabled").checked = s.enabled;
  $("periodMin").value = s.periodMin;
  $("maxPacks").value = s.maxPacks;
  $("background").checked = s.background;
  $("notify").checked = s.notify;

  $("lastRun").textContent = fmt(s.lastRun);

  if (isRunning) {
    $("lastStatus").innerHTML = '<span class="spinner"></span> Ouverture en cours…';
    $("lastStatus").className = getStatusBadgeClass(s.lastStatusType, true);
    $("run").textContent = "Arrêter le cycle";
    $("run").className = "btn-action btn-stop";
    $("run").disabled = false;
  } else {
    $("lastStatus").textContent = s.lastStatus || "—";
    $("lastStatus").className = getStatusBadgeClass(s.lastStatusType, false);
    $("run").textContent = "Ouvrir maintenant";
    $("run").className = "btn-action";
    $("run").disabled = false;
  }

  // Affichage du bandeau de connexion si session expirée
  const authBanner = $("authBanner");
  if (authBanner) {
    authBanner.style.display = s.lastStatusType === "AUTH_REQUIRED" ? "block" : "none";
  }

  // Affichage du bandeau de vérification si contrôle anti-bot requis
  const verificationBanner = $("verificationBanner");
  if (verificationBanner) {
    verificationBanner.style.display = s.lastStatusType === "VERIFICATION_REQUIRED" ? "block" : "none";
  }

  const a = await ext.alarms?.get("wm-autopull");
  $("next").textContent = s.enabled && a ? fmt(a.scheduledTime) : "désactivé";
}

async function save(reschedule) {
  if (typeof document === "undefined") return;
  const sanitized = sanitizeSettings({
    enabled: $("enabled").checked,
    periodMin: $("periodMin").value,
    maxPacks: $("maxPacks").value,
    background: $("background").checked,
    notify: $("notify").checked,
  });

  // Mettre à jour visuellement les champs avec les valeurs nettoyées
  $("periodMin").value = sanitized.periodMin;
  $("maxPacks").value = sanitized.maxPacks;
  $("periodMin").classList.remove("input-invalid");
  $("maxPacks").classList.remove("input-invalid");

  await ext.storage.local.set(sanitized);
  if (reschedule && ext.runtime?.sendMessage) {
    await ext.runtime.sendMessage({ type: "wm-reschedule" });
  }
}

function validateInput(inputEl, min, max) {
  const val = parseInt(inputEl.value, 10);
  if (isNaN(val) || val < min || val > max) {
    inputEl.classList.add("input-invalid");
  } else {
    inputEl.classList.remove("input-invalid");
  }
}

if (typeof document !== "undefined") {
  $("enabled").onchange = () => save(true);

  $("periodMin").oninput = () => validateInput($("periodMin"), 1, 1440);
  $("periodMin").onchange = () => save(true);

  $("maxPacks").oninput = () => validateInput($("maxPacks"), 1, 10);
  $("maxPacks").onchange = () => save(false);

  $("background").onchange = () => save(false);
  $("notify").onchange = () => save(false);

  $("run").onclick = async () => {
    const { running } = await ext.storage.local.get("running");
    const isRunning = Boolean(running && Date.now() - running < 5 * 60000);

    if (isRunning) {
      $("run").disabled = true;
      $("run").textContent = "Interruption…";
      await ext.runtime.sendMessage({ type: "wm-stop" });
    } else {
      $("run").disabled = true;
      $("run").textContent = "Lancement…";
      $("lastStatus").innerHTML = '<span class="spinner"></span> Lancement…';
      $("lastStatus").className = getStatusBadgeClass(null, true);
      await ext.runtime.sendMessage({ type: "wm-run-now" });
    }
  };

  const loginBtn = $("loginBtn");
  if (loginBtn) {
    loginBtn.onclick = () => {
      ext.tabs.create({ url: LOGIN_URL });
    };
  }

  const verifyBtn = $("verifyBtn");
  if (verifyBtn) {
    verifyBtn.onclick = () => {
      ext.tabs.create({ url: PULLS_URL });
    };
  }

  ext.storage?.onChanged?.addListener(refresh);
  refresh();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULTS, sanitizeSettings, getStatusBadgeClass, fmt };
}
