// Harmonisation Promesses multi-navigateur (Gecko utilise `browser.*`, Chromium `chrome.*`).
// Alias `ext` pour éviter tout conflit avec les wrappers d'exécution de certains navigateurs (ex: Opera).
const ext = globalThis.browser || globalThis.chrome;
const PULLS_URL = "https://www.wiki-masters.com/pulls";
const ALARM = "wm-autopull";
const DEFAULTS = { enabled: true, periodMin: 100, background: true, notify: true };

async function getSettings() {
  return { ...DEFAULTS, ...(await ext.storage.local.get(Object.keys(DEFAULTS))) };
}

async function schedule() {
  const s = await getSettings();
  await ext.alarms.clear(ALARM);
  if (s.enabled) ext.alarms.create(ALARM, { delayInMinutes: s.periodMin, periodInMinutes: s.periodMin });
}

function waitTabComplete(tabId, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ext.tabs.onUpdated.removeListener(fn); reject(new Error("Chargement trop long")); }, timeout);
    function fn(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer); ext.tabs.onUpdated.removeListener(fn); resolve();
      }
    }
    ext.tabs.onUpdated.addListener(fn);
    ext.tabs.get(tabId).then((t) => { if (t.status === "complete") fn(tabId, { status: "complete" }); });
  });
}

async function run(forceActive = false) {
  const s = await getSettings();
  const { running } = await ext.storage.local.get("running");
  if (running && Date.now() - running < 5 * 60000) return; // déjà en cours
  await ext.storage.local.set({ running: Date.now(), lastStatus: "En cours…" });

  const tab = await ext.tabs.create({ url: PULLS_URL, active: forceActive || !s.background });
  try {
    await waitTabComplete(tab.id);
    await ext.scripting.executeScript({ target: { tabId: tab.id }, files: ["opener.js"] });
    await ext.scripting.executeScript({
      target: { tabId: tab.id },
      args: [tab.id, forceActive],
      func: (tabId, wasActive) => {
        wikiMastersOpenAll(10)
          .catch((e) => ({ opened: 0, error: String(e) }))
          .then((result) => (globalThis.browser || globalThis.chrome).runtime.sendMessage({ type: "wm-done", tabId, wasActive, result }));
      },
    });
  } catch (e) {
    await finish(tab.id, forceActive, { opened: 0, error: String(e.message || e) });
  }
}

async function finish(tabId, wasActive, result) {
  const s = await getSettings();
  // Réessai une fois au premier plan si l'onglet en arrière-plan a échoué
  if (result.error && !wasActive && s.background) {
    await ext.storage.local.remove("running");
    try { await ext.tabs.remove(tabId); } catch {}
    return run(true);
  }
  const status = result.error
    ? `Erreur : ${result.error} (${result.opened} ouvert(s))`
    : `${result.opened} paquet(s) ouvert(s)` + (result.remaining != null ? `, ${result.remaining} restant(s)` : "");
  await ext.storage.local.set({ lastRun: Date.now(), lastStatus: status });
  await ext.storage.local.remove("running");
  try { await ext.tabs.remove(tabId); } catch {}
  if (s.notify) {
    ext.notifications.create({
      type: "basic", iconUrl: "icon.png", title: "WikiMasters Auto-Pull", message: status,
    });
  }
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "wm-done") finish(msg.tabId, msg.wasActive, msg.result);
  else if (msg.type === "wm-run-now") run();
  else if (msg.type === "wm-reschedule") schedule();
  sendResponse?.({ ok: true });
});

ext.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) run(); });
ext.runtime.onInstalled.addListener(async () => { await schedule(); run(); });
ext.runtime.onStartup.addListener(async () => {
  await ext.storage.local.remove("running");
  if (!(await ext.alarms.get(ALARM))) await schedule();
});
