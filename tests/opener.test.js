const test = require("node:test");
const assert = require("node:assert");

// Simuler un environnement DOM minimal
globalThis.document = {
  elements: [],
  querySelector(sel) {
    if (sel === "main") {
      return { innerText: "5 / 5 paquets disponibles" };
    }
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "main button") {
      return globalThis.document.elements;
    }
    return [];
  }
};

const { waitFor, wikiMastersOpenAll } = require("../opener.js");

test("waitFor resolves as soon as condition becomes truthy without waiting full timeout", async () => {
  let counter = 0;
  const start = Date.now();
  const res = await waitFor(() => (++counter >= 3 ? "found" : null), 1000, 20);
  const duration = Date.now() - start;
  assert.strictEqual(res, "found");
  assert.ok(duration < 300, `Expected fast resolution, took ${duration}ms`);
});

test("wikiMastersOpenAll handles zero available packs cleanly", async () => {
  globalThis.document.elements = [
    { innerText: "Ouvrir", offsetParent: true, disabled: false, click() {} }
  ];
  globalThis.document.querySelector = (sel) => sel === "main" ? { innerText: "0 / 5 paquets disponibles" } : null;
  const res = await wikiMastersOpenAll(5);
  assert.strictEqual(res.opened, 0);
  assert.strictEqual(res.remaining, 0);
});
