const test = require("node:test");
const assert = require("node:assert");

const { checkAuthOrOpenButton } = require("../opener.js");

test("checkAuthOrOpenButton identifies login page or unauthenticated state", () => {
  globalThis.document = {
    querySelector: (sel) => {
      if (sel === "a[href*='login'], button[data-action='login'], form[action*='login']") return { textContent: "Connexion" };
      return null;
    },
    querySelectorAll: () => [],
    body: { innerText: "Veuillez vous connecter pour accéder à vos cartes" }
  };

  const status = checkAuthOrOpenButton();
  assert.strictEqual(status.statusType, "AUTH_REQUIRED");
  assert.ok(status.error.includes("connecté"));
});

test("checkAuthOrOpenButton returns ERROR when page is not a login page", () => {
  globalThis.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { innerText: "Page normale" }
  };

  const status = checkAuthOrOpenButton();
  assert.strictEqual(status.statusType, "ERROR");
  assert.ok(status.error.includes("Bouton « Ouvrir » introuvable"));
});
