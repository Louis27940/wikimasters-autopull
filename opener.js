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

function checkAuthOrOpenButton() {
  const isLoginPage = Boolean(
    (typeof document !== "undefined" && document.querySelector("a[href*='login'], button[data-action='login'], form[action*='login']")) ||
    (typeof document !== "undefined" && document.body && /connexion|se connecter|login/i.test(document.body.innerText || ""))
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

  // Attendre que l'écran d'ouverture soit prêt
  const ready = await waitFor(() => byText(/^Ouvrir$/), 30000, 100);
  if (!ready) {
    return checkAuthOrOpenButton();
  }

  let opened = 0;
  for (let i = 0; i < maxPacks; i++) {
    const left = available();
    if (left === 0) break;

    const openBtn = await waitFor(() => byText(/^Ouvrir$/), 10000, 50);
    if (!openBtn || openBtn.disabled) break;

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
  module.exports = { waitFor, wikiMastersOpenAll, checkAuthOrOpenButton, sleep, CARD_SLEEP_MS, PACK_SLEEP_MS };
}
