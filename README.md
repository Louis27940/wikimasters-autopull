# WikiMasters Auto-Pull

Extension Chrome qui ouvre automatiquement les paquets disponibles sur [wiki-masters.com/pulls](https://www.wiki-masters.com/pulls) toutes les 100 minutes (intervalle réglable).

## Fonctionnalités

- Ouvre tous les paquets disponibles (jusqu'à 10 par cycle), fait défiler les 5 cartes et valide chaque paquet
- Se déclenche à l'installation, puis toutes les 100 minutes
- Travaille dans un onglet en arrière-plan qui se ferme tout seul à la fin
- Réessaie une fois au premier plan si l'ouverture échoue en arrière-plan
- Popup de réglages :
  - activer ou désactiver l'extension
  - changer l'intervalle
  - lancer une ouverture immédiate
  - voir le dernier résultat et l'heure du prochain cycle
- Notification optionnelle après chaque cycle

## Installation

L'extension n'est pas publiée sur le Chrome Web Store : on l'installe en mode développeur.

1. **Télécharger le code**
   - soit avec le bouton vert **Code → Download ZIP** de cette page, puis décompresser l'archive ;
   - soit avec git :
     ```bash
     git clone git@github.com:erocha42/wikimasters-autopull.git
     ```
2. Ouvrir `chrome://extensions` dans Chrome.
3. Activer le **Mode développeur** (interrupteur en haut à droite).
4. Cliquer sur **Charger l'extension non empaquetée** et sélectionner le dossier qui contient `manifest.json`.
5. Épingler l'extension (icône puzzle 🧩 → épingle) pour avoir accès au popup.

> Il faut être **connecté à WikiMasters** dans ce navigateur. L'extension utilise votre session existante.

Ça marche aussi dans les autres navigateurs basés sur Chromium : Edge, Brave, Opera…

## Mise à jour

1. Remplacer les fichiers par la nouvelle version, avec `git pull` ou en retéléchargeant le ZIP.
2. Dans `chrome://extensions`, cliquer sur l'icône ↻ de l'extension.

## Fonctionnement

| Fichier | Rôle |
|---|---|
| `manifest.json` | Déclaration de l'extension (Manifest V3) |
| `background.js` | Planification (`chrome.alarms`), ouverture/fermeture de l'onglet, notifications |
| `opener.js` | Script injecté dans la page : clique sur « Ouvrir », fait défiler les cartes, clique sur « Continuer », recommence tant qu'il reste des paquets |
| `popup.html` / `popup.js` | Interface de réglages |
| `icon.png` | Icône des notifications |

### Permissions demandées

| Permission | Utilisation |
|---|---|
| `alarms` | Déclencher l'ouverture à intervalle régulier |
| `tabs` | Ouvrir et fermer l'onglet `/pulls` |
| `scripting` | Injecter `opener.js` dans la page |
| `storage` | Enregistrer les réglages et le dernier résultat |
| `notifications` | Afficher le résumé après chaque cycle |
| `https://www.wiki-masters.com/*` | Seul site sur lequel l'extension agit |

L'extension n'envoie aucune donnée à l'extérieur. Elle se contente de cliquer dans la page, à votre place.

## Limites

- Chrome doit être **ouvert** : si un cycle est manqué, il s'exécute au prochain démarrage.
- Le script repère les boutons par leur texte (« Ouvrir », « Continuer ») et la flèche « suivant ». Si le site change son interface, il faudra adapter `opener.js`.
- Chrome peut afficher au démarrage un avertissement sur les extensions en mode développeur. C'est normal, il suffit de le fermer.

## Avertissement

Projet non officiel, sans lien avec WikiMasters. Automatiser des actions peut être contraire aux conditions d'utilisation du site : à utiliser à vos risques.

## Licence

MIT
