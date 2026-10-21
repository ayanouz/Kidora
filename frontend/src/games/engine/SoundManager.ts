// ══════════════════════════════════════════════════════════════════
//  KIDORA — SoundManager (§33)
//  Sons synthétisés avec la Web Audio API : zéro fichier audio,
//  zéro requête réseau, démarrage instantané.
//  Jamais de musique automatique — uniquement du feedback d'action.
// ══════════════════════════════════════════════════════════════════

import type { SoundName } from "./types";

interface Note {
  freq: number;
  duration: number;
  type: OscillatorType;
  delay?: number;
  gain?: number;
}

const RECIPES: Record<SoundName, Note[]> = {
  click: [{ freq: 880, duration: 0.05, type: "square", gain: 0.12 }],
  flip: [{ freq: 520, duration: 0.06, type: "triangle", gain: 0.14 }],
  pop: [{ freq: 420, duration: 0.09, type: "sine", gain: 0.2 }],
  correct: [
    { freq: 660, duration: 0.1, type: "triangle" },
    { freq: 990, duration: 0.14, type: "triangle", delay: 0.09, gain: 0.18 },
  ],
  wrong: [
    { freq: 240, duration: 0.12, type: "sawtooth", gain: 0.09 },
    { freq: 190, duration: 0.16, type: "sawtooth", delay: 0.1, gain: 0.09 },
  ],
  win: [
    { freq: 523, duration: 0.14, type: "triangle" },
    { freq: 659, duration: 0.14, type: "triangle", delay: 0.12 },
    { freq: 784, duration: 0.14, type: "triangle", delay: 0.24 },
    { freq: 1047, duration: 0.3, type: "triangle", delay: 0.36, gain: 0.22 },
  ],
  level: [
    { freq: 587, duration: 0.1, type: "square", gain: 0.1 },
    { freq: 784, duration: 0.1, type: "square", delay: 0.09, gain: 0.1 },
    { freq: 1175, duration: 0.22, type: "square", delay: 0.18, gain: 0.12 },
  ],
  achievement: [
    { freq: 784, duration: 0.12, type: "triangle" },
    { freq: 988, duration: 0.12, type: "triangle", delay: 0.1 },
    { freq: 1175, duration: 0.12, type: "triangle", delay: 0.2 },
    { freq: 1568, duration: 0.28, type: "triangle", delay: 0.3, gain: 0.2 },
  ],
  bonus: [
    { freq: 1318, duration: 0.07, type: "square", gain: 0.12 },
    { freq: 1760, duration: 0.1, type: "square", delay: 0.06, gain: 0.12 },
  ],
  tick: [{ freq: 1000, duration: 0.03, type: "square", gain: 0.06 }],
};

/** Gestionnaire audio singleton — créé au premier geste utilisateur. */
class SoundManagerClass {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;

  /** À appeler après un premier clic/tap (contrainte navigateurs). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.28;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    const recipe = RECIPES[name];
    if (!recipe) return;

    for (const note of recipe) {
      const start = this.ctx.currentTime + (note.delay ?? 0);
      const oscillator = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.freq, start);
      const peak = note.gain ?? 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.05);
    }
  }
}

export const SoundManager = new SoundManagerClass();
