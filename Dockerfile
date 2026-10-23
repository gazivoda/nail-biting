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
# generate-seo-content.mjs runs at vite closeBundle — build fails without it
COPY scripts ./scripts
# shared/plans.js: the trial length and plan numbers, imported by src/, scripts/ and the server
COPY shared ./shared
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts tailwind.config.js postcss.config.js ./

# Build-time env vars — declared as ARG so Coolify can pass them via --build-arg,
# then promoted to ENV so Vite sees them during the build step.
ARG VITE_FORMSPREE_FORM_ID
ENV VITE_FORMSPREE_FORM_ID=$VITE_FORMSPREE_FORM_ID

ARG VITE_PADDLE_CLIENT_TOKEN
ENV VITE_PADDLE_CLIENT_TOKEN=$VITE_PADDLE_CLIENT_TOKEN

ARG VITE_PADDLE_PRICE_ID_MONTHLY
ENV VITE_PADDLE_PRICE_ID_MONTHLY=$VITE_PADDLE_PRICE_ID_MONTHLY

ARG VITE_PADDLE_PRICE_ID_YEARLY
ENV VITE_PADDLE_PRICE_ID_YEARLY=$VITE_PADDLE_PRICE_ID_YEARLY

ARG VITE_PADDLE_ENV
ENV VITE_PADDLE_ENV=$VITE_PADDLE_ENV

# Lifetime and gift prices (WS9). Leave empty until the Paddle products exist.
ARG VITE_PADDLE_PRICE_ID_LIFETIME
ENV VITE_PADDLE_PRICE_ID_LIFETIME=$VITE_PADDLE_PRICE_ID_LIFETIME

ARG VITE_PADDLE_PRICE_ID_GIFT
ENV VITE_PADDLE_PRICE_ID_GIFT=$VITE_PADDLE_PRICE_ID_GIFT

# Trial length the site copy and generated pages say (WS9). Empty means the default
# (3 days). Set the SAME value as the runtime variable TRIAL_DAYS: see docs/agents/ws9-notes.md.
ARG TRIAL_DAYS
ENV TRIAL_DAYS=$TRIAL_DAYS

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

# Express server (server/ holds the route modules and the feature flags)
COPY server.js email.js trialFollowup.js ./
COPY server ./server
# shared/plans.js (trial length, plan numbers) is imported by server.js and server/**
COPY shared ./shared

# DATA_DIR is where SQLite lives.
# Mount a Coolify persistent volume at /app/data to survive redeploys.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
