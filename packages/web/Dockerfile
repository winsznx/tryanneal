# TryAnneal web — Next.js 16 dashboard + safety-oracle API.
# Build context is the REPO ROOT (set RAILWAY_DOCKERFILE_PATH=packages/web/Dockerfile).
#
# The safety-oracle GET route only needs on-chain reads (ethers) — no Slither,
# no API keys. The POST /api/safety/audit route degrades to LLM-only when
# Slither isn't present, so we keep this image lean and omit the analyzer.
FROM node:20-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Workspace metadata first for layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/tsconfig.json packages/engine/
COPY packages/web/package.json packages/web/

RUN pnpm install --frozen-lockfile --filter @tryanneal/engine --filter @tryanneal/web

# Source.
COPY packages/engine packages/engine
COPY packages/web packages/web

# Engine must be built to dist/ before the web build (web imports @tryanneal/engine).
RUN pnpm --filter @tryanneal/engine build \
  && pnpm --filter @tryanneal/web build

ENV NODE_ENV=production
# Railway provides PORT; Next reads it. Bind all interfaces.
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["pnpm", "--filter", "@tryanneal/web", "start"]
