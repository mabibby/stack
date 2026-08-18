---
name: doctor
description: >
  Diagnose and fix a stack project's local setup: Docker not running, containers unhealthy, port
  clashes, missing .env.local, pending migrations, dev server or worker down, emails not arriving,
  Playwright missing. Use when the user says something "isn't working", "won't start", "error when I
  run…", "can't sign in", "email never arrives", "page is blank", or runs /stack:doctor.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# /stack:doctor — make local dev healthy again

Run the checks top to bottom; stop at the first failure, fix it, then continue. Report at the end in
plain words: what was wrong, what you did, and what they should run now.

```bash
# 0. Right place?
test -f package.json && grep -q '"setup"' package.json || echo "NOT_A_STACK_PROJECT"
# 1. Tools
bun --version; docker --version; docker info >/dev/null 2>&1 && echo docker-running || echo DOCKER_NOT_RUNNING
# 2. Env
test -f .env.local && echo env-ok || echo NO_ENV_LOCAL
# 3. Containers
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
# 4. Ports (who holds them?)
for p in 3000 5432 9000 9001 1025 8025; do lsof -nP -iTCP:$p -sTCP:LISTEN | tail -n +2 | head -1 | sed "s/^/port $p: /"; done
# 5. DB reachable + migrations
set -a; source .env.local; set +a; bun run db:migrate 2>&1 | tail -3
# 6. App + worker
curl -s -m 10 http://localhost:3000/api/health || echo APP_DOWN
pgrep -fl "worker/index.ts" || echo WORKER_DOWN
# 7. Mail + files
curl -s -m 5 http://localhost:8025/livez >/dev/null && echo mailpit-ok || echo MAILPIT_DOWN
curl -s -m 5 http://localhost:9000/minio/health/live >/dev/null && echo minio-ok || echo MINIO_DOWN
# 8. Quality gates
bun run typecheck 2>&1 | tail -5; bun run lint 2>&1 | tail -3
```

Fixes:
- **DOCKER_NOT_RUNNING** → open Docker Desktop; wait; re-run. (`open -a Docker` on mac.)
- **NO_ENV_LOCAL** or containers missing/unhealthy → `bun run setup` (idempotent).
- **Port held by another project's container** (name shows a different app) → `docker compose down`
  in that project, or change ports in this project's `docker-compose.yml` and `.env.local`
  (DATABASE_URL, S3_ENDPOINT, SMTP_URL) consistently. Port 3000 held by an old `next dev` → kill it
  (`kill <pid>`), then `bun run dev`.
- **Migrations pending/failing** → read the error; usually a migration file conflict → `/stack:db-change` recovery.
- **APP_DOWN** → start `bun run dev` (background) and re-check; read its output for the real error
  ("Invalid environment variables" → fix `.env.local`; module not found → `bun install`).
- **WORKER_DOWN** → `bun run dev:worker` (background). Emails other than sign-in codes need it.
- **Email never arrives** → Mailpit up? `SMTP_URL=smtp://localhost:1025` in `.env.local`? For OTP/reset the
  app sends inline (dev server log shows `email.sent`); for welcome/other mail the worker must be running.
- **Can't sign in / weird auth errors** → `BETTER_AUTH_SECRET` ≥ 32 chars and unchanged since sign-up
  (changing it invalidates sessions); `APP_URL=http://localhost:3000` matches the port you're using.
- **Blank page / 500** → dev server log; usually a compile error in the last edited file — fix it.
- **Playwright errors about browsers** → `bunx playwright install chromium`.
- **Nuclear (local only)** → `bun run db:reset` wipes local data and re-runs setup.
