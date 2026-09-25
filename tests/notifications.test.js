const test = require("node:test");
const assert = require("node:assert");
const { buildNotificationData } = require("../background.js");

test("buildNotificationData formats titles and messages cleanly without any emojis", () => {
  const successNotif = buildNotificationData("SUCCESS", "3 paquet(s) ouvert(s)");
  assert.strictEqual(successNotif.title, "WikiMasters Auto-Pull : Succès");
  assert.strictEqual(successNotif.message, "3 paquet(s) ouvert(s)");
  // Vérifier qu'aucun emoji Unicode n'est présent
  assert.ok(!/[\u{1F300}-\u{1FAD6}]/u.test(successNotif.title + successNotif.message));

  const authNotif = buildNotificationData("AUTH_REQUIRED", "Session expirée");
  assert.strictEqual(authNotif.title, "WikiMasters : Connexion requise");
  assert.ok(authNotif.message.includes("Cliquez ici pour vous reconnecter"));
  assert.ok(!/[\u{1F300}-\u{1FAD6}]/u.test(authNotif.title + authNotif.message));

  const errorNotif = buildNotificationData("ERROR", "Erreur réseau");
  assert.strictEqual(errorNotif.title, "WikiMasters : Erreur");
  assert.strictEqual(errorNotif.message, "Erreur réseau");
  assert.ok(!/[\u{1F300}-\u{1FAD6}]/u.test(errorNotif.title + errorNotif.message));

  const verifyNotif = buildNotificationData("VERIFICATION_REQUIRED", "Vérification requise");
  assert.strictEqual(verifyNotif.title, "WikiMasters : Vérification requise");
  assert.ok(verifyNotif.message.includes("Contrôle anti-bot détecté"));
  assert.ok(verifyNotif.message.includes("Cliquez ici pour valider manuellement"));
  assert.ok(!/[\u{1F300}-\u{1FAD6}]/u.test(verifyNotif.title + verifyNotif.message));
});
