---
name: deploy
description: >
  Put a stack project on the internet with Railway: create the project, Postgres, bucket, web + worker
  services from the GitHub repo, set environment variables, domain, verify health. Also handles
  redeploys and reading production logs. Use when the user says "deploy", "go live", "put it online",
  "production", "Railway", "it's broken in prod", or runs /stack:deploy.
allowed-tools: Bash, Read, Edit, Glob, Grep, AskUserQuestion, WebFetch, Skill, mcp__claude_ai_Railway__*, mcp__plugin_railway_railway__*
---

# /stack:deploy — Railway

Load the Railway skill if available (`Skill: railway:use-railway` or `use-railway`) — it knows the CLI
and MCP details. This file is the *what*; that skill is the *how*.

Target shape (`architecture.md` §10): one Railway project → services **web**, **worker**, **Postgres**,
plus a **bucket**. Same Dockerfile for web and worker; different start commands via
`railway.toml` (web) and `railway.worker.toml` (worker).

## First deploy

1. **Prereqs**: `railway --version` (else `brew install railway` / `npm i -g @railway/cli`),
   `railway whoami` (else `railway login` — browser step for the user). Repo pushed to GitHub.
2. **Which branch deploys?** Ask once: `dev` (see work live immediately — recommended while one person
   builds) or `main` (Matt controls releases). Record the answer in `AGENTS.md` under Rules.
3. **Project + database**: `railway init` (name = app name) → add Postgres (`railway add --database postgres`).
4. **Bucket**: create a Railway bucket in the project (dashboard or MCP); note endpoint, region,
   bucket name, access key, secret. (Alternative if unavailable: Cloudflare R2 — same S3 vars.)
5. **web service**: create from the GitHub repo, branch from step 2, root `/`. Railway picks up
   `railway.toml` (Dockerfile build, `db:migrate && start`, health `/api/health`).
6. **worker service**: create a second service from the same repo/branch; in Settings → Config-as-code
   set path `railway.worker.toml`. No public domain needed.
7. **Variables** — set on BOTH web and worker (shared variables are ideal):
   ```
   NODE_ENV=production
   APP_URL=https://<web-domain>            # set after step 8, then redeploy web
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   BETTER_AUTH_SECRET=<openssl rand -base64 32 — generate, never reuse local>
   EMAIL_FROM="<App Title> <hello@yourdomain>"
   RESEND_API_KEY=<from resend.com — user must create account + verify sending domain>
   S3_ENDPOINT / S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY  (from the bucket)
   S3_FORCE_PATH_STYLE=false               # true only for MinIO
   LOG_LEVEL=info
   ```
   No `SMTP_URL` in prod. If the user has no Resend yet: deploy anyway; sign-in by password works
   with no email; OTP/magic link/reset need it — say so plainly.
8. **Domain**: `railway domain` on web (or custom domain). Then set `APP_URL` to it and redeploy web.
9. **Verify**: `curl https://<domain>/api/health` → `{"ok":true,"db":"up"}`; sign up in the browser;
   `railway logs --service worker` shows `worker.ready`; welcome email arrives (if Resend set).
10. Tell the user the URL, what's configured, and what's pending (e.g. Resend). Commit any
    `AGENTS.md` change via `/stack:ship`.

## Later

- New env var in code → add it to Railway (both services) BEFORE pushing the code that requires it.
- Deploy failing → `railway logs --deployment` for the build/runtime error; health failing → app
  probably can't reach the DB or a required env var is missing (the app prints "Invalid environment
  variables" with the names — read them).
- Migrations run on web start; a failing migration blocks the deploy — read the log, fix forward with a
  new migration.
- Never run destructive DB commands against production. `db:reset` refuses on Railway by design.
