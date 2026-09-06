---
name: new-app
description: >
  Start a brand-new web app from the stack template (Bun + Next.js + Postgres/Drizzle + better-auth +
  pg-boss + shadcn, Docker for local infra). Scaffolds the project with its own port slot, starts local
  services, runs migrations, sets up git + GitHub with a working branch, and proves it works in a
  browser. Use when the user says "new app", "new project", "start a project", "bootstrap",
  "scaffold", "create an app called…", or runs /stack:new-app.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, mcp__plugin_playwright_playwright__*
---

# /stack:new-app — start a new app

You are setting up a project for a product person, not a developer. Do the technical work; explain
outcomes in plain words (`${CLAUDE_PLUGIN_ROOT}/references/voice.md`); never dump raw logs unless
something failed. Architecture (skim): `${CLAUDE_PLUGIN_ROOT}/references/architecture.md`.

The heavy lifting lives in the `stack` command (`${CLAUDE_PLUGIN_ROOT}/../../bin/stack`, installed
by Matt's installer as `stack`). It creates the folder in `~/projects`, assigns a **port slot** so
several apps can run at once, installs, starts Docker services, sets up git + GitHub (private repo
under the user's account, Matt invited as admin), and creates the `dev` branch.

## 1. Inputs (ask only for what's missing)

- **App name** — kebab-case (`fitness-tracker`). Derive from what they said; confirm if you invented it.
- **App title** — human name (`Fitness Tracker`). Derive from the name unless they gave one.
- **GitHub repo** — only ask if they mention Matt gave them one. Default: create under their account.

## 2. Create

```bash
command -v stack >/dev/null && echo has-stack-cli || echo NO_STACK_CLI
```
- **has-stack-cli** → `stack new <app-name> "<App Title>"`. It's non-interactive once GitHub is signed
  in. If it stops with a ✘ message, fix that one thing (Docker not running → `open -a Docker`, wait;
  GitHub not signed in → `/stack:setup`) and re-run.
- **NO_STACK_CLI** (Matt's own machine, or the installer wasn't run) → do the same steps by hand:
  ```bash
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/new-app.sh" <app-name> "<App Title>" ~/projects/<app-name>
  cd ~/projects/<app-name> && bun install && bun run setup && bunx playwright install chromium
  git init -b main && git config core.hooksPath .githooks
  git add -A && git commit -m "chore: bootstrap <app-name> from stack template"
  gh repo create <app-name> --private --source=. --remote=origin      # or: git remote add origin <url Matt gave>
  gh api -X PUT repos/<owner>/<app-name>/collaborators/mabibby -f permission=admin   # skip if owner is mabibby
  STACK_ALLOW_MAIN=1 git push -u origin main                          # the ONE allowed push to main
  git switch -c dev && echo '- **Working branch:** `dev` — all commits go here; Matt merges to `main`.' >> AGENTS.md
  git add AGENTS.md && git commit -m "docs: record working branch" && git push -u origin dev
  ```
  Repo URL provided but push rejected → stop and tell them to ask Matt for write access.

The app's URLs are in its `AGENTS.md` → "Local URLs" (the port slot). Read them; never assume 3000.

## 3. Prove it works

```bash
cd ~/projects/<app-name>
grep -A2 "## Local URLs" AGENTS.md
```
1. Start `bun run dev` (background — web + worker together). Poll `<app-url>/api/health` until `"ok":true`.
2. Playwright MCP: open the app URL, click **Create account**, sign up with a made-up email, land on
   the dashboard, screenshot it and `Read` the screenshot. Open the Mailpit URL and confirm the
   welcome email arrived (proves the worker + mail path).
3. `bun run test:e2e` — must pass.
Failures here are almost always environment (Docker not ready, stale `.env.local`) → `/stack:doctor` logic.

## 4. Hand over (plain words, and do the `open`)

```bash
open <app-url>
```
- "**<App Title>** is ready and open in your browser at <app-url>. It's saved privately on GitHub
  and Matt's been invited."
- **If Claude Code is not already open inside the app's folder** (check: `pwd` ≠ the app folder):
  "Now quit Claude Code and open it inside the app: in Terminal, `cd ~/projects/<app-name>` then
  `claude`. That's how I know which app we're working on." Not optional.
- Then: describe a feature to build (`/stack:feature`) · "ship it" to save & send to Matt ·
  "start my app" next time · "where are we?" · "undo that" · "it's not working" · "put it online".
- Emails the app sends land at <mailpit-url>. The example **Notes** screen shows the pattern and
  goes away with the first real feature.
