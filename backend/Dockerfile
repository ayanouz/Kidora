# ══════════════════════════════════════════════════════════════════
#  KIDORA — Image Docker du backend (Fastify + Prisma)
#  Build multi-étapes : compilation TS puis image runtime minimale.
# ══════════════════════════════════════════════════════════════════

# ── Étape 1 : build ───────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Étape 2 : runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Client Prisma généré + schéma + sources TS
# (dist = serveur compilé ; src = requis par prisma/seed.ts qui importe
#  ../src/lib/xp et s'exécute via tsx, désormais dépendance de production)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY prisma ./prisma
COPY --from=build /app/src ./src

COPY --from=build /app/dist ./dist

# Utilisateur non-root
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Healthcheck via l'endpoint /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/server.js"]
