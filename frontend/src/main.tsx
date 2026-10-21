// ══════════════════════════════════════════════════════════════════
//  KIDORA — Point d'entrée frontend
//  • Montage React (StrictMode)
//  • Enregistrement du service worker PWA en production uniquement
// ══════════════════════════════════════════════════════════════════

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Élément #root introuvable dans index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── PWA (§35) : jamais de SW en développement ─────────────────────
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencieux : l'app fonctionne parfaitement sans SW.
    });
  });
}
