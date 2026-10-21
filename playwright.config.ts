// ══════════════════════════════════════════════════════════════════
//  KIDORA — Configuration Playwright (tests de bout en bout)
//
//  Prérequis avant de lancer : l'application doit tourner et la base
//  doit être seedée (comptes de démo + 62 jeux) :
//
//     npm run dev          (backend :4000 + frontend :5173)
//     npm run seed         (dans un autre terminal, si pas déjà fait)
//     npm run test:e2e
//
//  Variable optionnelle : E2E_BASE_URL (défaut http://localhost:5173).
// ══════════════════════════════════════════════════════════════════

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 40_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
});
