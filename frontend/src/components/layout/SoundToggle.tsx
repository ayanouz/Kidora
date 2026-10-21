// ══════════════════════════════════════════════════════════════════
//  KIDORA — Interrupteur de sons (§33)
//  Disponible partout (barre de navigation). Passe aussi par le
//  SoundManager pour un retour immédiat.
// ══════════════════════════════════════════════════════════════════

import { useI18n } from "../../i18n";
import { SoundManager } from "../../games/engine/SoundManager";
import { usePrefsStore } from "../../store/prefs.store";
import { cn } from "../../utils/cn";

export function SoundToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const soundEnabled = usePrefsStore((s) => s.soundEnabled);
  const toggleSound = usePrefsStore((s) => s.toggleSound);

  const label = soundEnabled ? t("settings.soundOn") : t("settings.soundOff");

  const handleClick = () => {
    const next = !soundEnabled;
    SoundManager.unlock();
    SoundManager.setEnabled(next);
    toggleSound();
    if (next) SoundManager.play("click");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn("btn btn-ghost btn-icon text-xl", className)}
      aria-label={label}
      title={label}
      aria-pressed={soundEnabled}
    >
      <span aria-hidden="true">{soundEnabled ? "🔊" : "🔇"}</span>
    </button>
  );
}
