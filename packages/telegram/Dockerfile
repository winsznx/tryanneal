FROM node:20-bookworm-slim

# Slither + solc for the static-analysis path. The bot calls runAudit() from
# @tryanneal/engine which spawns `slither` — keep the install lean.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates git curl \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --break-system-packages --no-cache-dir slither-analyzer solc-select \
  && solc-select install 0.8.24 \
  && solc-select use 0.8.24 \
  && ln -sf /root/.solc-select/artifacts/solc-0.8.24/solc-0.8.24 /usr/local/bin/solc

WORKDIR /app

# pnpm via corepack — keeps the workspace install honest.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Lockfile + workspace metadata first to maximise layer cache.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/tsconfig.json packages/engine/
COPY packages/detectors/package.json packages/detectors/
COPY packages/telegram/package.json packages/telegram/tsconfig.json packages/telegram/

RUN pnpm install --frozen-lockfile --filter @tryanneal/engine --filter @tryanneal/telegram

# Source for engine + telegram; build engine to dist; install custom detectors.
COPY packages/engine packages/engine
COPY packages/detectors packages/detectors
COPY packages/telegram/src packages/telegram/src

RUN pnpm --filter @tryanneal/engine build \
  && pnpm --filter @tryanneal/telegram build \
  && pip3 install --break-system-packages --no-cache-dir -e packages/detectors

ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@tryanneal/telegram", "start"]
