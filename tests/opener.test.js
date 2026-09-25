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

test("opener defines CARD_SLEEP_MS (200ms) and PACK_SLEEP_MS (750ms)", () => {
  const { CARD_SLEEP_MS, PACK_SLEEP_MS } = require("../opener.js");
  assert.strictEqual(CARD_SLEEP_MS, 200);
  assert.strictEqual(PACK_SLEEP_MS, 750);
});

test("findVerificationContainer accurately detects verification block and ignores unrelated divs", () => {
  const { findVerificationContainer } = require("../opener.js");
  const divNormal = { innerText: "Ouvrir un paquet\nDécouvrez 5 cartes" };
  const divVerify = {
    innerText: "Vérification rapide\nPour continuer... Je ne suis pas un robot\nContinuer",
    querySelector: () => null
  };

  const oldDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll: (sel) => {
      if (sel === "div") return [divNormal, divVerify];
      return [];
    }
  };

  try {
    const found = findVerificationContainer();
    assert.strictEqual(found, divVerify);
  } finally {
    globalThis.document = oldDoc;
  }
});

test("findVerificationContainer selects innermost container when nested inside outer wrapper", () => {
  const { findVerificationContainer } = require("../opener.js");
  const outerDiv = {
    textContent: "Navbar ... Vérification rapide Je ne suis pas un robot Continuer ... Footer"
  };
  const innerCard = {
    textContent: "Vérification rapide\nJe ne suis pas un robot\nContinuer",
    classList: { contains: (c) => c === "border" }
  };
  const label = {
    textContent: "Je ne suis pas un robot",
    closest: (sel) => (sel.includes("border") ? innerCard : outerDiv)
  };

  const oldDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll: (sel) => {
      if (sel === "div") return [outerDiv, innerCard];
      if (sel.includes("label")) return [label];
      return [];
    }
  };

  try {
    const found = findVerificationContainer();
    assert.strictEqual(found, innerCard, "Must select inner card rather than outer wrapper");
  } finally {
    globalThis.document = oldDoc;
  }
});

test("handleVerificationChallenge clicks checkbox and continuer button without touching honeypot", async () => {
  const { handleVerificationChallenge } = require("../opener.js");

  let checkboxClicked = false;
  let continuerClicked = false;
  let honeypotTouched = false;
  let containerVisible = true;

  const honeypotInput = {
    name: "website",
    value: "",
    set value(v) {
      honeypotTouched = true;
    }
  };

  const checkbox = {
    checked: false,
    click() {
      checkboxClicked = true;
      this.checked = true;
    },
    dispatchEvent(ev) {}
  };

  const continueBtn = {
    innerText: "Continuer",
    disabled: true,
    click() {
      continuerClicked = true;
      containerVisible = false; // Simule disparition après validation
    }
  };

  const verifyDiv = {
    innerText: "Vérification rapide\nJe ne suis pas un robot\nContinuer",
    querySelector(sel) {
      if (sel.includes("checkbox")) return checkbox;
      if (sel.includes("button") || sel === "button") return continueBtn;
      if (sel.includes("website")) return honeypotInput;
      return null;
    }
  };

  const oldDoc = globalThis.document;
  globalThis.document = {
    querySelectorAll: (sel) => {
      if (sel === "div" && containerVisible) return [verifyDiv];
      return [];
    }
  };

  // Simule l'activation asynchrone du bouton par React apres le clic checkbox
  setTimeout(() => {
    continueBtn.disabled = false;
  }, 100);

  try {
    const res = await handleVerificationChallenge();
    assert.strictEqual(res.needed, true);
    assert.strictEqual(res.success, true);
    assert.strictEqual(checkboxClicked, true);
    assert.strictEqual(continuerClicked, true);
    assert.strictEqual(honeypotTouched, false, "Honeypot field must never be modified");
  } finally {
    globalThis.document = oldDoc;
  }
});

test("checkAuthOrOpenButton returns VERIFICATION_REQUIRED when verification container is detected", () => {
  const { checkAuthOrOpenButton } = require("../opener.js");
  const oldDoc = globalThis.document;

  const verifyDiv = {
    innerText: "Vérification rapide\nJe ne suis pas un robot"
  };

  globalThis.document = {
    querySelectorAll: (sel) => {
      if (sel === "div") return [verifyDiv];
      return [];
    },
    querySelector: () => null,
    body: { innerText: "Vérification rapide" }
  };

  try {
    const res = checkAuthOrOpenButton();
    assert.strictEqual(res.statusType, "VERIFICATION_REQUIRED");
    assert.ok(res.error.includes("Vérification anti-bot"));
  } finally {
    globalThis.document = oldDoc;
  }
});
