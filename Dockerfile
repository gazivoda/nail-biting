# ── Stage 1: build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app

# Native addon build tools needed for better-sqlite3 during npm ci
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# Skip Electron binary download — not needed for the web build
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci

# Copy only what vite needs to build the frontend
COPY src ./src
COPY public ./public
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts tailwind.config.js postcss.config.js ./

# Build with web base path (/ not ./ which is for Electron file://)
# Call vite directly — skip tsc which fails on Electron-specific types in CI
RUN VITE_BUILD_TARGET=web npx vite build --mode production

# ── Stage 2: production node_modules (native addons compiled) ─────────────────
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --omit=dev

# ── Stage 3: lean runtime image ───────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Production node_modules (with compiled better-sqlite3 binary)
COPY --from=deps /app/node_modules ./node_modules

# Built React frontend
COPY --from=frontend /app/dist ./dist

# Express server
COPY server.js ./

# DATA_DIR is where SQLite lives.
# Mount a Coolify persistent volume at /app/data to survive redeploys.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
