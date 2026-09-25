// Injecté dans la page https://www.wiki-masters.com/pulls
// Flux optimisé : "Ouvrir" -> défilement réactif des cartes (200ms) -> "Continuer" -> pause avant prochain paquet (750ms).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARD_SLEEP_MS = 200;
const PACK_SLEEP_MS = 750;

async function waitFor(fn, timeout = 15000, step = 50) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = fn();
    if (v) return v;
    await sleep(step);
  }
  return null;
}

function findVerificationContainer(doc = (typeof document !== "undefined" ? document : null)) {
  if (!doc || !doc.querySelectorAll) return null;

  // 1. Recherche ciblée à partir du texte ou de l'étiquette « Je ne suis pas un robot »
  try {
    const all = doc.querySelectorAll("label, span, p, div");
    for (const el of all) {
      const text = el.textContent || el.innerText || "";
      if (/je ne suis pas un robot/i.test(text)) {
        const card = (el.closest && (el.closest("div[class*='border']") || el.closest("div.border") || el.closest("div"))) || el.parentElement;
        if (card) return card;
      }
    }
  } catch {}

  // 2. Recherche par conteneur le plus profond (le plus spécifique)
  const divs = [...doc.querySelectorAll("div")].filter((div) => {
    const text = div.textContent || div.innerText || "";
    return /vérification rapide/i.test(text) && /je ne suis pas un robot/i.test(text);
  });
  if (divs.length > 0) {
    return divs[divs.length - 1];
  }

  return null;
}

async function handleVerificationChallenge(doc = (typeof document !== "undefined" ? document : null)) {
  const container = findVerificationContainer(doc);
  if (!container) return { needed: false, success: true };

  const checkbox = container.querySelector
    ? container.querySelector("input[type='checkbox']")
    : (doc.querySelector ? doc.querySelector("input[type='checkbox']:not([name='website'])") : null);

  const getContinueBtn = (c) => {
    const btns = c && c.querySelectorAll ? [...c.querySelectorAll("button")] : [];
    return btns.find((b) => /continuer/i.test((b.textContent || b.innerText || "").trim())) || (c && c.querySelector ? c.querySelector("button") : null);
  };

  const continueBtn = getContinueBtn(container);

  if (!checkbox || !continueBtn) {
    return { needed: true, success: false, error: "Éléments de vérification introuvables" };
  }

  // Cocher la case (sans toucher au champ honeypot input[name='website'])
  if (!checkbox.checked) {
    checkbox.click();
    if (typeof console !== "undefined" && console.log) {
      console.log("[wm-autopull] Checkbox cliquee. Etat checked =", checkbox.checked);
    }
  }

  // Laisser le temps à React de mettre à jour son état et de déverrouiller le bouton Continuer
  await sleep(700);

  // Attendre l'activation du bouton Continuer
  const activeBtn = await waitFor(() => {
    const c = findVerificationContainer(doc) || container;
    const btn = getContinueBtn(c);
    if (typeof console !== "undefined" && console.log && btn) {
      console.log("[wm-autopull] Bouton Continuer detecte, disabled =", btn.disabled);
    }
    return btn && !btn.disabled ? btn : null;
  }, 4000, 50);

  if (!activeBtn) {
    return { needed: true, success: false, error: "Bouton Continuer de vérification inactif" };
  }

  // Clic sur Continuer
  if (typeof activeBtn.click === "function") {
    activeBtn.click();
  }
  if (typeof activeBtn.dispatchEvent === "function") {
    try {
      if (typeof MouseEvent !== "undefined") {
        activeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
    } catch {}
  }

  // Attendre la disparition du conteneur de vérification
  const cleared = await waitFor(() => !findVerificationContainer(doc), 10000, 100);
  if (!cleared) {
    return { needed: true, success: false, error: "Vérification non validée par le serveur" };
  }

  await sleep(500);
  return { needed: true, success: true };
}

function checkAuthOrOpenButton(doc = (typeof document !== "undefined" ? document : null)) {
  if (findVerificationContainer(doc)) {
    return { opened: 0, statusType: "VERIFICATION_REQUIRED", error: "Vérification anti-bot requise" };
  }
  const isLoginPage = Boolean(
    (doc && doc.querySelector && doc.querySelector("a[href*='login'], button[data-action='login'], form[action*='login']")) ||
    (doc && doc.body && /connexion|se connecter|login/i.test(doc.body.innerText || ""))
  );
  if (isLoginPage) {
    return { opened: 0, statusType: "AUTH_REQUIRED", error: "Session expirée ou utilisateur déconnecté" };
  }
  return { opened: 0, statusType: "ERROR", error: "Bouton « Ouvrir » introuvable (non connecté ?)" };
}

async function wikiMastersOpenAll(maxPacks = 10) {
  const visibleButtons = () =>
    [...document.querySelectorAll("main button")].filter((b) => b.offsetParent);
  const byText = (re) => visibleButtons().find((b) => re.test((b.innerText || "").trim()));

  const available = () => {
    const m = (document.querySelector("main")?.innerText || "").match(
      /(\d+)\s*\/\s*\d+\s*\n?\s*paquets disponibles/i
    );
    return m ? parseInt(m[1], 10) : null;
  };

  // Résoudre un éventuel contrôle anti-bot avant de démarrer
  if (findVerificationContainer()) {
    const v = await handleVerificationChallenge();
    if (!v.success) {
      return { opened: 0, statusType: "VERIFICATION_REQUIRED", error: v.error || "Vérification anti-bot requise" };
    }
  }

  // Attendre que l'écran d'ouverture soit prêt ou qu'un contrôle anti-bot apparaisse
  const ready = await waitFor(() => {
    if (findVerificationContainer()) return "VERIF";
    const b = byText(/^Ouvrir$/);
    return b ? b : null;
  }, 30000, 100);

  if (!ready) {
    return checkAuthOrOpenButton();
  }

  if (ready === "VERIF" || findVerificationContainer()) {
    const v = await handleVerificationChallenge();
    if (!v.success) {
      return { opened: 0, statusType: "VERIFICATION_REQUIRED", error: v.error || "Vérification anti-bot requise" };
    }
    // Attendre que le bouton Ouvrir soit prêt après résolution
    await waitFor(() => byText(/^Ouvrir$/), 10000, 100);
  }

  let opened = 0;
  for (let i = 0; i < maxPacks; i++) {
    const left = available();
    if (left === 0) break;

    // Contrôle anti-bot éventuel en cours de cycle
    if (findVerificationContainer()) {
      const v = await handleVerificationChallenge();
      if (!v.success) {
        return { opened, remaining: available(), statusType: "VERIFICATION_REQUIRED", error: v.error || "Vérification anti-bot requise" };
      }
    }

    const openBtn = await waitFor(() => {
      const b = byText(/^Ouvrir$/);
      return b && !b.disabled ? b : null;
    }, 10000, 50);
    if (!openBtn) break;

    openBtn.click();

    // Attendre l'écran de révélation
    const revealed = await waitFor(() => byText(/^(Encore|Continuer)/), 15000, 50);
    if (!revealed) return { opened, statusType: "ERROR", error: "Écran des cartes non apparu" };

    // Défiler les cartes réactivement jusqu'à ce que "Continuer" soit actif
    for (let k = 0; k < 20; k++) {
      const cont = byText(/^Continuer/);
      if (cont && !cont.disabled) break;

      const arrows = visibleButtons().filter((b) => b.classList?.contains("w-12"));
      const next = arrows[arrows.length - 1];
      if (next && !next.disabled) {
        next.click();
      }
      // Pause entre chaque carte
      await sleep(CARD_SLEEP_MS);
    }

    const cont = byText(/^Continuer/);
    if (!cont || cont.disabled) return { opened, statusType: "ERROR", error: "Bouton « Continuer » inaccessible" };
    cont.click();
    opened++;

    // Attente réactive du retour à l'écran d'accueil ou de la fin des paquets
    await waitFor(() => byText(/^Ouvrir$/) || available() === 0, 8000, 50);

    // Pause avant d'ouvrir un autre paquet
    if (i < maxPacks - 1 && available() !== 0) {
      await sleep(PACK_SLEEP_MS);
    }
  }
  return { opened, remaining: available(), statusType: "SUCCESS" };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    waitFor,
    wikiMastersOpenAll,
    checkAuthOrOpenButton,
    findVerificationContainer,
    handleVerificationChallenge,
    sleep,
    CARD_SLEEP_MS,
    PACK_SLEEP_MS
  };
}
