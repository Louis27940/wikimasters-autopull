const test = require("node:test");
const assert = require("node:assert");
const { sanitizeSettings } = require("../popup.js");

test("sanitizeSettings clamps periodMin between 1 and 1440", () => {
  assert.strictEqual(sanitizeSettings({ periodMin: 0 }).periodMin, 1);
  assert.strictEqual(sanitizeSettings({ periodMin: -10 }).periodMin, 1);
  assert.strictEqual(sanitizeSettings({ periodMin: 99999 }).periodMin, 1440);
  assert.strictEqual(sanitizeSettings({ periodMin: "60" }).periodMin, 60);
  assert.strictEqual(sanitizeSettings({ periodMin: "invalid" }).periodMin, 100);
});

test("sanitizeSettings strictly enforces maxPacks between 1 and 10", () => {
  assert.strictEqual(sanitizeSettings({ maxPacks: 0 }).maxPacks, 1);
  assert.strictEqual(sanitizeSettings({ maxPacks: -5 }).maxPacks, 1);
  assert.strictEqual(sanitizeSettings({ maxPacks: 11 }).maxPacks, 10);
  assert.strictEqual(sanitizeSettings({ maxPacks: 50 }).maxPacks, 10);
  assert.strictEqual(sanitizeSettings({ maxPacks: 5 }).maxPacks, 5);
  assert.strictEqual(sanitizeSettings({ maxPacks: "NaN" }).maxPacks, 10);
});

test("sanitizeSettings enforces boolean flags strictly", () => {
  const res = sanitizeSettings({ enabled: "true", background: 1, notify: 0 });
  assert.strictEqual(res.enabled, true);
  assert.strictEqual(res.background, true);
  assert.strictEqual(res.notify, false);
});
