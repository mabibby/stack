# stack — Matt's way of building web apps, packaged for Claude Code

One toolkit that turns "I want an app that does X" into a working, online product without you making
technology decisions. A `stack` command in Terminal creates apps; inside Claude Code, ten commands
encode the architecture, the workflow and the guard-rails.

## First time on a new Mac (10–30 minutes, mostly waiting)

You need a Mac, a **Claude Max** subscription (Claude Code uses a lot; Pro runs out fast), and a
GitHub account (free: https://github.com/signup). Everything else is installed for you.

1. Open **Terminal**: press **Cmd + Space**, type `Terminal`, press **Enter**.
2. Copy this whole line, paste it into Terminal, press **Enter**:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/mabibby/stack/main/install.sh)"
   ```
   It installs everything and tells you what it's doing. Expect these moments:
   - **"Password:"** — type your Mac login password (nothing appears while you type) and press Enter.
   - **A window about command-line tools** — click **Install**, then **Agree**, and wait.
   - **Docker Desktop opens** — click **Accept**, then **Finish** / the recommended settings. Skip sign-in.
   - **GitHub sign-in** — press Enter, a browser opens; type the 8-character code Terminal shows, click **Authorize**.
   When it prints **✅ This Mac is ready**, quit Terminal (**Cmd + Q**) and open it again.
3. Sign in to Claude Code once: type `claude`, press Enter, follow the sign-in, then type `/exit`.
4. Tell Matt your GitHub username (the installer printed it).

## Create an app

In Terminal:
```
stack new my-first-app
```
(lowercase, hyphens for spaces). It creates the folder `~/projects/my-first-app`, gives the app its
own ports, starts the local database, saves it privately on GitHub and invites Matt. It ends with
two lines to copy-paste:
```
cd ~/projects/my-first-app
claude
```
The first time, Claude Code asks whether you **trust this folder** — choose **Yes** (it's your app;
saying no makes Claude ask permission for every step). Then say **"start my app"** — it opens in your
browser. From there, describe features.

## Every day

Open Terminal, then:
```
cd ~/projects/my-first-app
claude
```
Inside Claude Code, talk in product words. You don't need to remember commands; Claude picks them.

| You say… | Command | Claude does… |
|---|---|---|
| "start my app" | `/stack:start` | gets it running and opens it in your browser |
| "let users log a workout with a date and notes" | `/stack:feature` | writes a short plan, builds it the standard way, tests it, shows you screenshots (desktop + phone) |
| "ship it" / "save this" | `/stack:ship` | brings in any fixes, runs all checks, saves to GitHub (never touches `main`) |
| "where are we?" | `/stack:status` | what's saved, which features exist, what's running, what's live |
| "undo that" | `/stack:undo` | goes back safely, after telling you what will be lost |
| "we also need to store the gym location" | `/stack:db-change` | changes what the app stores, safely |
| "put it online" | `/stack:deploy` | Railway: web + worker + database + file storage, live URL |
| "it's not working" | `/stack:doctor` | finds and fixes the usual local problems |
| "new app called …" | `/stack:new-app` | same as `stack new`, from inside Claude |
| "is my Mac set up?" | `/stack:setup` | checks, and re-runs the installer if needed |

In Terminal: `stack ls` (your apps, their web addresses, which are running) · `stack new <name>` ·
`stack update` (when Matt says there's a new version) · `stack doctor`.

## Several apps at once

Each app gets its own set of ports when it's created (the "slot" in `stack ls`), so two apps can run
side by side with no clashes. Each has its own web address (`http://localhost:3000`, `3001`, …) and
its own inbox for the emails it sends (`http://localhost:8025`, `8026`, …). Claude reads these from
the app's `AGENTS.md`, so you never need to know them.

## What you get in every app

Bun · TypeScript · Next.js (app router) · Postgres + Drizzle · better-auth (password, email code, magic
link, optional invite-only sign-up) · pg-boss background jobs + worker · Tailwind + shadcn/ui ·
react-hook-form + zod · Biome · Playwright + `bun test` · Docker Compose for local Postgres/RustFS/Mailpit ·
one `bun run dev` for web + worker · Dockerfile + Railway config · guard-rails against pushing to
`main`, force pushes and history rewriting. A worked example feature ("Notes") shows the pattern; it's
removed when you build your first real one.

Architecture and conventions: [`plugins/stack/references/architecture.md`](plugins/stack/references/architecture.md).
How Claude talks to you: [`plugins/stack/references/voice.md`](plugins/stack/references/voice.md).

## The working agreement

- You build on the **`dev`** branch — every "ship" saves there. Matt reviews and merges into `main`.
  The guard-rails won't let anything here push to `main`, force-push, or rewrite history.
- Each "ship" first brings in anything Matt has changed, so you're always building on his latest.
- Secrets live in `.env.local` (your Mac) and Railway variables (online) — never in the code.
- Every feature ships with a browser test and has been clicked through, on desktop and phone width,
  before it's called done.
- Anything that loses work or data (undo, resetting local test data) is explained first and needs your "yes".

## Accounts, money and who does what

| Thing | Who | Notes |
|---|---|---|
| Claude Max | you | Claude Code usage. Pro will run out quickly. |
| GitHub account | you | Free. Apps are private repos under your account; Matt is invited as admin. |
| Docker Desktop | you | Free for small businesses. Installed for you. |
| Railway | you | Needed to put an app online. Hobby plan (a few dollars a month) plus usage. Card required. |
| Domain + email sending (Resend) | Matt | Needs DNS. Every new account confirms its email with a code, so until Matt sends the key nobody can sign up on the live app. |
| Merging to `main`, anything the guard-rails block | Matt | |

## When Matt updates the toolkit

In Terminal: `stack update`. Then quit and reopen Claude Code.

## For Matt: maintaining the template

- Layout: `install.sh` (one-line Mac setup; clones this repo to `~/.stack/repo`, links `bin/stack` into
  `~/.local/bin`, adds the marketplace from that clone) · `bin/stack` (new/ls/update/doctor) ·
  `plugins/stack/scripts/new-app.sh` (stamps the template, assigns a port slot, records it in
  `~/.stack/apps.tsv`) · `plugins/stack/template/` (placeholders `__APP_NAME__`, `__APP_TITLE__`,
  `__DB_NAME__`, `__PORT_SLOT__`, `__PORT_WEB__`, `__PORT_PG__`, `__PORT_S3__`,
  `__PORT_S3_CONSOLE__`, `__PORT_SMTP__`, `__PORT_MAIL__`; slot k = 3000+k, 5432+k, 9000+2k, 9001+2k,
  1025+k, 8025+k) · skills in `plugins/stack/skills/*/SKILL.md` · principles in `plugins/stack/references/`.
- Guard-rail hook: `plugins/stack/hooks/hooks.json` → `scripts/guard.sh` (only active in folders whose
  `AGENTS.md` carries the template marker). Git-level twin: `template/.githooks/pre-push`. Pushing to
  `main` from a stack project on your own machine: `STACK_ALLOW_MAIN=1 git push origin main`.
- Session rules: the SessionStart hook (`scripts/versions.ts --hook`) injects
  `references/session-rules.md` + `references/voice.md` into every session in a stack project, so
  changing how Claude behaves (voice, when to mention you, versions) reaches existing apps on
  `stack update` — no need to edit their `AGENTS.md`. Keep repo facts in the template `AGENTS.md`.
- Biome formats Markdown and rewrites `__PLACEHOLDER__` as `**PLACEHOLDER**`; `new-app.sh` accepts
  both and refuses to finish if any placeholder is left unfilled.
- Live apps: GitHub Actions CI gates Railway
  deploys ("Wait for CI"); email (Resend) is required for anyone to sign up, since every account
  confirms its address with a code.
- Keep the template on the latest stable everything (new apps start current, so their first session
  doesn't open with an upgrade): `bun plugins/stack/scripts/versions.ts --dir plugins/stack/template`
  shows what's behind. To upgrade: stamp a copy (`new-app.sh <n> "<T>" <dir>` with `STACK_REGISTRY=/tmp/x`),
  follow `plugins/stack/skills/upgrade/SKILL.md` in it (check + setup + e2e + `docker build`), then copy
  back `package.json`/`bun.lock` (re-placeholder `name` and the `dev:web` port), `biome.json`,
  `src/components/ui/`, and anything the upgrade touched; run that copy's `node_modules/.bin/biome check
  --write .` inside `plugins/stack/template`. If the auth schema changed, regenerate `drizzle/` as a fresh
  `0000_init` (existing apps get their own migration via `/stack:upgrade`).
- Validate: `claude plugin validate .` · Release: bump `plugin.json` version, commit, push to `main`;
  the partner runs `stack update`.
- Your own machine: `/plugin marketplace add /path/to/this/repo`, or run `install.sh` with
  `STACK_REPO_URL=/path/to/this/repo` to get the `stack` command against your working copy.
- Test like the partner: a fresh macOS user account, following only "First time on a new Mac".
