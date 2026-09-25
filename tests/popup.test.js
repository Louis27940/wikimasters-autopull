const test = require("node:test");
const assert = require("node:assert");

const { DEFAULTS, sanitizeSettings } = require("../popup.js");

test("sanitizeSettings handles valid and invalid numeric inputs correctly", () => {
  assert.deepStrictEqual(
    sanitizeSettings({ enabled: true, periodMin: "60", maxPacks: "15", background: true, notify: false }),
    { enabled: true, periodMin: 60, maxPacks: 10, background: true, notify: false }
  );

  assert.deepStrictEqual(
    sanitizeSettings({ enabled: true, periodMin: "-5", maxPacks: "0", background: true, notify: true }),
    { enabled: true, periodMin: 1, maxPacks: 1, background: true, notify: true }
  );
});
