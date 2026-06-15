FROM node:20-bookworm-slim

# Slither + solc so the audit_contract tool works on the hosted endpoint too
# (is_this_safe + corpus_stats need neither).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates git curl \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --break-system-packages --no-cache-dir slither-analyzer solc-select \
  && solc-select install 0.8.24 \
  && solc-select use 0.8.24 \
  && ln -sf /root/.solc-select/artifacts/solc-0.8.24/solc-0.8.24 /usr/local/bin/solc

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/tsconfig.json packages/engine/
COPY packages/detectors/package.json packages/detectors/
COPY packages/mcp/package.json packages/mcp/tsconfig.json packages/mcp/

RUN pnpm install --frozen-lockfile --filter @tryanneal/engine --filter @tryanneal/mcp

COPY packages/engine packages/engine
COPY packages/detectors packages/detectors
COPY packages/mcp/src packages/mcp/src

RUN pnpm --filter @tryanneal/engine build \
  && pnpm --filter @tryanneal/mcp build \
  && pip3 install --break-system-packages --no-cache-dir -e packages/detectors

ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "--filter", "@tryanneal/mcp", "start:http"]
