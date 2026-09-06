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
and MCP details. This file is the *what*; that skill is the *how*. Talk to the user per
`${CLAUDE_PLUGIN_ROOT}/references/voice.md`: to them this is "putting it online".

Target shape (`architecture.md` §10): one Railway project → services **web**, **worker**, **Postgres**,
plus a **bucket**. Same Dockerfile for web and worker; different start commands via
`railway.toml` (web) and `railway.worker.toml` (worker). **The `dev` branch deploys** (the builder
sees their work live; `main` is Matt's reviewed copy). Don't ask about this.

## Before starting: the two product questions (ask both at once)

1. **Who should be able to create an account?** Options: "anyone who finds the site" or "only people
   I list". Recommend the second for anything that isn't a public product. Their answer becomes
   `SIGNUP_ALLOWLIST` (comma-separated emails and/or `@domains`; empty = anyone). Make sure their own
   email is on the list.
2. **Does this need to send email from a real address?** Sign-in codes, magic links and password resets
   need it. That requires a domain and a Resend account, which is Matt's side (DNS). If they don't
   have `RESEND_API_KEY` + a verified sending address from Matt yet: deploy anyway — password sign-in
   works without email — and say plainly that codes/links/resets will start working once Matt sends
   the key.

## First deploy

1. **Prereqs**: `railway --version` (else `bun install -g @railway/cli`), `railway whoami` (else sign-in
   is interactive: `osascript -e 'tell application "Terminal" to do script "railway login"'` and tell
   them to press Enter and click **Authorize** in the browser; they need a Railway account with a
   card — https://railway.com). Repo pushed to GitHub (`/stack:ship` first if not).
2. **Project + database**: `railway init` (name = app name) → add Postgres (`railway add --database postgres`).
3. **Bucket**: create a Railway bucket in the project (MCP `create-bucket` or dashboard); note endpoint,
   region, bucket name, access key, secret. (Alternative if unavailable: Cloudflare R2 — same S3 vars.)
4. **web service**: create from the GitHub repo, branch `dev`, root `/`. Railway picks up
   `railway.toml` (Dockerfile build, `db:migrate && start`, health `/api/health`).
5. **worker service**: create a second service from the same repo/branch; in Settings → Config-as-code
   set path `railway.worker.toml`. No public domain needed.
6. **Variables** — set on BOTH web and worker (shared variables are ideal):
   ```
   NODE_ENV=production
   APP_URL=https://<web-domain>            # set after step 7, then redeploy web
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   BETTER_AUTH_SECRET=<openssl rand -base64 32 — generate, never reuse local>
   EMAIL_FROM="<App Title> <hello@yourdomain>"
   RESEND_API_KEY=<from Matt / resend.com — needs a verified sending domain>
   SIGNUP_ALLOWLIST=<from question 1; empty = anyone>
   S3_ENDPOINT / S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY  (from the bucket)
   S3_FORCE_PATH_STYLE=false               # true only for MinIO
   LOG_LEVEL=info
   ```
   No `SMTP_URL` in prod.
7. **Domain**: `railway domain` on web (or custom domain — Matt's DNS). Then set `APP_URL` to it and redeploy web.
8. **Backups**: turn on Postgres backups in the Railway dashboard (Postgres service → Backups) and say
   you did. Data people type into a live app must be recoverable.
9. **Verify**: `curl https://<domain>/api/health` → `{"ok":true,"db":"up"}`; open the site in their
   browser (`open https://<domain>`) and create the first account with them; `railway logs --service
   worker` shows `worker.ready`; welcome email arrives (if Resend set).
10. Tell the user the live URL (opened it), who can sign up, and what's pending (e.g. email via
    Matt). Commit any `AGENTS.md` change via `/stack:ship`. Record the live URL in `AGENTS.md`
    under "## Local URLs" as `Live: https://…`.

## Later

- Every `/stack:ship` to `dev` redeploys automatically. Say so once: "each time you send work to
  Matt it also goes live within a few minutes."
- New env var in code → add it to Railway (both services) BEFORE pushing the code that requires it.
- Deploy failing → `railway logs --deployment` for the build/runtime error; health failing → app
  probably can't reach the DB or a required env var is missing (the app prints "Invalid environment
  variables" with the names — read them).
- Migrations run on web start; a failing migration blocks the deploy — read the log, fix forward with a
  new migration.
- Never run destructive DB commands against production. `db:reset` refuses on Railway by design.
