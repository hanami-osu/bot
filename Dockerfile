ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile --production

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    DEV=false \
    LOG_DIR=/tmp/hanami-logs
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
USER bun
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["bun", "src/healthcheck.ts"]
CMD ["bun", "run", "start"]
