// Injecté dans la page https://www.wiki-masters.com/pulls
// Flux observé : "Ouvrir" -> flèche suivante x4 -> "Continuer" -> retour à l'écran d'ouverture.
async function wikiMastersOpenAll(maxPacks = 10) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visibleButtons = () =>
    [...document.querySelectorAll("main button")].filter((b) => b.offsetParent);
  const byText = (re) => visibleButtons().find((b) => re.test(b.innerText.trim()));

  async function waitFor(fn, timeout = 15000, step = 250) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  const available = () => {
    const m = (document.querySelector("main")?.innerText || "").match(
      /(\d+)\s*\/\s*\d+\s*\n?\s*paquets disponibles/i
    );
    return m ? parseInt(m[1], 10) : null;
  };

  // Attendre que l'écran d'ouverture soit prêt
  const ready = await waitFor(() => byText(/^Ouvrir$/), 30000);
  if (!ready) return { opened: 0, error: "Bouton « Ouvrir » introuvable (non connecté ?)" };

  let opened = 0;
  for (let i = 0; i < maxPacks; i++) {
    const openBtn = await waitFor(() => byText(/^Ouvrir$/), 15000);
    const left = available();
    if (!openBtn || openBtn.disabled || left === 0) break;

    openBtn.click();

    // Attendre l'écran de révélation
    const revealed = await waitFor(() => byText(/^(Encore|Continuer)/), 20000);
    if (!revealed) return { opened, error: "Écran des cartes non apparu" };

    // Faire défiler les cartes jusqu'à ce que "Continuer" soit actif
    for (let k = 0; k < 20; k++) {
      const cont = byText(/^Continuer/);
      if (cont && !cont.disabled) break;
      const arrows = visibleButtons().filter((b) => b.classList.contains("w-12"));
      const next = arrows[arrows.length - 1];
      if (next && !next.disabled) next.click();
      await sleep(900);
    }

    const cont = byText(/^Continuer/);
    if (!cont || cont.disabled) return { opened, error: "Bouton « Continuer » inaccessible" };
    cont.click();
    opened++;
    await sleep(2000);
  }
  return { opened, remaining: available() };
}
