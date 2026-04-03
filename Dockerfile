# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install build tools needed for native addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# Copy only what the server needs at runtime
COPY server.js ./

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy built node_modules (includes compiled better-sqlite3 binary)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.js ./

# DATA_DIR is where the SQLite DB lives.
# Mount a Coolify persistent volume at /app/data to survive redeploys.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
