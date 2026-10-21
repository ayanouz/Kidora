// ══════════════════════════════════════════════════════════════════
//  KIDORA — Parcours de bout en bout (Playwright)
//
//  Couvre les chemins critiques :
//   1. Accueil visible pour un invité
//   2. Catalogue → fiche jeu → démarrage d'une partie
//   3. Partie : pause (Échap) → reprise → sortie de partie
//   4. Connexion parent → espace parents
//   5. Connexion admin → tableau de bord d'administration
//
//  ⚠️ Les comptes de démo n'existent qu'après `npm run seed` :
//     parent@kidora.dev / Parent1234!   (rôle PARENT)
//     admin@kidora.dev  / Admin1234!    (rôle ADMIN)
// ══════════════════════════════════════════════════════════════════

import { expect, test, type Page } from "@playwright/test";

/** Connexion via l'interface (attend de quitter la page /login). */
async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "SE CONNECTER" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

test.describe("Invité", () => {
  test("l'accueil s'affiche avec le héros et les jeux populaires", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Joue\. Réfléchis\. Apprends\./ }),
    ).toBeVisible();

    // Les sections du catalogue sont présentes (même vides, titres visibles).
    await expect(page.getByText(/Jeux populaires/)).toBeVisible();

    // Appel à l'action principal du héros (visible aussi sur mobile).
    await expect(page.getByRole("link", { name: /COMMENCER À JOUER/ })).toBeVisible();
  });

  test("catalogue → fiche jeu → la partie démarre", async ({ page }) => {
    await page.goto("/games");
    await expect(page.getByRole("heading", { name: "Tous les jeux" })).toBeVisible();

    // Première carte du catalogue (les cartes pointent vers /games/:slug).
    const firstCard = page.locator('a[href^="/games/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    // Écran « prêt à jouer ? » du GameShell.
    await expect(page.getByRole("button", { name: "C'EST PARTI !" })).toBeVisible({
      timeout: 15_000,
    });

    // (Le niveau par défaut « Facile » est présélectionné pour les invités.)

    await page.getByRole("button", { name: "C'EST PARTI !" }).click();

    // La partie tourne : le bouton pause du HUD est là.
    await expect(page.getByRole("button", { name: /Pause/ }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("une partie se met en pause et se quitte proprement", async ({ page }) => {
    await page.goto("/games");

    const firstCard = page.locator('a[href^="/games/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    await page.getByRole("button", { name: "C'EST PARTI !" }).click();

    // Échap → superposition de pause.
    await page.keyboard.press("Escape");
    await expect(page.getByText("Pause !")).toBeVisible({ timeout: 10_000 });

    // REPRENDRE → la partie continue (le dialogue disparaît).
    await page.getByRole("button", { name: "REPRENDRE" }).click();
    await expect(page.getByText("Pause !")).toBeHidden();

    // Bouton « Retour » du HUD → confirmation douce ; on reste en partie.
    await page.getByRole("button", { name: "Retour" }).click();
    await expect(page.getByText("Quitter la partie ?")).toBeVisible();
    await page.getByRole("button", { name: "CONTINUER LA PARTIE" }).click();
    await expect(page.getByText("Quitter la partie ?")).toBeHidden();

    // Puis pause → QUITTER → retour au catalogue.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "QUITTER" }).click();
    await expect(page).toHaveURL(/\/games$/, { timeout: 10_000 });
  });

  test("la page 404 propose de revenir à l'accueil", async ({ page }) => {
    await page.goto("/cette-page-nexiste-pas");
    await expect(page.getByText(/Oups/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /RETOUR À L'ACCUEIL/ })).toBeVisible();
  });
});

test.describe("Parent", () => {
  test("connexion puis espace parents", async ({ page }) => {
    await login(page, "parent@kidora.dev", "Parent1234!");

    await page.goto("/parent");
    // Cibler le contenu principal : la barre de navigation contient des
    // doublons (menu mobile masqué) qu'un getByText(...).first() attraperait.
    await expect(page.getByRole("heading", { name: "Espace Parents", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mes enfants" })).toBeVisible({
      timeout: 15_000,
    });

    // Au moins un enfant de démo (Adam ou Lina) est listé (carte = heading h2).
    await expect(page.getByRole("heading", { name: /Adam|Lina/ }).first()).toBeVisible();
  });

  test("le classement est accessible et propose l'opt-in", async ({ page }) => {
    await login(page, "parent@kidora.dev", "Parent1234!");

    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "Classement" })).toBeVisible();
    await expect(page.getByText("Apparaître dans le classement").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Administration", () => {
  test("connexion admin → tableau de bord avec ses onglets", async ({ page }) => {
    await login(page, "admin@kidora.dev", "Admin1234!");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible({
      timeout: 15_000,
    });
    // Les onglets ont le rôle ARIA "tab" (tablist accessible), pas "button".
    await expect(page.getByRole("tab", { name: "Vue d'ensemble" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Utilisateurs" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Jeux" })).toBeVisible();
  });
});
