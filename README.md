# stack — Matt's way of building web apps, packaged for Claude Code

One plugin that turns "I want an app that does X" into a working, online product without you making
technology decisions. It bootstraps every app from a proven template and gives Claude Code ten
commands that encode the architecture, the workflow and the guard-rails.

| You say… | Command | Claude does… |
|---|---|---|
| "set up my computer" | `/stack:setup` | installs everything a Mac needs, signs you in to GitHub (once) |
| "new app called fitness-tracker" | `/stack:new-app` | scaffolds it, starts it, saves it to GitHub, proves it works in a browser |
| "start my app" | `/stack:start` | gets it running and opens it in your browser |
| "let users log a workout with a date and notes" | `/stack:feature` | writes a short spec, builds it the standard way, tests it, shows you screenshots |
| "ship it" / "send it to Matt" | `/stack:ship` | runs all checks, saves, sends to Matt (never touches `main`) |
| "where are we?" | `/stack:status` | what's saved, what's sent, what Matt has merged, what's live |
| "undo that" | `/stack:undo` | goes back safely, after telling you what will be lost |
| "we also need to store the gym location" | `/stack:db-change` | changes what the app stores, safely |
| "put it online" | `/stack:deploy` | Railway: web + worker + database + file storage, live URL |
| "it's not working" | `/stack:doctor` | finds and fixes the usual local problems |

You don't have to remember the commands — describe what you want and Claude picks the right one.

## What you get in every app

Bun · TypeScript · Next.js (app router) · Postgres + Drizzle · better-auth (password, email code, magic
link, optional invite-only sign-up) · pg-boss background jobs + worker · Tailwind + shadcn/ui ·
react-hook-form + zod · Biome · Playwright + `bun test` · Docker Compose for local Postgres/MinIO/Mailpit ·
Dockerfile + Railway config · guard-rails against pushing to `main`, force pushes and history rewriting.
A worked example feature ("Notes") shows the pattern; it's removed when you build your first real one.

Architecture and conventions: [`plugins/stack/references/architecture.md`](plugins/stack/references/architecture.md).
How Claude talks to you: [`plugins/stack/references/voice.md`](plugins/stack/references/voice.md).

## First time on a new Mac (about 30 minutes, mostly waiting)

You need: a Mac, a **Claude Max** subscription (Claude Code uses a lot; Pro runs out fast), and an
email address. Everything else is installed for you.

1. **Install Claude Code (desktop app).** https://claude.com/claude-code → download the Mac app, open it,
   sign in with your Claude account.
2. **Install the command-line tools** (this gives us `git`). Press **Cmd+Space**, type `Terminal`, press
   Enter. Paste this and press Enter, then click **Install** in the window that appears:
   ```
   xcode-select --install
   ```
   Wait until it says it finished (5–10 minutes). You can close Terminal.
3. **Install this plugin.** In Claude Code, type each line and press Enter:
   ```
   /plugin marketplace add mabibby/stack
   /plugin install stack@mabibby-stack
   ```
   Quit and reopen Claude Code. Type `/stack:` and you should see the commands.
4. **Let Claude set up the rest.** Type:
   ```
   /stack:setup
   ```
   It installs Node, Bun, Docker Desktop, the GitHub tools and the companion plugins, and walks you
   through signing in to GitHub. When your Mac asks for your password or to click Install, that's
   expected — Claude will tell you what to click each time.
5. Quit and reopen Claude Code one more time (so the new plugins load).

## Your first app

In Claude Code: **File → Open Folder** → choose the `projects` folder in your home folder (setup
created it). Then type:
```
/stack:new-app fitness-tracker
```
Answer the one or two questions. When it says ready, your app is open in your browser at
http://localhost:3000. **Then quit Claude Code and open it again inside the new app's folder**
(File → Open Folder → projects → fitness-tracker). That's how Claude knows which app you're working on.

From then on it's a loop: describe a feature → look at it in your browser → "ship it" → repeat.

## Every day

- **Open Claude Code in the app's folder.** Then "start my app" (or `/stack:start`). It runs while
  the Claude Code window is open.
- Describe what you want in product words: who does it, what they see, what changes. Claude shows a
  short plan; say "go".
- Look at the result in your browser (Claude opens the page and shows screenshots, desktop and phone).
- "Ship it" saves your work and sends it to Matt. "Where are we?" tells you what's saved and sent.
  "Undo that" goes back.
- Something odd? "It's not working" runs the doctor.

## The working agreement

- You build on the **`dev`** branch — every "ship" saves there. Matt reviews and merges into `main`.
  The guard-rails won't let anything here push to `main`, force-push, or rewrite history.
- Each "ship" first brings in anything Matt has changed, so you're always building on his latest.
- Secrets live in `.env.local` (your Mac) and Railway variables (online) — never in the code.
- Every feature ships with a browser test and has been clicked through, on desktop and phone width,
  before it's called done.
- Anything that loses work or data (undo, resetting local test data) is explained first and needs
  your "yes".

## Accounts, money and who does what

| Thing | Who | Notes |
|---|---|---|
| Claude Max | you | Claude Code usage. Pro will run out quickly. |
| GitHub account | you | Free. Apps are private repos under your account; Matt is invited as admin. Tell Matt your username. |
| Docker Desktop | you | Free for small businesses. |
| Railway | you | Needed to put an app online. Hobby plan (paid, a few dollars a month) plus usage. Card required. |
| Domain + email sending (Resend) | Matt | Needs DNS. Until Matt sends you a key, the live app can only sign in with a password (no email codes or links). |
| Merging to `main`, fixing anything the guard-rails block | Matt | |

## When Matt updates the plugin

In Claude Code type `/plugin update stack@mabibby-stack`, then quit and reopen it.

## For Matt: maintaining the template

- The template app is `plugins/stack/template/` (placeholders `__APP_NAME__`, `__APP_TITLE__`,
  `__DB_NAME__`, stamped by `scripts/new-app.sh`). To upgrade dependencies: stamp a copy, `bun update`,
  run `bun run check` + `bun run test:e2e`, copy back `package.json`/`bun.lock` (re-placeholder the
  lockfile name), regenerate `drizzle/` if the auth schema changed.
- Skills: `plugins/stack/skills/*/SKILL.md`. Principles: `plugins/stack/references/`. Guard-rail hook:
  `plugins/stack/hooks/hooks.json` → `scripts/guard.sh` (only active in folders whose `AGENTS.md` carries
  the template marker, so your other repos are untouched). Git-level twin: `template/.githooks/pre-push`.
- Pushing to `main` from a stack project on your own machine: `STACK_ALLOW_MAIN=1 git push origin main`.
- Validate: `claude plugin validate .` · Release: bump `plugin.json` version, commit, push; the partner
  runs `/plugin update`.
- Local dev of the plugin: `/plugin marketplace add /path/to/this/repo` then install `stack@mabibby-stack`.
- Test the whole thing the way the partner will: create a fresh macOS user account and follow only
  "First time on a new Mac" above.
