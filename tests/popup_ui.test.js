const test = require("node:test");
const assert = require("node:assert");
const { getStatusBadgeClass } = require("../popup.js");

test("getStatusBadgeClass maps status types to appropriate CSS classes", () => {
  assert.strictEqual(getStatusBadgeClass("SUCCESS", false), "status-badge status-success");
  assert.strictEqual(getStatusBadgeClass("AUTH_REQUIRED", false), "status-badge status-warning");
  assert.strictEqual(getStatusBadgeClass("VERIFICATION_REQUIRED", false), "status-badge status-warning");
  assert.strictEqual(getStatusBadgeClass("CANCELLED", false), "status-badge status-warning");
  assert.strictEqual(getStatusBadgeClass("ERROR", false), "status-badge status-error");
  assert.strictEqual(getStatusBadgeClass("SUCCESS", true), "status-badge status-running");
});
