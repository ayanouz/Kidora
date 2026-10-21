// ══════════════════════════════════════════════════════════════════
//  KIDORA — Boîte à outils commune aux nouveaux jeux
//  • tirage aléatoire (shuffle, randInt, pick…)
//  • budget de points sûr (§44) : jamais plus de 95 % du plafond
//    anti-cheat, même si le jeu crédite trop souvent
//  • timers nettoyés au démontage
//  • sélection au clavier (touches 1…9)
// ══════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameContext } from "../engine/types";

/** Mélange de Fisher-Yates (ne modifie pas le tableau d'origine). */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Entier aléatoire inclusif. */
export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function pickOne<T>(items: readonly T[]): T {
  return items[randInt(0, Math.max(0, items.length - 1))];
}

/** `count` éléments distincts (ou tout le tableau s'il est trop court). */
export function pickMany<T>(items: readonly T[], count: number): T[] {
  return shuffle(items).slice(0, Math.max(0, count));
}

/** Référence toujours à jour sur le contexte du jeu (closures sûres). */
export function useCtxRef(ctx: GameContext) {
  const ref = useRef(ctx);
  ref.current = ctx;
  return ref;
}

/** Timers propres : `later` + nettoyage automatique au démontage. */
export function useTimers() {
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    },
    [],
  );

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
    return id;
  }, []);

  return { later };
}

/** Score maximal autorisé pour la partie (95 % du plafond serveur). */
export function scoreCap(ctx: GameContext): number {
  const max = ctx.game.config.maxScore?.[ctx.difficulty] ?? ctx.game.maxScoreHint;
  return Math.max(0, Math.floor(max * 0.95));
}

/**
 * Crédite des points en restant sous le plafond de sécurité.
 * Retourne le nombre de points réellement accordés (0 si plafond atteint).
 * `silent` évite le son/feedback (utile pour les petits bonus).
 */
export function useAward(ctx: GameContext) {
  const ctxRef = useCtxRef(ctx);
  const cap = useMemo(
    () => scoreCap(ctx),
    // Le plafond ne change pas pendant une partie (le shell remonte le jeu
    // lorsqu'on change de difficulté ou de niveau).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.difficulty, ctx.game.maxScoreHint, ctx.game.config.maxScore],
  );
  const credited = useRef(0);

  return useCallback(
    (points: number, silent = false) => {
      const remaining = cap - credited.current;
      if (remaining <= 0 || points <= 0) return 0;
      const awarded = Math.min(remaining, Math.max(1, Math.round(points)));
      credited.current += awarded;
      if (silent) ctxRef.current.addScore(awarded);
      else ctxRef.current.signalCorrect(awarded);
      return awarded;
    },
    [cap],
  );
}

/** Sélection au clavier : touches 1…count (hors champs de saisie). */
export function useKeypad(count: number, onSelect: (index: number) => void, enabled = true) {
  const handlerRef = useRef(onSelect);
  handlerRef.current = onSelect;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const digit = Number(event.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > count) return;
      event.preventDefault();
      handlerRef.current(digit - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count, enabled]);
}

/** Classe utilitaire d'un bouton de réponse (état neutre / juste / faux). */
export function answerClass(state: "idle" | "good" | "bad" | "muted"): string {
  if (state === "good") return "border-success bg-success-soft text-ink scale-[1.02]";
  if (state === "bad") return "border-danger bg-danger-soft text-ink animate-shake";
  if (state === "muted") return "border-primary/10 bg-white/70 text-ink-faint opacity-60";
  return "border-primary/15 bg-white text-ink hover:border-primary hover:bg-primary-soft/60 active:scale-[0.98]";
}

/** Palette de secours pour les mini-jeux (aucun asset). */
export const KID_COLORS = ["#6C5CE7", "#FF5A5F", "#00B8A9", "#FDCB6E", "#E84393", "#0984E3"];
