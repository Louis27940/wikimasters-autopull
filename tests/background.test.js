const test = require("node:test");
const assert = require("node:assert");

// Simuler les API WebExtension / Chrome avec ext
const store = new Map();
const mockExt = {
  storage: {
    local: {
      get: async (keys) => {
        if (!keys) return Object.fromEntries(store);
        if (typeof keys === "string") return { [keys]: store.get(keys) };
        const res = {};
        for (const k of keys) if (store.has(k)) res[k] = store.get(k);
        return res;
      },
      set: async (obj) => {
        for (const [k, v] of Object.entries(obj)) store.set(k, v);
      },
      remove: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) store.delete(k);
      }
    }
  },
  alarms: {
    clear: async () => {},
    create: () => {},
    get: async () => null,
    onAlarm: { addListener: () => {} }
  },
  tabs: {
    create: async () => ({ id: 123 }),
    remove: async () => {},
    get: async () => ({ status: "complete" }),
    onUpdated: { addListener: () => {}, removeListener: () => {} },
    onRemoved: { addListener: () => {}, removeListener: () => {} }
  },
  scripting: {
    executeScript: async () => [{ result: { opened: 2, remaining: 0 } }]
  },
  notifications: {
    create: () => {}
  },
  runtime: {
    onMessage: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} }
  }
};

globalThis.browser = mockExt;

const bg = require("../background.js");

test("run() does nothing if disabled and forceActive is false", async () => {
  store.clear();
  store.set("enabled", false);
  let tabsCreated = 0;
  mockExt.tabs.create = async () => { tabsCreated++; return { id: 1 }; };

  await bg.run(false);
  assert.strictEqual(tabsCreated, 0, "No tab should be opened when disabled");
});

test("run() executes and clears running lock even on error", async () => {
  store.clear();
  store.set("enabled", true);
  mockExt.tabs.create = async () => ({ id: 456 });
  mockExt.scripting.executeScript = async () => { throw new Error("Script injection failed"); };

  await bg.run(true);
  assert.strictEqual(store.get("running"), undefined, "running flag must be cleared");
  const lastStatus = store.get("lastStatus");
  assert.ok(lastStatus && lastStatus.includes("Erreur"), "Error status must be recorded");
});
