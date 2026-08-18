---
name: new-app
description: >
  Start a brand-new web app from the stack template (Bun + Next.js + Postgres/Drizzle + better-auth +
  pg-boss + shadcn, Docker for local infra). Checks the machine has what it needs, scaffolds the project,
  starts local services, runs migrations, sets up git + GitHub with a working branch, and proves it works
  in a browser. Use when the user says "new app", "new project", "start a project", "bootstrap",
  "scaffold", "create an app called…", or runs /stack:new-app.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, mcp__plugin_playwright_playwright__*
---

# /stack:new-app — start a new app

You are setting up a project for someone who is a product person, not a developer. Do the technical
work; explain outcomes in plain words; never dump raw logs on them unless something failed.

Architecture reference (read now, briefly): `${CLAUDE_PLUGIN_ROOT}/references/architecture.md`.

## 1. Gather inputs (ask only for what's missing)

- **App name** — kebab-case (`fitness-tracker`). Derive from what they said; confirm if you invented it.
- **App title** — human name shown in the UI/emails (`Fitness Tracker`).
- **Where** — default: a new folder with the app name inside the current directory. If the current
  directory already contains a project (package.json / .git), ask before nesting.
- **GitHub repo** — ask: "Did Matt give you a GitHub repo URL for this? If not I'll create a private
  one under your account." Accept `https://github.com/owner/name` or `owner/name`.
- **Working branch** — default `dev`. (Matt reviews and merges to `main`; the builder never pushes to `main`.)

## 2. Prerequisite check (fix or explain, don't proceed broken)

Run and interpret:
```bash
docker info >/dev/null 2>&1 && echo docker-ok || echo docker-missing
node --version; bun --version; git --version; gh --version; gh auth status
```
- Node missing or < 20.9 → install Node LTS from https://nodejs.org (or `brew install node`). Next.js runs on
  Node; Bun is the package manager/script runner and runs the worker.
- Docker missing/not running → "Open Docker Desktop and wait until it says Running, then tell me" (if not
  installed: https://www.docker.com/products/docker-desktop/ — install, open once, then come back).
- bun missing → `curl -fsSL https://bun.sh/install | bash` then reopen the terminal.
- gh missing/unauthenticated → `brew install gh` (mac) and `gh auth login` (they must do the browser step).
- Ports 3000/5432/9000/9001/1025/8025 in use? `lsof -nP -iTCP:5432 -sTCP:LISTEN` etc. If another stack
  app's containers hold them, `docker compose down` in that project or edit this project's
  `docker-compose.yml` + `.env.local` ports after scaffolding — explain what you did.

## 3. Scaffold

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/new-app.sh" <app-name> "<App Title>" <destination>
cd <destination>
bun install
bun run setup            # docker compose up, migrate, seed, writes .env.local
bunx playwright install chromium
```
`bun run setup` is idempotent — if it fails partway (usually Docker still starting), fix and re-run.

## 4. Git + GitHub

```bash
git init -b main
git add -A && git commit -m "chore: bootstrap <app-name> from stack template"
# existing repo URL:  git remote add origin <url>
# else:               gh repo create <app-name> --private --source=. --remote=origin
#                     gh api -X PUT repos/<owner>/<app-name>/collaborators/mabibby -f permission=admin   # invite Matt
git push -u origin main
git switch -c <working-branch> && git push -u origin <working-branch>
```
Then record the working branch in `AGENTS.md`: append a line under "## Rules":
`- **Working branch:** \`<working-branch>\` — all commits go here; Matt merges to \`main\`.`
Commit that on the working branch and push.

If a repo URL was provided and the push is rejected (no access), stop and tell them to ask Matt for
write access — do not try to create a different repo.

## 5. Prove it works

1. Start `bun run dev` (background) and `bun run dev:worker` (background).
2. `curl -s http://localhost:3000/api/health` → expect `{"ok":true,"db":"up"}`.
3. Playwright MCP: open http://localhost:3000, click **Create account**, sign up with a made-up
   email, land on the dashboard, take a screenshot. Open http://localhost:8025 and confirm the welcome
   email arrived (proves the worker + mail path).
4. Run `bun run test:e2e` — must pass.
If anything fails, fix it (this is a known-good template; failures are almost always environment:
Docker not ready, a port clash, or a stale `.env.local`). Use `/stack:doctor` logic.

## 6. Hand over (say this in plain words)

- Where the project lives; that it's pushed to GitHub on branch `<working-branch>`.
- The URLs: app http://localhost:3000, emails http://localhost:8025, files http://localhost:9001,
  database `bun run db:studio`.
- Day-to-day: "run `bun run dev` and `bun run dev:worker` in two terminals (or ask me to)". To build
  something: `/stack:feature <what you want>`. To save & push: `/stack:ship`. Something off:
  `/stack:doctor`. To put it on the internet: `/stack:deploy`.
- The example **Notes** feature exists to be copied and then deleted.

Leave the dev servers running.
