# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/copy-maplibre-worker.mjs ./scripts/copy-maplibre-worker.mjs
RUN npm ci

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# public/vendor is generated (gitignored): ship MapLibre's worker with this build.
RUN node scripts/copy-maplibre-worker.mjs
# Build-time placeholder only; the real secret comes from the runtime env.
RUN BETTER_AUTH_SECRET=build-placeholder-not-used-at-runtime BETTER_AUTH_URL=http://localhost:3000 DATABASE_URL=file:/tmp/build.db npm run build

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS run
WORKDIR /app
LABEL org.opencontainers.image.title="Hikō" \
    org.opencontainers.image.description="A self-hosted drone logbook for pilots flying in Japan" \
    org.opencontainers.image.source="https://github.com/eliemada/hiko" \
    org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/hiko.db DATA_DIR=/data
RUN groupadd -g 10001 hiko && useradd -u 10001 -g hiko -M hiko && mkdir -p /data && chown hiko:hiko /data
COPY --from=build --chown=hiko:hiko /app/.next/standalone ./
COPY --from=build --chown=hiko:hiko /app/.next/static ./.next/static
COPY --from=build --chown=hiko:hiko /app/public ./public
COPY --from=build --chown=hiko:hiko /app/drizzle ./drizzle
COPY --from=build --chown=hiko:hiko /app/src/assets ./src/assets
COPY --from=build /app/LICENSE /app/THIRD_PARTY_NOTICES.md ./
USER hiko
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
