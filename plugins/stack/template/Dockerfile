# Multi-stage build. Node runs Next.js (as it does on your machine); Bun installs deps and runs the
# worker. The SAME image serves both Railway services:
#   web    → start command: bun run db:migrate && bun run start   (railway.toml)
#   worker → start command: bun run worker                        (railway.worker.toml)
# Versions: newest Node LTS + newest Bun, kept current by /stack:upgrade.
FROM node:24-trixie-slim AS base
COPY --from=oven/bun:1.4.4 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
# No real config at build time — env is validated when the container starts (src/lib/env.ts).
ENV SKIP_ENV_VALIDATION=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["bun", "run", "start"]
