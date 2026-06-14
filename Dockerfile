# Parc Fermé demo store — single-container build.
# Stage 1: build the React frontend.
FROM node:24-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# Optional Fastly Bot Management embedded-challenge config, baked in at build time.
# Two ways to set it, either works:
#   1) create client/.env with VITE_FASTLY_CHALLENGE_FILE=<your-filename>.js
#   2) pass --build-arg VITE_FASTLY_CHALLENGE_FILE=<your-filename>.js
# (Only the filename is needed — the universal prefix is built in. A full-path
# override, VITE_FASTLY_CHALLENGE_PATH, is also supported.) A non-empty build-arg
# takes precedence; otherwise client/.env is used. We must NOT set empty ENVs
# here — that would shadow the client/.env file at build.
ARG VITE_FASTLY_CHALLENGE_FILE=""
ARG VITE_FASTLY_CHALLENGE_PATH=""
ARG VITE_FASTLY_CHALLENGE_FAILOPEN=""
ARG VITE_FASTLY_CHALLENGE_DISABLED=""
RUN if [ -n "$VITE_FASTLY_CHALLENGE_FILE" ]; then export VITE_FASTLY_CHALLENGE_FILE="$VITE_FASTLY_CHALLENGE_FILE"; else unset VITE_FASTLY_CHALLENGE_FILE; fi; \
    if [ -n "$VITE_FASTLY_CHALLENGE_PATH" ]; then export VITE_FASTLY_CHALLENGE_PATH="$VITE_FASTLY_CHALLENGE_PATH"; else unset VITE_FASTLY_CHALLENGE_PATH; fi; \
    if [ -n "$VITE_FASTLY_CHALLENGE_FAILOPEN" ]; then export VITE_FASTLY_CHALLENGE_FAILOPEN="$VITE_FASTLY_CHALLENGE_FAILOPEN"; else unset VITE_FASTLY_CHALLENGE_FAILOPEN; fi; \
    if [ -n "$VITE_FASTLY_CHALLENGE_DISABLED" ]; then export VITE_FASTLY_CHALLENGE_DISABLED="$VITE_FASTLY_CHALLENGE_DISABLED"; else unset VITE_FASTLY_CHALLENGE_DISABLED; fi; \
    npm run build

# Stage 2: runtime — Express API serving the built frontend.
# node:sqlite is built into Node 22.5+, so no native compilation is needed.
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/ ./
COPY --from=client-build /app/client/dist /app/client/dist

# Create writable runtime dirs owned by the non-root `node` user. A named volume
# mounted at server/data inherits this ownership when first created, so the
# non-root process can create the SQLite database and its WAL/SHM sidecar files.
# The logs dir lives in the image layer and likewise needs to be node-writable.
RUN mkdir -p /app/server/data /app/server/logs \
    && chown -R node:node /app/server/data /app/server/logs

# The API auto-seeds an empty database on first start.
ENV PORT=4000 \
    DATABASE_PATH=/app/server/data/store.db
EXPOSE 4000
USER node
CMD ["npx", "tsx", "src/index.ts"]
