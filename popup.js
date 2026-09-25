// Harmonisation Promesses multi-navigateur (Gecko utilise `browser.*`, Chromium `chrome.*`).
// Alias `ext` pour éviter tout conflit avec les wrappers d'exécution de certains navigateurs (ex: Opera).
const ext = globalThis.browser || globalThis.chrome;
const DEFAULTS = { enabled: true, periodMin: 100, maxPacks: 10, background: true, notify: true };
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
  $("lastStatus").textContent = isRunning ? "En cours d'ouverture…" : (s.lastStatus || "—");
  $("lastStatus").className = isRunning ? "status-badge status-running" : "status-badge";

  $("run").disabled = isRunning;
  $("run").textContent = isRunning ? "Ouverture en cours…" : "Ouvrir maintenant";

  const a = await ext.alarms.get("wm-autopull");
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

  await ext.storage.local.set(sanitized);
  if (reschedule) await ext.runtime.sendMessage({ type: "wm-reschedule" });
}

if (typeof document !== "undefined") {
  $("enabled").onchange = () => save(true);
  $("periodMin").onchange = () => save(true);
  $("maxPacks").onchange = () => save(false);
  $("background").onchange = () => save(false);
  $("notify").onchange = () => save(false);

  $("run").onclick = async () => {
    $("run").disabled = true;
    $("run").textContent = "Lancement…";
    $("lastStatus").textContent = "En cours…";
    $("lastStatus").className = "status-badge status-running";
    await ext.runtime.sendMessage({ type: "wm-run-now" });
  };

  ext.storage.onChanged.addListener(refresh);
  refresh();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DEFAULTS, sanitizeSettings, fmt };
}
