// ══════════════════════════════════════════════════════════════════
//  KIDORA — Vignette de jeu (§47)
//  Emoji + dégradé de la couleur du jeu + formes décoratives :
//  une identité visuelle unique, zéro asset binaire.
// ══════════════════════════════════════════════════════════════════

import { cn } from "../../utils/cn";

interface GameThumbProps {
  emoji: string;
  color: string;
  className?: string;
  emojiClassName?: string;
}

export function GameThumb({ emoji, color, className, emojiClassName }: GameThumbProps) {
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}BB 100%)` }}
      aria-hidden="true"
    >
      <span className="absolute -start-6 -top-8 h-24 w-24 rounded-full bg-white/15" />
      <span className="absolute -bottom-10 -end-6 h-28 w-28 rounded-full bg-white/10" />
      <span className="absolute end-5 top-3 text-base text-white/40">✦</span>
      <span className="absolute start-8 bottom-3 text-xs text-white/30">✦</span>
      <span className={cn("relative text-5xl drop-shadow md:text-6xl", emojiClassName)}>
        {emoji}
      </span>
    </div>
  );
}
