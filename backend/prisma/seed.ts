// ══════════════════════════════════════════════════════════════════
//  KIDORA — Seed de la base de données
//
//  Crée : catégories, 62 jeux, achievements, plans, comptes de démo
//  (admin, parent avec 2 enfants, profils leaderboard) + données
//  de démonstration (sessions, scores, progression).
//
//  Usage :  npm run seed
//  Idempotent : peut être relancé sans dupliquer les données de base.
// ══════════════════════════════════════════════════════════════════

import { PrismaClient, Role, AgeTier, Difficulty, SessionStatus, BillingInterval, BillingProvider, SubscriptionStatus, PaymentStatus } from "@prisma/client";
import "../src/load-env";
import bcrypt from "bcryptjs";
import { computeSessionXp, levelFromXp, starsFromScore } from "../src/lib/xp";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────
//  CATÉGORIES (§7)
// ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { slug: "puzzles",      name: "Puzzles",        emoji: "🧩", color: "#6C5CE7", sortOrder: 1 },
  { slug: "intelligence", name: "Intelligence",   emoji: "🧠", color: "#8E44AD", sortOrder: 2 },
  { slug: "maths",        name: "Maths",          emoji: "🔢", color: "#0984E3", sortOrder: 3 },
  { slug: "memoire",      name: "Mémoire",        emoji: "💭", color: "#E84393", sortOrder: 4 },
  { slug: "arcade",       name: "Arcade",         emoji: "🎯", color: "#FF5A5F", sortOrder: 5 },
  { slug: "observation",  name: "Observation",    emoji: "🔍", color: "#00B8A9", sortOrder: 6 },
  { slug: "labyrinthes",  name: "Labyrinthes",    emoji: "🌀", color: "#F39C12", sortOrder: 7 },
  { slug: "creativite",   name: "Créativité",     emoji: "🎨", color: "#E67E22", sortOrder: 8 },
  { slug: "rapidite",     name: "Rapidité",       emoji: "⚡", color: "#D63031", sortOrder: 9 },
];

// ─────────────────────────────────────────────────────────────────
//  PLANS PREMIUM
//  Les prix sont affichés côté client et repris tels quels en mode
//  démo. En production, les Price IDs Stripe viennent de l'env.
// ─────────────────────────────────────────────────────────────────

const PLANS = [
  {
    slug: "monthly",
    name: "Premium Mensuel",
    tagline: "Pour découvrir l'aventure",
    description:
      "Tous les jeux Premium, sans engagement, au mois. Parfait pour tester la formule en famille.",
    priceCents: 699,
    currency: "EUR",
    interval: BillingInterval.MONTH,
    trialDays: 7,
    features: [
      "Accès aux 19 jeux Premium",
      "Tous les jeux classiques inclus",
      "Sans publicité, sans achats intégrés",
      "Annulable à tout moment",
    ],
    isPopular: false,
    sortOrder: 1,
  },
  {
    slug: "yearly",
    name: "Premium Annuel",
    tagline: "Le choix malin des familles",
    description:
      "Deux mois offerts par rapport au mensuel, avec l'accès complet à tout le catalogue Kidora.",
    priceCents: 4990,
    currency: "EUR",
    interval: BillingInterval.YEAR,
    trialDays: 7,
    features: [
      "Tout le Premium inclus",
      "2 mois offerts vs mensuel",
      "Nouveaux jeux chaque mois",
      "Sans publicité, annulable à tout moment",
    ],
    isPopular: true,
    sortOrder: 2,
  },
  {
    slug: "family",
    name: "Famille+",
    tagline: "Toute la tribu, un seul abonnement",
    description:
      "Jusqu'à 6 profils enfants, des rapports parents détaillés et tout le catalogue Premium.",
    priceCents: 7990,
    currency: "EUR",
    interval: BillingInterval.YEAR,
    trialDays: 7,
    features: [
      "Tout le Premium inclus",
      "Jusqu'à 6 profils enfants",
      "Rapports parents détaillés",
      "Sans publicité, annulable à tout moment",
    ],
    isPopular: false,
    sortOrder: 3,
  },
];

// ─────────────────────────────────────────────────────────────────
//  11 JEUX RÉELS (§9→§18)
//  config.minDurationMs et config.maxScore = bornes anti-cheat.
// ─────────────────────────────────────────────────────────────────

const BASE_GAMES = [
  {
    slug: "memory-animals",
    title: "Memory des Animaux",
    description:
      "Retourne les cartes et retrouve toutes les paires d'animaux ! Plus tu vas vite, plus tu gagnes de points.",
    engine: "memory-cards",
    categorySlug: "memoire",
    minAge: 4,
    difficulty: Difficulty.EASY,
    emoji: "🐼",
    color: "#E84393",
    maxScoreHint: 6000,
    config: {
      levels: 3,
      settings: { pairs: { easy: 4, medium: 8, hard: 12 } },
      minDurationMs: { easy: 12000, medium: 25000, hard: 40000 },
      maxScore: { easy: 2000, medium: 4000, hard: 6000 },
    },
  },
  {
    slug: "magic-puzzle",
    title: "Puzzle Magique",
    description:
      "Fais glisser les pièces pour reconstituer le dessin magique. Un vrai puzzle à reconstruire !",
    engine: "puzzle",
    categorySlug: "puzzles",
    minAge: 5,
    difficulty: Difficulty.EASY,
    emoji: "🧩",
    color: "#6C5CE7",
    maxScoreHint: 5000,
    config: {
      levels: 3,
      settings: { sizes: { easy: 3, medium: 4, hard: 5 } },
      minDurationMs: { easy: 15000, medium: 30000, hard: 50000 },
      maxScore: { easy: 1500, medium: 3000, hard: 5000 },
    },
  },
  {
    slug: "lost-maze",
    title: "Le Labyrinthe Perdu",
    description:
      "Trouve la sortie du labyrinthe ! Utilise les flèches ou le bouton directionnel sur tablette.",
    engine: "maze",
    categorySlug: "labyrinthes",
    minAge: 6,
    difficulty: Difficulty.EASY,
    emoji: "🌀",
    color: "#F39C12",
    maxScoreHint: 4000,
    config: {
      levels: 5,
      settings: { sizes: { easy: 11, medium: 15, hard: 21 } },
      minDurationMs: { easy: 8000, medium: 12000, hard: 18000 },
      maxScore: { easy: 1200, medium: 2500, hard: 4000 },
    },
  },
  {
    slug: "color-match",
    title: "Attrape les Couleurs",
    description:
      "Trouve la bonne couleur ou le bon objet le plus vite possible. Attention aux pièges !",
    engine: "color-match",
    categorySlug: "creativite",
    minAge: 3,
    difficulty: Difficulty.EASY,
    emoji: "🎨",
    color: "#E67E22",
    maxScoreHint: 5000,
    config: {
      levels: 3,
      settings: { rounds: 12, choices: { easy: 3, medium: 4, hard: 6 } },
      minDurationMs: { easy: 10000, medium: 12000, hard: 15000 },
      maxScore: { easy: 2000, medium: 3500, hard: 5000 },
    },
  },
  {
    slug: "math-challenge",
    title: "Défi Maths",
    description:
      "Résous un maximum de calculs avant la fin du temps ! Les opérations s'adaptent à ton âge.",
    engine: "math-challenge",
    categorySlug: "maths",
    minAge: 6,
    difficulty: Difficulty.MEDIUM,
    emoji: "🔢",
    color: "#0984E3",
    maxScoreHint: 8000,
    config: {
      levels: 3,
      settings: { durationSec: 60, lives: 3, opsByTier: true },
      minDurationMs: { easy: 30000, medium: 45000, hard: 55000 },
      maxScore: { easy: 3000, medium: 5000, hard: 8000 },
    },
  },
  {
    slug: "odd-one-out",
    title: "Cherche l'Intrus",
    description:
      "Un seul élément est différent des autres. Sauras-tu le repérer ? La difficulté augmente à chaque manche !",
    engine: "odd-one-out",
    categorySlug: "observation",
    minAge: 4,
    difficulty: Difficulty.EASY,
    emoji: "🔍",
    color: "#00B8A9",
    maxScoreHint: 5000,
    config: {
      levels: 3,
      settings: { rounds: 15, startChoices: 4 },
      minDurationMs: { easy: 8000, medium: 10000, hard: 12000 },
      maxScore: { easy: 2000, medium: 3500, hard: 5000 },
    },
  },
  {
    slug: "logic-pattern",
    title: "La Suite Logique",
    description:
      "Observe la suite de formes et devine ce qui vient après. Un vrai jeu de logique !",
    engine: "pattern",
    categorySlug: "intelligence",
    minAge: 5,
    difficulty: Difficulty.EASY,
    emoji: "🧠",
    color: "#8E44AD",
    maxScoreHint: 5000,
    config: {
      levels: 3,
      settings: { rounds: 15, sequenceStartLength: 3 },
      minDurationMs: { easy: 8000, medium: 10000, hard: 12000 },
      maxScore: { easy: 2000, medium: 3500, hard: 5000 },
    },
  },
  {
    slug: "bubble-pop",
    title: "Bubble Pop",
    description:
      "Éclate un maximum de bulles avant qu'elles ne s'échappent ! Combo et bonus garantis.",
    engine: "bubble-pop",
    categorySlug: "arcade",
    minAge: 5,
    difficulty: Difficulty.MEDIUM,
    emoji: "🫧",
    color: "#FF5A5F",
    maxScoreHint: 12000,
    config: {
      levels: 3,
      settings: { durationSec: 60, spawnRateMs: { easy: 900, medium: 650, hard: 450 } },
      minDurationMs: { easy: 30000, medium: 45000, hard: 55000 },
      maxScore: { easy: 6000, medium: 9000, hard: 12000 },
    },
  },
  {
    slug: "catch-the-stars",
    title: "Attrape les Étoiles",
    description:
      "Les étoiles filent dans le ciel : attrape-les toutes ! Étoile dorée = gros bonus ⭐",
    engine: "catch-the-stars",
    categorySlug: "rapidite",
    minAge: 4,
    difficulty: Difficulty.MEDIUM,
    emoji: "⭐",
    color: "#D63031",
    maxScoreHint: 11000,
    config: {
      levels: 3,
      settings: { durationSec: 60, spawnRateMs: { easy: 800, medium: 600, hard: 420 } },
      minDurationMs: { easy: 30000, medium: 45000, hard: 55000 },
      maxScore: { easy: 5000, medium: 8000, hard: 11000 },
    },
  },
  {
    slug: "memory-sequence",
    title: "Séquence Mémoire",
    description:
      "Regarde bien la séquence de couleurs… puis reproduis-la de mémoire. Ça devient chaud !",
    engine: "memory-sequence",
    categorySlug: "memoire",
    minAge: 4,
    difficulty: Difficulty.EASY,
    emoji: "🎵",
    color: "#E84393",
    maxScoreHint: 8000,
    config: {
      levels: 3,
      settings: { startLength: { easy: 3, medium: 4, hard: 5 }, maxRounds: 12 },
      minDurationMs: { easy: 15000, medium: 25000, hard: 35000 },
      maxScore: { easy: 3000, medium: 5000, hard: 8000 },
    },
  },
  {
    slug: "arkadas",
    title: "Arkadaş",
    description:
      "Crée ton copain rigolo — tête, cheveux, yeux, nez, bouche — puis tape-le avec le bon outil pendant 3 manches : gifle, pince ou caresse ! Plus tu suis la consigne, plus tu marques de points.",
    engine: "arkadas",
    categorySlug: "arcade",
    minAge: 5,
    difficulty: Difficulty.MEDIUM,
    emoji: "🖐️",
    color: "#16A085",
    maxScoreHint: 9000,
    config: {
      levels: 3,
      settings: { roundSec: { easy: 16, medium: 18, hard: 20 } },
      minDurationMs: { easy: 15000, medium: 20000, hard: 25000 },
      maxScore: { easy: 4500, medium: 6500, hard: 9000 },
    },
  },
];

// ─────────────────────────────────────────────────────────────────
//  EXTENSION 2026 — 51 JEUX SUPPLÉMENTAIRES
//  17 moteurs partagés, 1 à 23 jeux par moteur. `premium` = réservé
//  aux abonnés ; les bornes anti-cheat sont propres à chaque jeu.
// ─────────────────────────────────────────────────────────────────

type Tier3 = [number, number, number];

const QUIZ_ROUNDS = { rounds: { easy: 10, medium: 12, hard: 14 } };

function ng(
  slug: string,
  title: string,
  description: string,
  engine: string,
  categorySlug: string,
  minAge: number,
  difficulty: Difficulty,
  emoji: string,
  color: string,
  caps: Tier3,
  mins: Tier3,
  premium = false,
  settings: Record<string, unknown> = {},
) {
  return {
    slug,
    title,
    description,
    engine,
    categorySlug,
    minAge,
    difficulty,
    emoji,
    color,
    maxScoreHint: caps[2],
    premium,
    config: {
      levels: 1,
      settings,
      minDurationMs: { easy: mins[0], medium: mins[1], hard: mins[2] },
      maxScore: { easy: caps[0], medium: caps[1], hard: caps[2] },
    },
  };
}

const NEW_GAMES = [
  // ── Quiz : maths (13) ─────────────────────────────────────────
  ng("math-missing", "Trouve le Nombre Manquant", "Une opération, une case vide : retrouve le nombre qui manque et gagne des étoiles !", "quiz", "maths", 5, Difficulty.EASY, "🔢", "#0984E3", [2500, 4000, 6000], [8000, 9000, 10000], false, QUIZ_ROUNDS),
  ng("math-compare", "Plus ou Moins", "Compare deux nombres et choisis le bon signe : plus grand, plus petit ou égal.", "quiz", "maths", 5, Difficulty.EASY, "⚖️", "#0984E3", [2000, 3000, 4500], [7000, 8000, 9000], false, QUIZ_ROUNDS),
  ng("math-tables", "Tables de Multiplication", "Révise tes tables de 2 à 12 avec des défis éclair. Deviens un champion du calcul !", "quiz", "maths", 7, Difficulty.MEDIUM, "✖️", "#0984E3", [3000, 5000, 7000], [9000, 10000, 12000], true, QUIZ_ROUNDS),
  ng("math-truefalse", "Vrai ou Faux Maths", "Vérifie les calculs en un éclair : vrai ou faux ? Un jeu rapide pour muscler ton cerveau.", "quiz", "maths", 6, Difficulty.EASY, "✅", "#0984E3", [2500, 4000, 5500], [8000, 9000, 10000], false, QUIZ_ROUNDS),
  ng("math-money", "La Petite Caisse", "Compte les pièces et trouve le prix exact de tes achats. La monnaie n'aura plus de secret !", "quiz", "maths", 6, Difficulty.MEDIUM, "🪙", "#0984E3", [2500, 4000, 5500], [9000, 10000, 11000], false, QUIZ_ROUNDS),
  ng("clock-reader", "Quelle Heure Est-il ?", "Lis l'heure sur l'horloge et choisis la bonne réponse. Matin, midi ou soir ?", "quiz", "maths", 5, Difficulty.EASY, "🕐", "#0984E3", [2500, 4000, 5500], [8000, 9000, 10000], false, QUIZ_ROUNDS),
  ng("fraction-pizza", "Pizza Party", "Quelle part de pizza est coloriée ? Découvre les fractions en t'amusant, une part à la fois.", "quiz", "maths", 7, Difficulty.MEDIUM, "🍕", "#0984E3", [3000, 4500, 6000], [9000, 10000, 11000], true, QUIZ_ROUNDS),
  ng("geometry-shapes", "Chasse aux Formes", "Trouve la forme identique parmi les triangles, carrés, pentagones et autres polygones.", "quiz", "maths", 4, Difficulty.EASY, "🔷", "#0984E3", [2000, 3000, 4500], [7000, 8000, 9000], false, QUIZ_ROUNDS),
  ng("shape-sides", "Compte les Côtés", "Observe la forme et compte ses côtés. Un défi de géométrie tout en couleurs !", "quiz", "maths", 4, Difficulty.EASY, "📐", "#0984E3", [2000, 3000, 4500], [7000, 8000, 9000], false, QUIZ_ROUNDS),
  ng("balance-scale", "La Balance Magique", "Équilibre la balance en trouvant le poids mystère. À toi de jouer avec les nombres !", "quiz", "maths", 7, Difficulty.MEDIUM, "🧮", "#0984E3", [3000, 4500, 6000], [9000, 10000, 11000], true, QUIZ_ROUNDS),
  ng("counting-objects", "Compte avec Moi", "Compte les objets et choisis le bon nombre. Facile au début, puis ça accélère !", "quiz", "maths", 3, Difficulty.EASY, "🍎", "#0984E3", [1500, 2500, 4000], [6000, 7000, 8000], false, QUIZ_ROUNDS),
  ng("number-order", "La Bonne Suite", "Trouve le nombre qui continue la suite logique. Monte, descends, saute… à toi de voir !", "quiz", "maths", 6, Difficulty.MEDIUM, "🧩", "#0984E3", [2500, 4000, 5500], [8000, 9000, 10000], false, QUIZ_ROUNDS),
  ng("quicker-math", "Calcul Éclair", "Compare deux calculs en un éclair et choisis le bon signe. Idéal pour les pros du calcul mental !", "quiz", "maths", 8, Difficulty.HARD, "🧠", "#0984E3", [3500, 5500, 7500], [9000, 10000, 11000], true, QUIZ_ROUNDS),

  // ── Quiz : langage & découverte (10) ──────────────────────────
  ng("alphabet-next", "L'Alphabet Magique", "Quelle lettre vient ensuite ? Suis l'alphabet et perce ses petits mystères.", "quiz", "intelligence", 4, Difficulty.EASY, "🔤", "#8E44AD", [2000, 3000, 4500], [7000, 8000, 9000], false, QUIZ_ROUNDS),
  ng("letter-case", "Majuscule ou Minuscule", "Associe chaque majuscule à sa minuscule. Une aventure au pays des lettres !", "quiz", "intelligence", 4, Difficulty.EASY, "🔠", "#8E44AD", [2000, 3000, 4000], [6000, 7000, 8000], false, QUIZ_ROUNDS),
  ng("spelling-choice", "Le Mot Mystère", "Retrouve l'orthographe correcte du mot illustré parmi les propositions.", "quiz", "intelligence", 6, Difficulty.MEDIUM, "📝", "#8E44AD", [2500, 4000, 5500], [8000, 9000, 10000], true, QUIZ_ROUNDS),
  ng("word-picture", "Mot et Image", "Associe chaque mot à la bonne image. Un jeu tout doux pour enrichir ton vocabulaire.", "quiz", "intelligence", 4, Difficulty.EASY, "🖼️", "#8E44AD", [2000, 3000, 4500], [7000, 8000, 9000], false, QUIZ_ROUNDS),
  ng("flags-quiz", "Drapeaux du Monde", "Reconnais les drapeaux et découvre les pays du monde. Prêt pour le tour du monde ?", "quiz", "intelligence", 6, Difficulty.MEDIUM, "🌍", "#8E44AD", [3000, 4500, 6000], [8000, 9000, 10000], true, QUIZ_ROUNDS),
  ng("capitals-quiz", "Capitales du Monde", "Sauras-tu retrouver la capitale de chaque pays ? Les grands voyageurs vont adorer !", "quiz", "intelligence", 8, Difficulty.HARD, "🗺️", "#8E44AD", [3500, 5000, 7000], [9000, 10000, 11000], true, QUIZ_ROUNDS),
  ng("planets-quiz", "Voyage dans l'Espace", "Explore le système solaire et réponds aux questions des planètes. Décollage immédiat !", "quiz", "intelligence", 6, Difficulty.MEDIUM, "🪐", "#8E44AD", [3000, 4500, 6000], [8000, 9000, 10000], true, QUIZ_ROUNDS),
  ng("animal-habitat", "Où Vit l'Animal ?", "Aide chaque animal à retrouver son habitat naturel : océan, savane, banquise ou forêt.", "quiz", "intelligence", 4, Difficulty.EASY, "🏡", "#8E44AD", [2000, 3000, 4500], [7000, 8000, 9000], false, QUIZ_ROUNDS),
  ng("five-senses", "Les 5 Sens", "Quel sens utilises-tu pour chaque objet ? Découvre la vue, l'ouïe, l'odorat, le goût et le toucher.", "quiz", "intelligence", 4, Difficulty.EASY, "👀", "#8E44AD", [2000, 3000, 4000], [7000, 8000, 9000], false, QUIZ_ROUNDS),
  ng("recycling-quiz", "Le Tri des Déchets", "Apprends à trier les déchets dans la bonne poubelle. Un petit geste pour la planète !", "quiz", "intelligence", 5, Difficulty.EASY, "♻️", "#00B8A9", [2000, 3000, 4500], [7000, 8000, 9000], false, QUIZ_ROUNDS),

  // ── Arcade (13) ───────────────────────────────────────────────
  ng("whack-a-mole", "Tape les Taupes", "Les taupes sortent de leurs trous : tape-les vite avant qu'elles ne se cachent !", "arcade", "arcade", 4, Difficulty.EASY, "🐹", "#FF5A5F", [5000, 7000, 9000], [5000, 5000, 5000]),
  ng("fruit-slice", "Fruit Tranche", "Tranche les fruits qui tombent, mais évite les bombes ! Un jeu de rapidité juteux.", "arcade", "arcade", 5, Difficulty.MEDIUM, "🍉", "#FF5A5F", [6000, 8000, 10000], [5000, 5000, 5000], true),
  ng("flappy-balloon", "Ballon Volant", "Fais voler ton ballon entre les tuyaux sans le crever. Un petit coup de pouce suffit !", "arcade", "arcade", 5, Difficulty.EASY, "🎈", "#FF5A5F", [4000, 6000, 8000], [5000, 5000, 5000]),
  ng("snake", "Serpent Gourmand", "Guide le serpent, mange les pommes et deviens le plus long du jardin !", "arcade", "arcade", 5, Difficulty.EASY, "🐍", "#FF5A5F", [4000, 6000, 8000], [5000, 5000, 5000]),
  ng("breakout", "Casse-Briques", "Fais rebondir la balle et casse toutes les briques. Attention à ne pas la perdre !", "arcade", "arcade", 6, Difficulty.MEDIUM, "🧱", "#FF5A5F", [6000, 8000, 10000], [5000, 5000, 5000], true),
  ng("stack-tower", "Tour Magique", "Empile les blocs le plus haut possible sans les faire tomber. Jusqu'où iras-tu ?", "arcade", "arcade", 4, Difficulty.EASY, "🏗️", "#FF5A5F", [4000, 6000, 8000], [5000, 5000, 5000]),
  ng("dino-runner", "Course Préhistorique", "Aide le petit dinosaure à courir et sauter par-dessus les obstacles du désert.", "arcade", "arcade", 5, Difficulty.MEDIUM, "🦕", "#FF5A5F", [6000, 8000, 10000], [5000, 5000, 5000], true),
  ng("space-shooter", "Défense Spatiale", "Défends la galaxie contre les envahisseurs de l'espace. Le cosmos compte sur toi !", "arcade", "arcade", 7, Difficulty.HARD, "🚀", "#FF5A5F", [7000, 9000, 11000], [5000, 5000, 5000], true),
  ng("pong", "Ping-Pong", "Renvoie la balle et marque des points contre l'ordinateur. Un grand classique !", "arcade", "arcade", 5, Difficulty.EASY, "🏓", "#FF5A5F", [5000, 7000, 9000], [5000, 5000, 5000]),
  ng("piano-tiles", "Piano Magique", "Tape les touches au bon moment pour jouer un air magique. À toi la mélodie !", "arcade", "arcade", 5, Difficulty.MEDIUM, "🎹", "#FF5A5F", [6000, 8000, 10000], [5000, 5000, 5000], true),
  ng("drum-beat", "Rythme Endiablé", "Tape en rythme et deviens le roi du tambour ! Plus tu es précis, plus tu marques.", "arcade", "arcade", 4, Difficulty.EASY, "🥁", "#FF5A5F", [4000, 6000, 8000], [5000, 5000, 5000]),
  ng("reaction-time", "Réflexe Éclair", "Attends que le feu passe au vert, puis tape le plus vite possible. 5 manches pour te dépasser !", "arcade", "rapidite", 5, Difficulty.EASY, "⚡", "#D63031", [3000, 4500, 6000], [5000, 5000, 5000]),
  ng("fruit-catcher", "Panier de Fruits", "Attrape les fruits qui tombent et évite les bombes. Remplis ton panier !", "arcade", "arcade", 4, Difficulty.EASY, "🧺", "#FF5A5F", [5000, 7000, 9000], [5000, 5000, 5000]),

  // ── Puzzles & réflexion (13) ──────────────────────────────────
  ng("word-search", "Mots Mêlés", "Retrouve les mots cachés dans la grille. Horizontal, vertical ou diagonal : à toi de chercher !", "word-search", "puzzles", 7, Difficulty.MEDIUM, "🔎", "#6C5CE7", [3000, 4500, 6000], [8000, 10000, 12000], true),
  ng("sudoku", "Sudoku des Animaux", "Chaque ligne, colonne et carré doit contenir les 4 animaux exactement une fois.", "sudoku", "intelligence", 6, Difficulty.MEDIUM, "🐨", "#8E44AD", [3000, 4500, 6000], [10000, 12000, 15000], true),
  ng("nonogram", "Pixel Puzzle", "Remplis les cases selon les indices des lignes et colonnes, et révèle l'image cachée.", "nonogram", "puzzles", 7, Difficulty.MEDIUM, "🖼️", "#6C5CE7", [3000, 4000, 5000], [12000, 15000, 18000], true),
  ng("connect-dots", "Relie les Points", "Relie les points dans l'ordre pour dessiner une surprise. Une étoile, un cœur ou une maison ?", "connect-dots", "puzzles", 4, Difficulty.EASY, "⭐", "#6C5CE7", [2000, 3000, 4000], [4000, 5000, 6000]),
  ng("pixel-color", "Coloriage Magique", "Colorie les cases en suivant les numéros et découvre le dessin qui se cache.", "pixel-color", "puzzles", 5, Difficulty.EASY, "🎨", "#6C5CE7", [2500, 3500, 4500], [12000, 15000, 18000]),
  ng("swap-puzzle", "Puzzle Échange", "Échange les pièces pour remettre les nombres dans l'ordre. Plus rapide que le puzzle magique !", "swap-puzzle", "puzzles", 6, Difficulty.EASY, "🧩", "#6C5CE7", [2500, 3500, 4500], [6000, 8000, 10000]),
  ng("tic-tac-toe", "Morpion", "Aligne trois symboles avant l'ordinateur. 3 manches pour prouver que tu es le meilleur !", "tic-tac-toe", "intelligence", 4, Difficulty.EASY, "⭕", "#8E44AD", [1500, 2500, 3500], [8000, 10000, 12000]),
  ng("connect-four", "Puissance 4", "Aligne quatre jetons avant l'ordinateur. Réfléchis bien avant de lâcher ta pièce !", "connect-four", "intelligence", 6, Difficulty.MEDIUM, "🔴", "#8E44AD", [2500, 4000, 5500], [8000, 10000, 12000], true),
  ng("minesweeper", "Petit Démineur", "Découvre toutes les cases sûres sans toucher les mines. La première case est toujours sûre !", "minesweeper", "intelligence", 7, Difficulty.MEDIUM, "💣", "#8E44AD", [3000, 4500, 6000], [5000, 6000, 7000], true),
  ng("hanoi", "Tours de Hanoï", "Déplace les disques un par un sans jamais poser un grand disque sur un plus petit.", "hanoi", "puzzles", 6, Difficulty.MEDIUM, "🗼", "#6C5CE7", [2500, 4000, 5500], [8000, 10000, 12000], true),
  ng("memory-numbers", "Memory des Nombres", "Associe chaque chiffre à sa carte de points. Un memory pour compter en s'amusant !", "memory-numbers", "memoire", 4, Difficulty.EASY, "🔢", "#E84393", [2000, 3000, 4000], [6000, 8000, 10000]),
  ng("flash-count", "Compte Éclair", "Observe les objets pendant quelques secondes, puis compte-les de mémoire.", "flash-count", "observation", 4, Difficulty.EASY, "👀", "#00B8A9", [2500, 3500, 4500], [12000, 15000, 18000]),
  ng("disappearing", "Qu'est-ce qui a Disparu ?", "Observe la grille, puis retrouve l'élément qui s'est volatilisé. Œil de lynx requis !", "disappearing", "observation", 5, Difficulty.EASY, "🕵️", "#00B8A9", [2500, 3500, 4500], [12000, 14000, 16000]),

  // ── Rapidité & duel (2) ───────────────────────────────────────
  ng("number-hunt", "Chasse aux Nombres", "Touche les nombres dans l'ordre, le plus vite possible. Un défi de rapidité visuelle !", "number-hunt", "rapidite", 5, Difficulty.EASY, "🔢", "#D63031", [2500, 3500, 4500], [5000, 6000, 7000]),
  ng("rock-paper", "Pierre Feuille Ciseaux", "Défie l'ordinateur en 5 manches de pierre-feuille-ciseaux. À toi de choisir !", "rock-paper", "intelligence", 4, Difficulty.EASY, "✊", "#8E44AD", [1500, 2500, 3500], [5000, 6000, 7000]),
];

const GAMES = [...BASE_GAMES, ...NEW_GAMES];

// ─────────────────────────────────────────────────────────────────
//  ACHIEVEMENTS (§21)
// ─────────────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { code: "first_game",       title: "Premier Pas",            description: "Termine ton premier jeu.",                         icon: "🎮", category: "general",    xpReward: 50,  sortOrder: 1,  criteria: { type: "games_finished", count: 1 } },
  { code: "games_5",          title: "Apprenti Joueur",        description: "Termine 5 parties.",                               icon: "🧸", category: "general",    xpReward: 100, sortOrder: 2,  criteria: { type: "games_finished", count: 5 } },
  { code: "games_10",         title: "Vétéran",                description: "Termine 10 parties.",                              icon: "🚀", category: "general",    xpReward: 200, sortOrder: 3,  criteria: { type: "games_finished", count: 10 } },
  { code: "games_50",         title: "Champion",               description: "Termine 50 parties.",                              icon: "🏅", category: "general",    xpReward: 400, sortOrder: 4,  criteria: { type: "games_finished", count: 50 } },
  { code: "points_1000",      title: "Millénaire",             description: "Atteins 1000 points au total.",                    icon: "💎", category: "general",    xpReward: 150, sortOrder: 5,  criteria: { type: "points", count: 1000 } },
  { code: "points_5000",      title: "Collectionneur d'Étoiles", description: "Atteins 5000 points au total.",                  icon: "🌟", category: "general",    xpReward: 300, sortOrder: 6,  criteria: { type: "points", count: 5000 } },
  { code: "streak_5",         title: "En Feu !",               description: "Gagne 5 parties d'affilée.",                       icon: "🔥", category: "general",    xpReward: 150, sortOrder: 7,  criteria: { type: "streak", count: 5 } },
  { code: "explorer",         title: "Explorateur",            description: "Joue à 5 jeux différents.",                        icon: "🗺️", category: "general",    xpReward: 100, sortOrder: 8,  criteria: { type: "distinct_games", count: 5 } },
  { code: "memory_master",    title: "Maître de la Mémoire",   description: "Gagne 10 parties dans la catégorie Mémoire.",      icon: "🧠", category: "memoire",    xpReward: 200, sortOrder: 9,  criteria: { type: "category_wins", categorySlug: "memoire", count: 10 } },
  { code: "logic_master",     title: "Maître de la Logique",   description: "Gagne 10 parties dans la catégorie Intelligence.", icon: "🤔", category: "intelligence", xpReward: 200, sortOrder: 10, criteria: { type: "category_wins", categorySlug: "intelligence", count: 10 } },
  { code: "math_master",      title: "Génie des Maths",        description: "Gagne 10 parties de Défi Maths.",                  icon: "➗", category: "maths",      xpReward: 200, sortOrder: 11, criteria: { type: "category_wins", categorySlug: "maths", count: 10 } },
  { code: "puzzle_master",    title: "Roi du Puzzle",          description: "Gagne 10 parties dans la catégorie Puzzles.",      icon: "🧩", category: "puzzles",    xpReward: 200, sortOrder: 12, criteria: { type: "category_wins", categorySlug: "puzzles", count: 10 } },
  { code: "speedster",        title: "Éclair",                 description: "Gagne une partie en moins de 30 secondes.",        icon: "⚡", category: "rapidite",   xpReward: 150, sortOrder: 13, criteria: { type: "speed_win", maxDurationMs: 30000 } },
  { code: "perfect_score",    title: "Sans Faute",             description: "Obtiens 3 étoiles sur une partie difficile.",      icon: "🎯", category: "general",    xpReward: 250, sortOrder: 14, criteria: { type: "perfect_stars", minDifficulty: "hard", count: 1 } },
  { code: "perfectionist",    title: "Perfectionniste",        description: "Obtiens 3 étoiles sur 5 jeux différents.",         icon: "💯", category: "general",    xpReward: 300, sortOrder: 15, criteria: { type: "three_star_games", count: 5 } },
];

// ─────────────────────────────────────────────────────────────────
//  HELPERS DÉMO
// ─────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}
function daysAgo(days: number, hour = rand(8, 20)): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, rand(0, 59), rand(0, 59), 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────
//  SEED PRINCIPAL
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seed Kidora — démarrage…");

  // ── 1. Catégories ──────────────────────────────────────────────
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, emoji: c.emoji, color: c.color, sortOrder: c.sortOrder },
      create: c,
    });
  }
  console.log(`   ✓ ${CATEGORIES.length} catégories`);

  // ── 2. Jeux ────────────────────────────────────────────────────
  const categoryBySlug = new Map(
    (await prisma.category.findMany()).map((c) => [c.slug, c]),
  );
  for (const g of GAMES) {
    const category = categoryBySlug.get(g.categorySlug);
    if (!category) throw new Error(`Catégorie manquante : ${g.categorySlug}`);
    const { categorySlug, ...data } = g;
    await prisma.game.upsert({
      where: { slug: g.slug },
      update: { ...data, categoryId: category.id, isPublished: true },
      create: { ...data, categoryId: category.id, isPublished: true },
    });
  }
  console.log(`   ✓ ${GAMES.length} jeux`);

  // ── 2b. Plans Premium ──────────────────────────────────────────
  const plansBySlug = new Map<string, { id: string }>();
  for (const plan of PLANS) {
    const saved = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: plan.currency,
        interval: plan.interval,
        trialDays: plan.trialDays,
        features: plan.features,
        isPopular: plan.isPopular,
        isActive: true,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
    plansBySlug.set(saved.slug, saved);
  }
  console.log(`   ✓ ${PLANS.length} plans Premium`);

  // ── 3. Achievements ────────────────────────────────────────────
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      update: { title: a.title, description: a.description, icon: a.icon, category: a.category, xpReward: a.xpReward, criteria: a.criteria, sortOrder: a.sortOrder },
      create: a,
    });
  }
  console.log(`   ✓ ${ACHIEVEMENTS.length} achievements`);

  // ── 4. Admin ───────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin1234!", 12);
  await prisma.user.upsert({
    where: { email: "admin@kidora.dev" },
    update: {},
    create: {
      email: "admin@kidora.dev",
      passwordHash: adminHash,
      role: Role.ADMIN,
      displayName: "Admin Kidora",
      avatar: "🛡️",
      consentAcceptedAt: new Date(),
    },
  });
  console.log("   ✓ compte admin (admin@kidora.dev / Admin1234!)");

  // ── 5. Parent démo + enfants ───────────────────────────────────
  const parentHash = await bcrypt.hash("Parent1234!", 12);
  const parent = await prisma.user.upsert({
    where: { email: "parent@kidora.dev" },
    update: {},
    create: {
      email: "parent@kidora.dev",
      passwordHash: parentHash,
      role: Role.PARENT,
      displayName: "Famille Démo",
      avatar: "👨‍👩‍👧",
      consentAcceptedAt: new Date(),
    },
  });

  const adam = await prisma.profile.upsert({
    where: { id: "seed-profile-adam" },
    update: {},
    create: {
      id: "seed-profile-adam",
      userId: parent.id,
      displayName: "Adam",
      avatar: "🦁",
      ageTier: AgeTier.AGE_6_8,
      isDefault: true,
      leaderboardOptIn: true,
    },
  });
  const lina = await prisma.profile.upsert({
    where: { id: "seed-profile-lina" },
    update: {},
    create: {
      id: "seed-profile-lina",
      userId: parent.id,
      displayName: "Lina",
      avatar: "🦄",
      ageTier: AgeTier.AGE_3_5,
      leaderboardOptIn: true,
    },
  });
  await prisma.parentChild.upsert({
    where: { parentId_profileId: { parentId: parent.id, profileId: adam.id } },
    update: {},
    create: { parentId: parent.id, profileId: adam.id },
  });
  await prisma.parentChild.upsert({
    where: { parentId_profileId: { parentId: parent.id, profileId: lina.id } },
    update: {},
    create: { parentId: parent.id, profileId: lina.id },
  });
  // Profil actif par défaut du parent = Adam
  await prisma.user.update({ where: { id: parent.id }, data: { activeProfileId: adam.id } });

  // Abonnement de démonstration : le parent a déjà le Premium annuel.
  // PixelKid (compte enfant autonome) reste sans abonnement pour
  // pouvoir tester le paywall et le parcours d'activation.
  const yearlyPlan = plansBySlug.get("yearly");
  if (yearlyPlan) {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const subscription = await prisma.subscription.upsert({
      where: { userId: parent.id },
      update: {},
      create: {
        userId: parent.id,
        planId: yearlyPlan.id,
        status: SubscriptionStatus.ACTIVE,
        provider: BillingProvider.DEMO,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
    const existingPayments = await prisma.payment.count({ where: { userId: parent.id } });
    if (existingPayments === 0) {
      await prisma.payment.create({
        data: {
          userId: parent.id,
          planId: yearlyPlan.id,
          subscriptionId: subscription.id,
          amountCents: 4990,
          currency: "EUR",
          status: PaymentStatus.SUCCEEDED,
          provider: BillingProvider.DEMO,
        },
      });
    }
  }
  console.log("   ✓ abonnement Premium démo (parent@kidora.dev)");

  // ── 6. Profils leaderboard démo ────────────────────────────────
  const demoKids = [
    { email: "pixelkid@kidora.dev", name: "PixelKid",    avatar: "🐸", tier: AgeTier.AGE_6_8,  points: rand(1800, 2600) },
    { email: "dragon123@kidora.dev", name: "Dragon123",  avatar: "🐲", tier: AgeTier.AGE_9_12, points: rand(2200, 3200) },
    { email: "brainmaster@kidora.dev", name: "BrainMaster", avatar: "🦉", tier: AgeTier.AGE_9_12, points: rand(1600, 2400) },
  ];
  const demoHash = await bcrypt.hash("Demo1234!", 12);
  for (const kid of demoKids) {
    const u = await prisma.user.upsert({
      where: { email: kid.email },
      update: {},
      create: {
        email: kid.email,
        passwordHash: demoHash,
        role: Role.CHILD,
        displayName: kid.name,
        avatar: kid.avatar,
        ageTier: kid.tier,
        consentAcceptedAt: new Date(),
      },
    });
    const p = await prisma.profile.upsert({
      where: { id: `seed-profile-${kid.name.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-profile-${kid.name.toLowerCase()}`,
        userId: u.id,
        displayName: kid.name,
        avatar: kid.avatar,
        ageTier: kid.tier,
        isDefault: true,
        leaderboardOptIn: true,
      },
    });
    await prisma.profile.update({
      where: { id: p.id },
      data: { points: kid.points, xp: kid.points * 2, level: levelFromXp(kid.points * 2) },
    });
  }
  console.log("   ✓ profils démo (Adam, Lina, PixelKid, Dragon123, BrainMaster)");

  // ── 7. Sessions / scores démo pour Adam (30 derniers jours) ────
  const existingSessions = await prisma.gameSession.count({ where: { profileId: adam.id } });
  if (existingSessions === 0) {
    const games = await prisma.game.findMany({ include: { category: true } });
    const difficulties: Difficulty[] = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];
    let xpTotal = 0;
    let pointsTotal = 0;

    for (let i = 0; i < 42; i++) {
      const game = pick(games);
      const difficulty = pick(difficulties);
      const cfg = game.config as any;
      const cap: number = cfg?.maxScore?.[difficulty.toLowerCase()] ?? 3000;
      const minDur: number = cfg?.minDurationMs?.[difficulty.toLowerCase()] ?? 10000;

      const score = rand(Math.round(cap * 0.3), Math.round(cap * 0.95));
      const duration = minDur + rand(2000, 45000);
      const isWin = score >= cap * 0.35;
      const stars = starsFromScore(score, cap);
      const startedAt = daysAgo(rand(0, 29));
      const finishedAt = new Date(startedAt.getTime() + duration);
      const xpGain = computeSessionXp({ score, isWin, difficulty, durationMs: duration });

      await prisma.gameSession.create({
        data: {
          profileId: adam.id,
          gameId: game.id,
          difficulty,
          status: SessionStatus.FINISHED,
          startedAt,
          finishedAt,
          score,
          durationMs: duration,
          isWin,
          levelReached: rand(1, 3),
          stars,
          clientMeta: { source: "seed" },
          scoreRow: {
            create: {
              profileId: adam.id,
              gameId: game.id,
              score,
              durationMs: duration,
              difficulty,
              isWin,
              stars,
              createdAt: finishedAt,
            },
          },
        },
      });

      await prisma.progress.upsert({
        where: { profileId_gameId: { profileId: adam.id, gameId: game.id } },
        update: {
          plays: { increment: 1 },
          wins: isWin ? { increment: 1 } : undefined,
          totalTimeMs: { increment: duration },
          bestScore: { set: 0 }, // corrigé ci-dessous
          lastPlayedAt: finishedAt,
        },
        create: {
          profileId: adam.id,
          gameId: game.id,
          level: rand(1, 3),
          bestScore: score,
          plays: 1,
          wins: isWin ? 1 : 0,
          totalTimeMs: duration,
          lastPlayedAt: finishedAt,
        },
      });
      xpTotal += xpGain;
      pointsTotal += score;
    }

    // Recalcule bestScore exact pour chaque jeu d'Adam
    const progresses = await prisma.progress.findMany({ where: { profileId: adam.id } });
    for (const p of progresses) {
      const best = await prisma.score.aggregate({
        where: { profileId: adam.id, gameId: p.gameId },
        _max: { score: true },
      });
      await prisma.progress.update({
        where: { id: p.id },
        data: { bestScore: best._max.score ?? 0, level: rand(1, 3) },
      });
    }

    // XP / points / niveau d'Adam + progression de Lina (plus légère)
    await prisma.profile.update({
      where: { id: adam.id },
      data: { xp: xpTotal, points: pointsTotal, level: levelFromXp(xpTotal) },
    });
    await prisma.profile.update({
      where: { id: lina.id },
      data: { xp: rand(180, 320), points: rand(300, 700), level: 2 },
    });

    // Quelques favoris + achievements pour Adam
    const favGames = games.slice(0, 4);
    for (const g of favGames) {
      await prisma.favorite.upsert({
        where: { profileId_gameId: { profileId: adam.id, gameId: g.id } },
        update: {},
        create: { profileId: adam.id, gameId: g.id },
      });
    }
    const unlockCodes = ["first_game", "games_10", "explorer", "points_1000"];
    for (const code of unlockCodes) {
      const ach = await prisma.achievement.findUnique({ where: { code } });
      if (ach) {
        await prisma.userAchievement.upsert({
          where: { profileId_achievementId: { profileId: adam.id, achievementId: ach.id } },
          update: {},
          create: {
            profileId: adam.id,
            achievementId: ach.id,
            unlockedAt: daysAgo(rand(2, 20)),
          },
        });
      }
    }
    console.log("   ✓ 42 sessions de démo + progression + favoris + achievements pour Adam");
  } else {
    console.log("   • sessions de démo déjà présentes — ignoré");
  }

  console.log("✅ Seed terminé.");
  console.log("");
  console.log("   Comptes de démonstration :");
  console.log("   ─ Admin  : admin@kidora.dev  / Admin1234!");
  console.log("   ─ Parent : parent@kidora.dev / Parent1234!  (enfants : Adam, Lina)");
  console.log("   ─ Enfant : pixelkid@kidora.dev / Demo1234!");
}

main()
  .catch((e) => {
    console.error("❌ Erreur pendant le seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
