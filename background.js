// Harmonisation Promesses multi-navigateur (Gecko utilise `browser.*`, Chromium `chrome.*`).
// Alias `ext` pour éviter tout conflit avec les wrappers d'exécution de certains navigateurs (ex: Opera).
const ext = globalThis.browser || globalThis.chrome;
const PULLS_URL = "https://www.wiki-masters.com/pulls";
const ALARM = "wm-autopull";
const DEFAULTS = { enabled: true, periodMin: 100, maxPacks: 10, background: true, notify: true };

async function getSettings() {
  const raw = await ext.storage.local.get(Object.keys(DEFAULTS));
  const merged = { ...DEFAULTS, ...raw };
  const p = parseInt(merged.periodMin, 10);
  const m = parseInt(merged.maxPacks, 10);
  return {
    enabled: Boolean(merged.enabled),
    periodMin: !isNaN(p) ? Math.min(1440, Math.max(1, p)) : DEFAULTS.periodMin,
    maxPacks: !isNaN(m) ? Math.min(10, Math.max(1, m)) : DEFAULTS.maxPacks,
    background: Boolean(merged.background),
    notify: Boolean(merged.notify),
  };
}

async function schedule() {
  const s = await getSettings();
  await ext.alarms.clear(ALARM);
  if (s.enabled) ext.alarms.create(ALARM, { delayInMinutes: s.periodMin, periodInMinutes: s.periodMin });
}

function waitTabComplete(tabId, timeout = 45000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      ext.tabs.onUpdated.removeListener(onUpdated);
      ext.tabs.onRemoved.removeListener(onRemoved);
    };

    function onUpdated(id, info) {
      if (id === tabId && info.status === "complete") {
        cleanup();
        resolve();
      }
    }

    function onRemoved(id) {
      if (id === tabId) {
        cleanup();
        reject(new Error("Onglet fermé par l'utilisateur"));
      }
    }

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Chargement trop long"));
    }, timeout);

    ext.tabs.onUpdated.addListener(onUpdated);
    ext.tabs.onRemoved.addListener(onRemoved);
    ext.tabs.get(tabId).then((t) => {
      if (t && t.status === "complete") {
        cleanup();
        resolve();
      }
    }).catch(() => {});
  });
}

let currentTabId = null;

async function stopCurrentRun() {
  if (currentTabId) {
    try { await ext.tabs.remove(currentTabId); } catch {}
    currentTabId = null;
  }
  await ext.storage.local.set({
    lastRun: Date.now(),
    lastStatus: "Opération interrompue par l'utilisateur",
    lastStatusType: "CANCELLED"
  });
  await ext.storage.local.remove("running");
}

async function run(forceActive = false) {
  const s = await getSettings();
  if (!s.enabled && !forceActive) return;

  const { running } = await ext.storage.local.get("running");
  if (running && Date.now() - running < 5 * 60000) return; // déjà en cours

  await ext.storage.local.set({ running: Date.now(), lastStatus: "En cours…" });

  let tab = null;
  let onTabRemoved = null;

  try {
    tab = await ext.tabs.create({ url: PULLS_URL, active: forceActive || !s.background });
    currentTabId = tab.id;

    // Surveillance de fermeture inattendue pendant tout le traitement
    const tabClosedPromise = new Promise((_, reject) => {
      onTabRemoved = (id) => {
        if (id === tab.id) reject(new Error("Onglet fermé prématurément"));
      };
      ext.tabs.onRemoved.addListener(onTabRemoved);
    });

    const executionPromise = (async () => {
      await waitTabComplete(tab.id);
      await ext.scripting.executeScript({ target: { tabId: tab.id }, files: ["opener.js"] });
      const results = await ext.scripting.executeScript({
        target: { tabId: tab.id },
        args: [s.maxPacks || 10],
        func: (maxPacks) => wikiMastersOpenAll(maxPacks),
      });
      return results?.[0]?.result || { opened: 0, statusType: "ERROR", error: "Aucun résultat retourné" };
    })();

    const result = await Promise.race([executionPromise, tabClosedPromise]);
    await finish(tab.id, forceActive, result);
  } catch (e) {
    const errorMsg = String(e?.message || e);
    await finish(tab?.id, forceActive, { opened: 0, statusType: "ERROR", error: errorMsg });
  } finally {
    currentTabId = null;
    if (onTabRemoved) {
      try { ext.tabs.onRemoved.removeListener(onTabRemoved); } catch {}
    }
  }
}

async function finish(tabId, wasActive, result) {
  const s = await getSettings();

  // Réessai une fois au premier plan si l'onglet en arrière-plan a échoué (sauf si session expirée ou onglet fermé)
  if (result?.error && !wasActive && s.background && result.statusType !== "AUTH_REQUIRED" && result.error !== "Onglet fermé par l'utilisateur") {
    await ext.storage.local.remove("running");
    if (tabId) {
      try { await ext.tabs.remove(tabId); } catch {}
    }
    return run(true);
  }

  const statusType = result?.statusType || (result?.error ? "ERROR" : "SUCCESS");
  const status = result?.error
    ? `Erreur : ${result.error} (${result.opened || 0} ouvert(s))`
    : `${result.opened || 0} paquet(s) ouvert(s)` + (result.remaining != null ? `, ${result.remaining} restant(s)` : "");

  await ext.storage.local.set({
    lastRun: Date.now(),
    lastStatus: status,
    lastStatusType: statusType
  });
  await ext.storage.local.remove("running");

  if (tabId) {
    try { await ext.tabs.remove(tabId); } catch {}
  }

  if (s.notify) {
    try {
      ext.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "WikiMasters Auto-Pull",
        message: status,
      });
    } catch {}
  }
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "wm-run-now") run(true);
  else if (msg.type === "wm-stop") stopCurrentRun();
  else if (msg.type === "wm-reschedule") schedule();
  sendResponse?.({ ok: true });
});

ext.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) run(); });
ext.runtime.onInstalled.addListener(async () => { await schedule(); });
ext.runtime.onStartup.addListener(async () => {
  await ext.storage.local.remove("running");
  if (!(await ext.alarms.get(ALARM))) await schedule();
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { run, finish, schedule, getSettings, waitTabComplete, stopCurrentRun, DEFAULTS };
}
