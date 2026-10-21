// ══════════════════════════════════════════════════════════════════
//  KIDORA — Configuration des tests frontend (Vitest + jsdom)
//  • jest-dom pour des assertions lisibles
//  • Polyfills jsdom : matchMedia, ResizeObserver, scrollTo
//  • Nettoyage DOM après chaque test
// ══════════════════════════════════════════════════════════════════

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// ── matchMedia (utilisé par useMediaQuery et Confetti) ────────────
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => {
    const list: MediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    };
    return list;
  };
}

// ── ResizeObserver (utilisé par useCanvas) ────────────────────────
if (typeof window.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {
      /* noop */
    }
    unobserve(): void {
      /* noop */
    }
    disconnect(): void {
      /* noop */
    }
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// ── scrollTo (certaines navigations jsdom en ont besoin) ─────────
if (typeof window.scrollTo !== "function") {
  window.scrollTo = (() => undefined) as typeof window.scrollTo;
}
