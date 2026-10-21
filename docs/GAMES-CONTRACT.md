# KIDORA — Contrat des jeux (frontend)

> Ce document est **normatif**. Tout jeu de `frontend/src/games/<dossier>/` doit s'y conformer.
> Référence implémentée : `frontend/src/games/memory/MemoryCards.tsx`.

## 1. Branchement

- Le registre `frontend/src/games/registry.ts` relie `games.engine` (BDD) → composant React.
- Chaque jeu exporte un composant nommé : `export function XxxYyy({ ctx }: GameProps)`.
- `GameProps` = `{ ctx: GameContext }` (défini dans `registry.ts`).
- La page de jeu rend : `<GameShell game={game}>{ctx => <Composant ctx={ctx} />}</GameShell>`.

## 2. Cycle de vie (GameShell)

- **Montage = début de partie.** Le shell remonte le jeu (`key`) à chaque run :
  initialiser tout l'état au montage, **pas** de bouton « démarrer » interne.
- `ctx.level` contient le niveau de départ (1, ou N si « Niveau suivant »).
- `ctx.running === false` ⇒ pause ou fin : geler les boucles `requestAnimationFrame`,
  ignorer les entrées. Reprendre proprement quand `running` redevient `true`.
- `ctx.pause()` / `ctx.resume()` : fournis par le shell ; le jeu n'appelle que `resume`
  s'il a lui-même besoin de reprendre (cas rare).
- **Fin de partie (une seule fois)** : `ctx.finish({ isWin?, levelReached?, clientMeta? })`.
  Le shell envoie le score au serveur et affiche l'écran de fin.
- Niveaux internes à une partie : `ctx.setLevel(n)` (le HUD se met à jour).
  Dernier niveau terminé → `ctx.finish(...)`.

## 3. Score & anti-triche (§44)

- Le jeu n'écrit jamais un score côté serveur : il met à jour le HUD via
  `ctx.addScore(points)` et `ctx.signalCorrect(points)` (qui ajoute les points, joue le son
  « correct », incrémente le combo et affiche « Super ! »).
- `ctx.signalWrong()` : son doux + combo remis à zéro + « Presque ! Essaie encore 😊 ».
- **Budget de points (règle absolue)** : le score cumulé d'une partie ne doit jamais
  dépasser `Math.floor(cap × 0.95)` où `cap = game.config.maxScore[difficulty] ?? game.maxScoreHint`.
  - Jeu à nombre d'actions fixe : `pointsParAction = floor(cap × 0.95 / actionsTotales)`.
  - Jeu arcade (actions libres) : budget alloué par action + **garde-fou** :
    suivre le total dans un `useRef` et ne jamais créditer au-delà de `floor(cap × 0.95)`.
- Score ≤ `maxScore` du serveur, temps écoulé ≥ `minDurationMs` ⇒ validation garantie.
- `clientMeta` : petites statistiques utiles (`{ mistakes, maxCombo, rounds }`) — jamais de score caché.

## 4. Sons (§33)

`ctx.sound.play(name)` avec : `click`, `flip`, `pop`, `correct`, `wrong`, `win`, `level`,
`bonus`, `tick`, `achievement`. Jamais de musique automatique.
Ne pas appeler `win`/`achievement` soi-même en fin de partie (le shell s'en charge).

## 5. i18n & assets

- **Interdiction d'ajouter des clés i18n.** Réutiliser : `useI18n()` + clés existantes
  (`common.*`, `feedback.*`, `hud.*`, `difficulty.*`) ou n'utiliser que des emojis/chiffres.
- Zéro asset binaire : emojis, CSS, SVG inline, canvas procédural. Zéro nouvelle dépendance.
- Textes visibles : FR par défaut via i18n uniquement ; pas de texte anglais en dur.

## 6. UX & accessibilité (§31/§32/§47)

- Zone de jeu : racine `className="flex flex-1 flex-col ..."` (le plateau fournit le cadre).
- Cibles tactiles ≥ 48 px ; `no-select` sur les zones tactiles ; `touch-none` sur les canvas qui captent le glissement.
- Clavier : tout jeu doit être jouable au clavier (flèches/Tab/Entrée/1-2-3…) ; `aria-label` sur les contrôles.
- Responsive 320 → 1920 px : pas de largeur fixe en px ; `max-w-*` + `w-full`.
- Couleurs : tokens Tailwind du projet (`primary`, `secondary`, `accent`, `success`, `danger`,
  `* -soft`, `ink`, `ink-soft`, `surface`, `page`). Classes : `card`, `chip`, `btn`, `game-board`.
- Animations courtes (≤ 500 ms) via les classes existantes (`animate-pop-in`, `animate-shake`…).

## 7. Canvas (jeux arcade)

```tsx
const { canvasRef, size } = useCanvas(1); // engine/hooks.ts — DPR + ResizeObserver
// boucle :
useEffect(() => {
  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = (now - last) / 1000; last = now;
    if (ctxRef.current.running) update(dt);
    draw();                       // toujours dessiner (pause = image figée)
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}, []);
```

- Coordonnées logiques : `size.width × size.height` ; le canvas est déjà mis à l'échelle DPR.
- Pointeur : `onPointerDown` sur le canvas + `getBoundingClientRect()` (ratio 1:1 logique).
- Nettoyer timeouts/RAF/écouteurs au démontage.

## 8. Mécaniques par jeu (BDD → `backend/prisma/seed.ts`)

| slug | moteur | fichier frontend | réglages |
|---|---|---|---|
| memory-animals | memory-cards | `memory/MemoryCards.tsx` ✅ | paires 4/8/12, niveaux 3 |
| magic-puzzle | puzzle | `puzzle/MagicPuzzle.tsx` | tailles 3/4/5, niveaux 3 |
| lost-maze | maze | `maze/LostMaze.tsx` | labyrinthe 11/15/21, niveaux 5 |
| color-match | color-match | `color-match/ColorMatch.tsx` | 12 manches, 3/4/6 choix |
| math-challenge | math-challenge | `math/MathChallenge.tsx` | 60 s, 3 vies |
| odd-one-out | odd-one-out | `odd-one-out/OddOneOut.tsx` | 15 manches, 4+ choix |
| logic-pattern | pattern | `pattern/LogicPattern.tsx` | 15 manches |
| bubble-pop | bubble-pop | `bubble-pop/BubblePop.tsx` | 60 s, spawn 900/650/450 ms |
| catch-the-stars | catch-the-stars | `catch-stars/CatchTheStars.tsx` | 60 s, spawn 800/600/420 ms |
| memory-sequence | memory-sequence | `memory-sequence/MemorySequence.tsx` | longueur 3/4/5, 12 manches |

Caps anti-triche (`config.maxScore`) et durées minimales : voir `seed.ts` — ne pas les modifier.

## 9. Checklist finale d'un jeu

- [ ] `tsc --noEmit` passerait (imports exacts, `strict`, pas de `any`, pas d'import inutilisé).
- [ ] Montage = run complet ; `finish` appelé exactement une fois par partie.
- [ ] Pause (Échap / onglet caché) gèle le jeu sans le casser.
- [ ] Rejouer → l'état se réinitialise (nouveau montage).
- [ ] Score perfectible ≤ 95 % du cap ; jamais de dépassement possible.
- [ ] Clavier + tactile ; ARIA minimal ; RTL non cassé (utiliser `ms/me`, `start/end`).
- [ ] Aucun fichier partagé modifié en dehors du dossier du jeu.
