// Harmonisation Promesses multi-navigateur (Gecko utilise `browser.*`, Chromium `chrome.*`).
// Alias `ext` pour éviter tout conflit avec les wrappers d'exécution de certains navigateurs (ex: Opera).
const ext = globalThis.browser || globalThis.chrome;
const DEFAULTS = { enabled: true, periodMin: 100, background: true, notify: true };
const $ = (id) => document.getElementById(id);
const fmt = (t) => (t ? new Date(t).toLocaleString("fr-FR") : "—");

async function refresh() {
  const s = { ...DEFAULTS, ...(await ext.storage.local.get(null)) };
  $("enabled").checked = s.enabled;
  $("periodMin").value = s.periodMin;
  $("background").checked = s.background;
  $("notify").checked = s.notify;
  $("lastRun").textContent = fmt(s.lastRun);
  $("lastStatus").textContent = s.lastStatus || "—";
  const a = await ext.alarms.get("wm-autopull");
  $("next").textContent = a ? fmt(a.scheduledTime) : "désactivé";
}

async function save(reschedule) {
  await ext.storage.local.set({
    enabled: $("enabled").checked,
    periodMin: Math.max(1, parseInt($("periodMin").value, 10) || 100),
    background: $("background").checked,
    notify: $("notify").checked,
  });
  if (reschedule) await ext.runtime.sendMessage({ type: "wm-reschedule" });
  setTimeout(refresh, 200);
}

$("enabled").onchange = () => save(true);
$("periodMin").onchange = () => save(true);
$("background").onchange = () => save(false);
$("notify").onchange = () => save(false);
$("run").onclick = async () => {
  await ext.runtime.sendMessage({ type: "wm-run-now" });
  $("lastStatus").textContent = "En cours…";
};
ext.storage.onChanged.addListener(refresh);
refresh();
