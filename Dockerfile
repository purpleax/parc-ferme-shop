# Parc Fermé demo store — single-container build.
# Stage 1: build the React frontend.
FROM node:24-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

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
