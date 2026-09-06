---
name: doctor
description: >
  Diagnose and fix a stack project's local setup: Docker not running, containers unhealthy, port
  clashes, missing .env.local, pending migrations, dev server or worker down, emails not arriving,
  Playwright missing. Use when the user says something "isn't working", "won't start", "error when I
  run…", "can't sign in", "email never arrives", "page is blank", or runs /stack:doctor.
allowed-tools: Bash, Read, Edit, Glob, Grep, mcp__plugin_playwright_playwright__*
---

# /stack:doctor — make local dev healthy again

Run the checks top to bottom; stop at the first failure, fix it, then continue. Report at the end in
plain words (`${CLAUDE_PLUGIN_ROOT}/references/voice.md`): what was wrong, what you did, and open the
app for them when it's back. If nothing is wrong on the machine, the problem is in the app itself —
ask them what they clicked and what they saw, reproduce it with Playwright MCP, and fix the code.

```bash
# 0. Right place?
test -f package.json && grep -q '"setup"' package.json || echo "NOT_A_STACK_PROJECT"
# 1. Tools
node --version; bun --version; docker --version; docker info >/dev/null 2>&1 && echo docker-running || echo DOCKER_NOT_RUNNING
# 2. Env
test -f .env.local && echo env-ok || echo NO_ENV_LOCAL
# 3. Containers
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
# 4. Ports (who holds them?)
for p in 3000 5432 9000 9001 1025 8025; do lsof -nP -iTCP:$p -sTCP:LISTEN | tail -n +2 | head -1 | sed "s/^/port $p: /"; done
# 5. DB reachable + migrations
set -a; source .env.local; set +a; bun run db:migrate 2>&1 | tail -3
# 6. App + worker (both run inside `bun run dev`)
curl -s -m 10 http://localhost:3000/api/health || echo APP_DOWN
pgrep -fl "worker/index.ts" || echo WORKER_DOWN
# 7. Mail + files
curl -s -m 5 http://localhost:8025/livez >/dev/null && echo mailpit-ok || echo MAILPIT_DOWN
curl -s -m 5 http://localhost:9000/minio/health/live >/dev/null && echo minio-ok || echo MINIO_DOWN
# 8. Quality gates
bun run typecheck 2>&1 | tail -5; bun run lint 2>&1 | tail -3
# 9. Guard-rails present?
git config core.hooksPath || echo NO_GIT_HOOKS
```

Fixes:
- **NOT_A_STACK_PROJECT** → Claude Code is open in the wrong folder. Tell them: File → Open Folder →
  `projects` → the app's folder. (If they haven't made an app: `/stack:new-app`.)
- **node missing / < 20.9** → install Node LTS (`/stack:setup` step 2). `next dev`/`next build` must run under Node.
- **DOCKER_NOT_RUNNING** → `open -a Docker`; poll `docker info` for 2 minutes; re-run.
- **NO_ENV_LOCAL** or containers missing/unhealthy → `bun run setup` (idempotent; also stops another
  stack app holding the ports and says so).
- **Port 3000 held by an old `next dev`** → `kill <pid>`, then `bun run dev`. Other ports held by a
  non-stack thing → say what it is and ask them to close it.
- **Migrations pending/failing** → read the error; usually a migration file conflict → `/stack:db-change` recovery.
- **APP_DOWN / WORKER_DOWN** → start `bun run dev` (background; it runs both) and re-check; read its
  output for the real error ("Invalid environment variables" → fix `.env.local`; module not found →
  `bun install`; a compile error → fix the file it names).
- **Email never arrives** → Mailpit up? `SMTP_URL=smtp://localhost:1025` in `.env.local`? For OTP/reset the
  app sends inline (dev server log shows `email.sent`); for welcome/other mail the worker must be running.
- **Can't sign in / weird auth errors** → `BETTER_AUTH_SECRET` ≥ 32 chars and unchanged since sign-up
  (changing it invalidates sessions); `APP_URL=http://localhost:3000` matches the port you're using.
  "Accounts are by invitation only" → `SIGNUP_ALLOWLIST` is set in `.env.local`; it should be empty locally.
- **Blank page / 500** → dev server log; usually a compile error in the last edited file — fix it.
- **Playwright errors about browsers** → `bunx playwright install chromium`.
- **NO_GIT_HOOKS** → `git config core.hooksPath .githooks`.
- **Nuclear (local only)** → `bun run db:reset` wipes local data and re-runs setup. Say what's lost first.

When healthy: `open http://localhost:3000` and say it's back.
