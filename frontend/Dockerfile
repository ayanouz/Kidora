# ══════════════════════════════════════════════════════════════════
#  KIDORA — Image Docker du frontend
#  Build Vite → servi par Nginx (SPA)
# ══════════════════════════════════════════════════════════════════

# ── Étape 1 : build ───────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

# ── Étape 2 : nginx statique ──────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
