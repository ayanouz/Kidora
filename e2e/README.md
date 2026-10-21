# KIDORA — Tests de bout en bout (Playwright)

## Prérequis

1. La base doit être **seedée** (`npm run seed`) : les tests utilisent les
   comptes de démonstration et les 62 jeux.
2. L'application doit tourner : `npm run dev` (API `:4000` + web `:5173`).
3. Navigateur Playwright installé (une seule fois) :

```bash
npx playwright install --with-deps chromium
```

## Lancer

```bash
npm run test:e2e                      # desktop + mobile (Chromium / Pixel 5)
npx playwright test --project=desktop-chrome
E2E_BASE_URL=http://localhost npx playwright test   # contre la stack Docker
npx playwright test --ui              # mode interactif
npx playwright show-report            # rapport HTML après une exécution
```

## Parcours couverts (`journeys.spec.ts`)

| # | Parcours |
|---|---|
| 1 | Accueil invité : héros, sections, navigation |
| 2 | Catalogue → fiche jeu → démarrage d'une partie |
| 3 | Partie : pause (Échap) → reprise → confirmation « Retour » → quitter |
| 4 | Page 404 → retour à l'accueil |
| 5 | Connexion parent → espace parents (enfants listés) |
| 6 | Classement accessible + option d'apparition (opt-in) |
| 7 | Connexion admin → tableau de bord et onglets |

En cas d'échec : une capture d'écran et une trace sont générées dans
`test-results/` (ouvrir avec `npx playwright show-trace <fichier>.zip`).
