# Multi-stage build on Bun. The SAME image serves both Railway services:
#   web    → start command: bun run start   (default CMD)
#   worker → start command: bun run worker
FROM oven/bun:1.3.14-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.14-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# No real config at build time — env is validated when the container starts (src/lib/env.ts).
ENV SKIP_ENV_VALIDATION=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.3.14-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app ./
EXPOSE 3000
CMD ["bun", "run", "start"]
