// ══════════════════════════════════════════════════════════════════
//  KIDORA — Générateurs du moteur « quiz »
//  Chaque jeu du moteur quiz est une fabrique de questions.
//  Aucun texte d'interface : uniquement du contenu visuel (emojis,
//  chiffres, équations) ou le contenu éducatif du jeu.
// ══════════════════════════════════════════════════════════════════

import type { DifficultyKey } from "../../config";
import { pickMany, pickOne, randInt, shuffle } from "../shared/kit";

// ── Visuels rendus par QuizGame ──────────────────────────────────

export type QuizVisual =
  | { kind: "clock"; hour: number; minute: number }
  | { kind: "fraction"; filled: number; total: number }
  | { kind: "coins"; cents: number[] }
  | { kind: "balance"; known: number; total: number }
  | { kind: "shape"; sides: number };

export interface QuizQuestion {
  /** Texte principal (équation, lettre, mot, question…). */
  prompt: string;
  /** Précision courte affichée sous le prompt. */
  sub?: string;
  visual?: QuizVisual;
  options: string[];
  answer: string;
}

export type QuizGenerator = (difficulty: DifficultyKey) => QuizQuestion;

// ── Outils ───────────────────────────────────────────────────────

function numericOptions(answer: number, count: number, spread: number, min = 0): string[] {
  const values = new Set<number>([answer]);
  let guard = 0;
  while (values.size < count && guard++ < 100) {
    const delta = randInt(1, Math.max(2, Math.round(spread)));
    const candidate = answer + (Math.random() < 0.55 ? delta : -delta);
    if (candidate >= min && candidate !== answer) values.add(candidate);
  }
  let bump = 1;
  while (values.size < count) values.add(answer + bump++);
  return shuffle([...values]).map(String);
}

function textOptions(answer: string, pool: readonly string[], count: number): string[] {
  const wrong = pickMany(
    pool.filter((item) => item !== answer),
    count - 1,
  );
  return shuffle([answer, ...wrong]);
}

const euro = (cents: number): string =>
  `${(cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "")} €`;

const clampLevel = (difficulty: DifficultyKey): 0 | 1 | 2 =>
  difficulty === "easy" ? 0 : difficulty === "medium" ? 1 : 2;

// ── Maths ────────────────────────────────────────────────────────

const mathMissing: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const max = [9, 20, 60][tier];
  const a = randInt(1, max);
  const b = randInt(1, max);
  const total = a + b;
  const missing = randInt(0, 2);
  if (missing === 0) {
    return {
      prompt: `? + ${b} = ${total}`,
      options: numericOptions(a, 4, Math.max(3, Math.round(a * 0.5)), 0),
      answer: String(a),
    };
  }
  if (missing === 1) {
    return {
      prompt: `${a} + ? = ${total}`,
      options: numericOptions(b, 4, Math.max(3, Math.round(b * 0.5)), 0),
      answer: String(b),
    };
  }
  return {
    prompt: `${a} + ${b} = ?`,
    options: numericOptions(total, 4, Math.max(4, Math.round(total * 0.25)), 0),
    answer: String(total),
  };
};

const mathCompare: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const max = [10, 30, 100][tier];
  let left = randInt(1, max);
  let right = randInt(1, max);
  while (left === right) right = randInt(1, max);
  const answer = left > right ? ">" : "<";
  return {
    prompt: `${left} ? ${right}`,
    visual: undefined,
    options: shuffle([">", "<", "="]),
    answer,
  };
};

const mathTables: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const a = randInt(2, [5, 9, 12][tier]);
  const b = randInt(2, [5, 9, 12][tier]);
  const answer = a * b;
  return {
    prompt: `${a} × ${b} = ?`,
    options: numericOptions(answer, 4, Math.max(4, Math.round(answer * 0.2)), 1),
    answer: String(answer),
  };
};

const mathTrueFalse: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const op = pickOne(["+", "-", "×"] as const);
  const a = randInt(1, op === "×" ? 9 : [9, 15, 30][tier]);
  const b = randInt(op === "×" ? 2 : 1, op === "×" ? [5, 9, 12][tier] : [9, 15, 30][tier]);
  const left = op === "-" ? Math.max(a, b) : a;
  const right = op === "-" ? Math.min(a, b) : b;
  const result = op === "+" ? left + right : op === "-" ? left - right : left * right;
  const truth = Math.random() < 0.5;
  const delta = randInt(1, Math.max(2, Math.round(Math.abs(result) * 0.15)));
  const shown = truth ? result : result + (Math.random() < 0.5 ? delta : -delta);
  return {
    prompt: `${left} ${op} ${right} = ${shown}`,
    options: ["✅", "❌"],
    answer: truth ? "✅" : "❌",
  };
};

const quickerMath: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const max = [12, 25, 50][tier];
  const a = randInt(1, max);
  const b = randInt(1, max);
  const c = randInt(1, max);
  const d = randInt(1, max);
  const left = a + b;
  const right = c + d;
  const answer = left > right ? ">" : left < right ? "<" : "=";
  return {
    prompt: `${a} + ${b}  ?  ${c} + ${d}`,
    options: shuffle([">", "<", "="]),
    answer,
  };
};

const mathMoney: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const count = [2, 3, 4][tier];
  const values = [200, 100, 50, 20, 10, 5];
  const coins = Array.from({ length: count }, () => pickOne(values));
  const total = coins.reduce((sum, value) => sum + value, 0);
  const wrongs = new Set<string>();
  let guard = 0;
  while (wrongs.size < 3 && guard++ < 60) {
    const delta = pickOne([5, 10, 20, 50, 100]);
    const candidate = total + (Math.random() < 0.5 ? delta : -delta);
    if (candidate > 0 && candidate !== total) wrongs.add(euro(candidate));
  }
  return {
    prompt: "💰",
    visual: { kind: "coins", cents: coins },
    options: shuffle([euro(total), ...wrongs]),
    answer: euro(total),
  };
};

const clockReader: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const hour = randInt(1, 12);
  const minute = pickOne(tier === 0 ? [0, 30] : tier === 1 ? [0, 15, 30, 45] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  const total = hour * 60 + minute;
  const format = (mins: number) => {
    const h = Math.floor(mins / 60) % 12;
    const m = mins % 60;
    return `${h === 0 ? 12 : h}:${String(m).padStart(2, "0")}`;
  };
  const candidates = new Set<string>([format(total)]);
  [30, -30, 60, -60, 15, -15].forEach((delta) => {
    if (candidates.size < 4) {
      const shifted = total + delta;
      if (shifted >= 0 && shifted < 12 * 60) candidates.add(format(shifted));
    }
  });
  return {
    prompt: "🕐",
    visual: { kind: "clock", hour, minute },
    options: shuffle([...candidates]),
    answer: format(total),
  };
};

const fractionPizza: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const totals = tier === 0 ? [2, 3, 4] : tier === 1 ? [3, 4, 6, 8] : [4, 5, 6, 8, 10];
  const total = pickOne(totals);
  const filled = randInt(1, total - 1);
  const answer = `${filled}/${total}`;
  const wrongs = new Set<string>([
    `${Math.min(total, filled + 1)}/${total}`,
    `${filled}/${Math.max(2, total - 1)}`,
    `${Math.max(1, filled - 1)}/${total}`,
    `${total}/${filled}`,
  ]);
  wrongs.delete(answer);
  return {
    prompt: "🍕",
    visual: { kind: "fraction", filled, total },
    options: shuffle([answer, ...[...wrongs].slice(0, 3)]),
    answer,
  };
};

const geometryShapes: QuizGenerator = () => {
  const shapes = [
    { emoji: "🔺", sides: 3 },
    { emoji: "🟦", sides: 4 },
    { emoji: "⬟", sides: 5 },
    { emoji: "⬢", sides: 6 },
  ];
  const target = pickOne(shapes);
  return {
    prompt: "🔍",
    visual: { kind: "shape", sides: target.sides },
    options: shuffle(shapes.map((shape) => shape.emoji)),
    answer: target.emoji,
  };
};

const shapeSides: QuizGenerator = () => {
  const sides = randInt(3, 8);
  return {
    prompt: "🔷",
    visual: { kind: "shape", sides },
    options: numericOptions(sides, 4, 3, 2),
    answer: String(sides),
  };
};

const balanceScale: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const total = randInt(8, [12, 25, 50][tier]);
  const known = randInt(2, total - 2);
  const answer = total - known;
  return {
    prompt: `${known} + ? = ${total}`,
    visual: { kind: "balance", known, total },
    options: numericOptions(answer, 4, Math.max(3, Math.round(answer * 0.5)), 1),
    answer: String(answer),
  };
};

const countingObjects: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const count = randInt(tier === 0 ? 3 : 5, [8, 12, 18][tier]);
  const emoji = pickOne(["🍎", "⭐", "🎈", "🐟", "🍓", "🌸", "🍪", "🐞", "🧁", "🚗"]);
  return {
    prompt: emoji.repeat(count),
    options: numericOptions(count, 4, 3, 1),
    answer: String(count),
  };
};

const numberOrder: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const step = randInt(1, tier === 0 ? 2 : tier === 1 ? 5 : 9);
  const down = Math.random() < 0.35 && tier > 0;
  const start = down ? randInt(step * 3 + 2, step * 3 + 25) : randInt(1, 20);
  const seq = Array.from({ length: 4 }, (_, index) =>
    down ? start - step * index : start + step * index,
  );
  const missing = randInt(1, 3);
  const answer = seq[missing];
  const shown = seq.map((value, index) => (index === missing ? "?" : String(value))).join(", ");
  return {
    prompt: shown,
    options: numericOptions(answer, 4, Math.max(3, step), 0),
    answer: String(answer),
  };
};

// ── Langage & logique ────────────────────────────────────────────

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const alphabetNext: QuizGenerator = (difficulty) => {
  const tier = clampLevel(difficulty);
  const step = randInt(1, tier === 0 ? 2 : tier === 1 ? 3 : 4);
  const start = randInt(0, Math.max(0, LETTERS.length - (step * 3 + 2)));
  const seq = Array.from({ length: 4 }, (_, index) => LETTERS[start + index * step]);
  const answer = LETTERS[start + 3 * step];
  return {
    prompt: `${seq[0]}, ${seq[1]}, ${seq[2]}, ?`,
    options: textOptions(answer, LETTERS, 4),
    answer,
  };
};

const letterCase: QuizGenerator = () => {
  const letter = pickOne(LETTERS.slice(0, 20));
  const upper = Math.random() < 0.5;
  const answer = upper ? letter.toLowerCase() : letter;
  const wrongs = pickMany(
    LETTERS.slice(0, 20).filter((item) => item !== letter),
    3,
  ).map((item) => (upper ? item.toLowerCase() : item));
  return {
    prompt: upper ? letter : letter.toLowerCase(),
    options: shuffle([answer, ...wrongs]),
    answer,
  };
};

const WORDS = [
  { emoji: "🍎", word: "POMME" },
  { emoji: "🐱", word: "CHAT" },
  { emoji: "🌙", word: "LUNE" },
  { emoji: "🌻", word: "FLEUR" },
  { emoji: "🏠", word: "MAISON" },
  { emoji: "☀️", word: "SOLEIL" },
  { emoji: "🐟", word: "POISSON" },
  { emoji: "🍌", word: "BANANE" },
  { emoji: "🚗", word: "VOITURE" },
  { emoji: "🐘", word: "ELEPHANT" },
  { emoji: "🦋", word: "PAPILLON" },
  { emoji: "🍕", word: "PIZZA" },
  { emoji: "⚽", word: "BALLON" },
  { emoji: "🌳", word: "ARBRE" },
  { emoji: "🐕", word: "CHIEN" },
  { emoji: "🍇", word: "RAISIN" },
  { emoji: "🚲", word: "VELO" },
  { emoji: "🎸", word: "GUITARE" },
];

function misspell(word: string): string {
  const letters = word.split("");
  const mode = randInt(0, 2);
  if (mode === 0 && letters.length > 3) {
    const index = randInt(1, letters.length - 2);
    [letters[index], letters[index + 1]] = [letters[index + 1], letters[index]];
  } else if (mode === 1 && letters.length > 3) {
    letters.splice(randInt(1, letters.length - 2), 1);
  } else {
    letters.splice(randInt(1, letters.length - 1), 0, letters[randInt(0, letters.length - 1)]);
  }
  return letters.join("");
}

const spellingChoice: QuizGenerator = () => {
  const entry = pickOne(WORDS);
  const wrongs = new Set<string>();
  let guard = 0;
  while (wrongs.size < 3 && guard++ < 60) {
    const candidate = misspell(entry.word);
    if (candidate !== entry.word) wrongs.add(candidate);
  }
  return {
    prompt: entry.emoji,
    options: shuffle([entry.word, ...wrongs]),
    answer: entry.word,
  };
};

const wordPicture: QuizGenerator = () => {
  const entry = pickOne(WORDS);
  const others = pickMany(
    WORDS.filter((item) => item.word !== entry.word),
    3,
  );
  return {
    prompt: entry.word,
    options: shuffle([entry.emoji, ...others.map((item) => item.emoji)]),
    answer: entry.emoji,
  };
};

// ── Découverte du monde ──────────────────────────────────────────

interface Country {
  flag: string;
  country: string;
  capital: string;
}

const COUNTRIES: Country[] = [
  { flag: "🇫🇷", country: "France", capital: "Paris" },
  { flag: "🇩🇪", country: "Allemagne", capital: "Berlin" },
  { flag: "🇮🇹", country: "Italie", capital: "Rome" },
  { flag: "🇪🇸", country: "Espagne", capital: "Madrid" },
  { flag: "🇵🇹", country: "Portugal", capital: "Lisbonne" },
  { flag: "🇬🇧", country: "Royaume-Uni", capital: "Londres" },
  { flag: "🇺🇸", country: "États-Unis", capital: "Washington" },
  { flag: "🇨🇦", country: "Canada", capital: "Ottawa" },
  { flag: "🇧🇷", country: "Brésil", capital: "Brasilia" },
  { flag: "🇯🇵", country: "Japon", capital: "Tokyo" },
  { flag: "🇨🇳", country: "Chine", capital: "Pékin" },
  { flag: "🇮🇳", country: "Inde", capital: "New Delhi" },
  { flag: "🇦🇺", country: "Australie", capital: "Canberra" },
  { flag: "🇲🇦", country: "Maroc", capital: "Rabat" },
  { flag: "🇪🇬", country: "Égypte", capital: "Le Caire" },
  { flag: "🇹🇷", country: "Turquie", capital: "Ankara" },
  { flag: "🇬🇷", country: "Grèce", capital: "Athènes" },
  { flag: "🇸🇪", country: "Suède", capital: "Stockholm" },
  { flag: "🇳🇴", country: "Norvège", capital: "Oslo" },
  { flag: "🇲🇽", country: "Mexique", capital: "Mexico" },
];

const flagsQuiz: QuizGenerator = () => {
  const entry = pickOne(COUNTRIES);
  return {
    prompt: entry.flag,
    options: textOptions(
      entry.country,
      COUNTRIES.map((item) => item.country),
      4,
    ),
    answer: entry.country,
  };
};

const capitalsQuiz: QuizGenerator = () => {
  const entry = pickOne(COUNTRIES);
  return {
    prompt: `${entry.flag} ${entry.country}`,
    options: textOptions(
      entry.capital,
      COUNTRIES.map((item) => item.capital),
      4,
    ),
    answer: entry.capital,
  };
};

const PLANET_QUESTIONS: { prompt: string; answer: string; options: string[] }[] = [
  { prompt: "Quelle planète est la plus proche du Soleil ?", answer: "Mercure", options: ["Mercure", "Vénus", "Mars", "la Terre"] },
  { prompt: "Quelle est la planète rouge ?", answer: "Mars", options: ["Mars", "Jupiter", "Saturne", "Neptune"] },
  { prompt: "Quelle planète a de grands anneaux visibles ?", answer: "Saturne", options: ["Saturne", "Vénus", "Mercure", "la Terre"] },
  { prompt: "Sur quelle planète vivons-nous ?", answer: "la Terre", options: ["la Terre", "la Lune", "Mars", "Vénus"] },
  { prompt: "Combien de planètes compte le système solaire ?", answer: "8", options: ["8", "6", "10", "12"] },
  { prompt: "Quel astre brille dans notre ciel le jour ?", answer: "le Soleil", options: ["le Soleil", "la Lune", "Mars", "une comète"] },
  { prompt: "Quel astre tourne autour de la Terre ?", answer: "la Lune", options: ["la Lune", "le Soleil", "Saturne", "Jupiter"] },
  { prompt: "Quelle planète est la plus grande ?", answer: "Jupiter", options: ["Jupiter", "la Terre", "Mars", "Mercure"] },
  { prompt: "Quelle planète est la plus éloignée du Soleil ?", answer: "Neptune", options: ["Neptune", "Saturne", "Jupiter", "Uranus"] },
  { prompt: "Quelle planète est connue pour sa Grande Tache rouge ?", answer: "Jupiter", options: ["Jupiter", "Mars", "Vénus", "Neptune"] },
];

const planetsQuiz: QuizGenerator = () => {
  const entry = pickOne(PLANET_QUESTIONS);
  return {
    prompt: entry.prompt,
    options: shuffle(entry.options),
    answer: entry.answer,
  };
};

const HABITATS = {
  ocean: "🌊🐠",
  savane: "🌳🦒",
  desert: "🏜️🐪",
  banquise: "❄️🐧",
  ferme: "🏡🐄",
  foret: "🌲🦊",
  jungle: "🌴🐒",
} as const;

const ANIMALS: { emoji: string; habitat: keyof typeof HABITATS }[] = [
  { emoji: "🐋", habitat: "ocean" },
  { emoji: "🐙", habitat: "ocean" },
  { emoji: "🦈", habitat: "ocean" },
  { emoji: "🦁", habitat: "savane" },
  { emoji: "🦒", habitat: "savane" },
  { emoji: "🦓", habitat: "savane" },
  { emoji: "🐪", habitat: "desert" },
  { emoji: "🦂", habitat: "desert" },
  { emoji: "🐧", habitat: "banquise" },
  { emoji: "🐻‍❄️", habitat: "banquise" },
  { emoji: "🐄", habitat: "ferme" },
  { emoji: "🐓", habitat: "ferme" },
  { emoji: "🦊", habitat: "foret" },
  { emoji: "🦌", habitat: "foret" },
  { emoji: "🐒", habitat: "jungle" },
  { emoji: "🦜", habitat: "jungle" },
];

const animalHabitat: QuizGenerator = () => {
  const entry = pickOne(ANIMALS);
  const answer = HABITATS[entry.habitat];
  const all = Object.values(HABITATS);
  return {
    prompt: entry.emoji,
    options: shuffle([answer, ...pickMany(all.filter((item) => item !== answer), 3)]),
    answer,
  };
};

const SENSES = ["👁️", "👂", "👃", "👅", "✋"] as const;

const SENSE_ITEMS: { emoji: string; sense: (typeof SENSES)[number] }[] = [
  { emoji: "🌈", sense: "👁️" },
  { emoji: "🎵", sense: "👂" },
  { emoji: "🌹", sense: "👃" },
  { emoji: "🍋", sense: "👅" },
  { emoji: "🧸", sense: "✋" },
  { emoji: "🎨", sense: "👁️" },
  { emoji: "🥁", sense: "👂" },
  { emoji: "🧄", sense: "👃" },
  { emoji: "🍯", sense: "👅" },
  { emoji: "🧊", sense: "✋" },
  { emoji: "⭐", sense: "👁️" },
  { emoji: "🔔", sense: "👂" },
  { emoji: "🍕", sense: "👃" },
  { emoji: "🍫", sense: "👅" },
  { emoji: "🪶", sense: "✋" },
];

const fiveSenses: QuizGenerator = () => {
  const entry = pickOne(SENSE_ITEMS);
  return {
    prompt: entry.emoji,
    options: shuffle([...SENSES]),
    answer: entry.sense,
  };
};

const BINS = {
  papier: "🟦📰",
  plastique: "🟨🥤",
  verre: "🟩🍾",
  organique: "🟫🍌",
} as const;

const TRASH: { emoji: string; bin: keyof typeof BINS }[] = [
  { emoji: "📰", bin: "papier" },
  { emoji: "📦", bin: "papier" },
  { emoji: "📚", bin: "papier" },
  { emoji: "🥤", bin: "plastique" },
  { emoji: "🧴", bin: "plastique" },
  { emoji: "🛍️", bin: "plastique" },
  { emoji: "🍾", bin: "verre" },
  { emoji: "🥛", bin: "verre" },
  { emoji: "🍌", bin: "organique" },
  { emoji: "🍎", bin: "organique" },
  { emoji: "🥚", bin: "organique" },
];

const recyclingQuiz: QuizGenerator = () => {
  const entry = pickOne(TRASH);
  const answer = BINS[entry.bin];
  const all = Object.values(BINS);
  return {
    prompt: entry.emoji,
    options: shuffle([answer, ...pickMany(all.filter((item) => item !== answer), 3)]),
    answer,
  };
};

// ── Table des jeux ───────────────────────────────────────────────

export const QUIZ_GENERATORS: Record<string, QuizGenerator> = {
  "math-missing": mathMissing,
  "math-compare": mathCompare,
  "math-tables": mathTables,
  "math-truefalse": mathTrueFalse,
  "math-money": mathMoney,
  "clock-reader": clockReader,
  "fraction-pizza": fractionPizza,
  "geometry-shapes": geometryShapes,
  "shape-sides": shapeSides,
  "balance-scale": balanceScale,
  "counting-objects": countingObjects,
  "number-order": numberOrder,
  "quicker-math": quickerMath,
  "alphabet-next": alphabetNext,
  "letter-case": letterCase,
  "spelling-choice": spellingChoice,
  "word-picture": wordPicture,
  "flags-quiz": flagsQuiz,
  "capitals-quiz": capitalsQuiz,
  "planets-quiz": planetsQuiz,
  "animal-habitat": animalHabitat,
  "five-senses": fiveSenses,
  "recycling-quiz": recyclingQuiz,
};
