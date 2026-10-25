---
name: deploy
description: >
  Put a stack project on the internet with Railway, from the app's `.railway/railway.ts` (web + worker
  from the GitHub repo, Postgres, a bucket, every setting and variable as code). Also adopts an app
  that is already on Railway into that file, changes live settings, redeploys and reads production
  logs. Use when the user says "deploy", "go live", "put it online", "production", "Railway", "it's
  broken in prod", or runs /stack:deploy.
allowed-tools: Bash, Read, Edit, Glob, Grep, AskUserQuestion, WebFetch, Skill, mcp__claude_ai_Railway__*, mcp__plugin_railway_railway__*
---

# /stack:deploy — Railway, as code

Load the Railway skill if available (`Skill: railway:use-railway` or `use-railway`) — it knows the CLI
and MCP details. This file is the *what*. Talk to the user per `${CLAUDE_PLUGIN_ROOT}/references/voice.md`:
to them this is "putting it online".

**The live setup is `.railway/railway.ts`** (Railway Infrastructure as Code, SDK `railway/iac`). It
declares web + worker (same Dockerfile), Postgres, the bucket, the live branch (`dev`), "Wait for CI"
(`checkSuites`), migrations as web's pre-deploy step, the worker's restart policy, and every variable.
`railway config plan` diffs it against Railway; `railway config apply` makes Railway match.
Never click settings into the dashboard and never `railway variables --set` anything except the
secrets below — change the file, plan, apply. (`railway.toml` files are the old, deprecated way:
Railway stops reading them on 2026-12-01; see "Adopt".)

**Safety rule: a plan that says anything "to destroy" (or removes a variable) is never applied.**
Railway matches resources by name, so a wrong name in the file means "delete the live one and make a
new one" — database included. Stop, fix the file until the plan has nothing to destroy. The guard
hook blocks `--confirm-destructive`; if something genuinely must be deleted, that needs Matt.

Prereqs every time: `railway --version` ≥ 5.63 (else `brew upgrade railway` / `bun install -g
@railway/cli`); `railway whoami` (else sign-in is interactive: `osascript -e 'tell application
"Terminal" to do script "railway login"'`, tell them to press Enter and click **Authorize**; they need
a Railway account with a card — https://railway.com). `node_modules/railway` present (`bun install`).

## Is this app already on Railway?

`railway status` in the app folder. Linked → **Later** (or **Adopt** if there's no `.railway/railway.ts`,
or `railway config plan` says a service is "managed by railway.toml"). Not linked → ask "Is this app
already online somewhere?" Yes → `railway link` to that project, then **Adopt**. No → **First deploy**.

## First deploy

Ask both at once:
1. **Who should be able to create an account?** "Anyone who finds the site" or "only people I list".
   Recommend the second for anything that isn't a public product. Make sure their own email is on it.
2. Email: every new account confirms its address with an emailed code, so the live app needs
   `RESEND_API_KEY` and a verified sending address (domain + Resend — Matt sets those up). Don't ask;
   check whether they have the key. If not: deploy anyway, say once that "nobody can create an account
   until the email key from Matt is in".

Then:
1. Repo on GitHub and saved (`/stack:ship`). Fill the top of `.railway/railway.ts`:
   `GITHUB_REPO` = `gh repo view --json nameWithOwner -q .nameWithOwner`; `SIGNUP_ALLOWLIST` from
   question 1; `EMAIL_FROM` = `"<App Title> <hello@their-domain>"` (keep the placeholder until Matt
   gives the domain). Leave `NAMES`, regions and `KEEP_EXISTING` as they are.
2. `railway init --name <app-name>` (creates + links the project).
3. `railway config plan` → must be "4 to add" (Postgres, bucket, web, worker) and nothing else.
   `railway config apply --yes`.
4. Secrets (the only variables set by hand — they never go in the file), on BOTH services:
   `railway variables --service web --set "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" --skip-deploys`
   and the same value on `worker` (generate once, reuse for both). `RESEND_API_KEY` the same way when
   they have it. Never echo secrets back.
5. Address: `railway domain --service web` (a custom domain instead: put it in `CUSTOM_DOMAIN`, plan,
   apply, and the DNS is Matt's side).
6. Deploy: `railway redeploy --service web --yes` and `--service worker` (or push via `/stack:ship`;
   with `checkSuites` on, Railway waits for the GitHub Actions run to pass first).
7. Bucket CORS, once: `railway run --service web bun run storage:setup` (allows uploads from the live
   address only).
8. Backups: Postgres → Backups in the dashboard (`railway open`) — the one setting the file can't hold.
9. **Verify**: `curl https://<domain>/api/health` → `{"ok":true,"db":"up"}`; `railway logs --service web`
   shows "migrations applied"; `railway logs --service worker` shows `worker.ready`;
   `railway config plan` → "already up to date". Open the site (`open https://<domain>`) and create the
   first account with them.
10. Save (`/stack:ship`, "feat(deploy): put the app online") — the file now records the live setup. Add
    `Live: https://…` under "## Local URLs" in `AGENTS.md`. Tell them the live URL, who can sign up, and
    anything not working yet.

## Adopt — an app already on Railway, without (or with an old) `.railway/railway.ts`

Goal: wrap the file around what's live **without changing anything people would notice**. Nothing is
created or deleted; the only changes allowed are the template's improvements (pre-deploy migrations,
worker restart policy, "Wait for CI", the source branch).

1. Read what's live, into a scratch file (it reads Railway, writes only locally):
   `railway config pull --variables=managed --force && mv .railway/railway.ts .railway/pulled.ts.txt`
   Note from it: every resource's name (the web service is often named after the repo, not `web`), the
   bucket's and database's `region`, and every variable on the services.
2. Start from the template: if the app has no `.railway/railway.ts`, copy
   `${CLAUDE_PLUGIN_ROOT}/template/.railway/railway.ts` (replace `__APP_TITLE__`/`__APP_NAME__`) and
   `bun add -d railway@latest`. Fill the top from the pull and the live values
   (`railway variables --service <web> --kv`, never print secret values to the user):
   - `NAMES` = the live names; `BUCKET_REGION`, `DB_REGION` = the live regions.
   - `EMAIL_FROM`, `SIGNUP_ALLOWLIST`, `CUSTOM_DOMAIN` = what's live now. `GITHUB_REPO` / `LIVE_BRANCH` =
     the repo and branch the services deploy from now.
   - `KEEP_EXISTING` = every live variable the template doesn't define (they stay untouched).
   - Anything in the pull the template has no slot for (an extra service, a volume mounted on a
     service, a second bucket): stop — that needs Matt.
3. Old `railway.toml` / `railway.worker.toml` in use? (`railway config migrate status`, or the plan
   refuses with "managed by railway.toml".) Then `railway config migrate cutover` — switches the
   services off those files (reversible: `railway config migrate undo`) — and go straight on to step 4
   without pushing anything in between.
4. `railway config plan --verbose`. Acceptable: **0 to add, 0 to destroy**, changes only to
   `preDeployCommand`/`startCommand` (migrations move to pre-deploy), the worker's `restartPolicyType`,
   `source` (`checkSuites`/branch). Variables must show no changes — the file's references produce the
   same values. Anything else → fix the file (usually a name, a region or a missing `KEEP_EXISTING`
   entry) and plan again. Can't get there → stop; it needs Matt.
5. `railway config apply --yes`, then `railway config plan` → "already up to date".
6. Redeploy both so the new settings take effect (`railway redeploy --service <name> --yes`); verify as
   in First deploy → 9. Delete `railway.toml` and `railway.worker.toml` from the repo, `rm
   .railway/pulled.ts.txt`, save (`/stack:ship`, "chore(deploy): manage Railway as code").
7. Tell the user one line: "Your live app's setup is now saved with the app — nothing about it changed."

## Later

- **Any live change = edit `.railway/railway.ts` → `railway config plan` → apply** (only when nothing is
  destroyed): who can sign up (`SIGNUP_ALLOWLIST`), a new setting (add to `env` — and to `src/lib/env.ts`
  and `.env.example`) BEFORE pushing the code that needs it, a custom domain, a new service. Save the
  file with the change.
- Drift check (`/stack:status` runs it): `railway config plan --detailed-exit-code` exits 2 when Railway
  no longer matches the file — someone changed it in the dashboard. Show what differs; apply the file
  (if nothing is destroyed) or, if the dashboard change was deliberate, copy it into the file.
- Every `/stack:ship` to `dev` redeploys once CI passes. Say so once: "from now on, each time you save,
  it goes live a few minutes later — after the checks pass."
- A deployment stuck on "DEPLOYING" for 10+ minutes with no app logs after the pre-deploy step →
  `railway redeploy --service <name> --yes` once (seen in testing; Railway-side, the next one went
  through). Still stuck → it needs Matt.
- Deploy failing → `railway logs --deployment` for the build/runtime error; health failing → the app
  can't reach the DB or a required setting is missing (the log says "Invalid environment variables"
  with the names). A failed pre-deploy (migration) keeps the previous version live: read its log, fix
  forward with a new migration.
- Never run destructive DB commands against production. `db:reset` refuses on Railway by design.
