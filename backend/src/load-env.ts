// ══════════════════════════════════════════════════════════════════
//  KIDORA — Chargement du .env racine (monorepo)
//
//  Doit être le TOUT PREMIER import de server.ts et prisma/seed.ts :
//  les variables doivent exister avant que src/config/env.ts ne soit
//  évalué (il fait un fail-fast si DATABASE_URL / JWT_SECRET manquent).
//
//  • Développement : lit <racine>/.env (backend/src → ../../.env)
//  • Docker / CI : le fichier n'existe pas → no-op silencieux,
//    les variables viennent déjà de l'environnement du conteneur.
// ══════════════════════════════════════════════════════════════════

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../.env") });
