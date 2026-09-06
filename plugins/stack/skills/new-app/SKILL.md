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
work; explain outcomes in plain words (`${CLAUDE_PLUGIN_ROOT}/references/voice.md`); never dump raw
logs on them unless something failed. Architecture reference (skim now):
`${CLAUDE_PLUGIN_ROOT}/references/architecture.md`.

## 1. Gather inputs (ask only for what's missing)

- **App name** — kebab-case (`fitness-tracker`). Derive from what they said; confirm if you invented it.
- **App title** — human name shown in the UI/emails (`Fitness Tracker`).
- **Where** — `~/projects/<app-name>` unless they're clearly somewhere else on purpose. If the current
  directory already contains a project (package.json / .git), don't nest — use `~/projects/<app-name>`.
- **GitHub repo** — ask: "Did Matt give you a GitHub link for this app? If not I'll create a private
  one under your GitHub account and invite him." Accept `https://github.com/owner/name` or `owner/name`.
- **Working branch** — `dev`. Don't ask. (Matt reviews and merges to `main`; the builder never pushes to `main`.)

## 2. Prerequisite check (fix or explain, don't proceed broken)

```bash
docker info >/dev/null 2>&1 && echo docker-ok || echo docker-missing
node --version; bun --version; git --version; gh --version | head -1; gh auth status 2>&1 | head -1
```
Anything missing → run the `/stack:setup` steps for that item (Docker not running: `open -a Docker`,
wait for `docker info`). Ports 3000/5432/9000/9001/1025/8025 held by another stack app are handled by
`bun run setup` (it stops that app's containers and says so).

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
git config core.hooksPath .githooks          # guard-rails: no pushes to main, no force pushes
git add -A && git commit -m "chore: bootstrap <app-name> from stack template"
# existing repo URL:  git remote add origin <url>
# else:               gh repo create <app-name> --private --source=. --remote=origin
#                     gh api -X PUT repos/<owner>/<app-name>/collaborators/mabibby -f permission=admin   # invite Matt
STACK_ALLOW_MAIN=1 git push -u origin main   # the ONE allowed push to main: the empty bootstrap
git switch -c dev && git push -u origin dev
```
Then record the working branch in `AGENTS.md`: append a line under "## Rules":
`- **Working branch:** \`dev\` — all commits go here; Matt merges to \`main\`.`
Commit that on `dev` and push.

If a repo URL was provided and the push is rejected (no access), stop and tell them to ask Matt for
write access — do not try to create a different repo.

## 5. Prove it works

1. Start `bun run dev` (background — runs web + worker together).
2. `curl -s http://localhost:3000/api/health` → expect `{"ok":true,"db":"up"}`.
3. Playwright MCP: open http://localhost:3000, click **Create account**, sign up with a made-up
   email, land on the dashboard, screenshot it and `Read` the screenshot. Open http://localhost:8025
   and confirm the welcome email arrived (proves the worker + mail path).
4. Run `bun run test:e2e` — must pass.
If anything fails, fix it (this is a known-good template; failures are almost always environment:
Docker not ready, a port clash, or a stale `.env.local`). Use `/stack:doctor` logic.

## 6. Hand over (say this in plain words, and do the `open`)

```bash
open http://localhost:3000
```
- "Your app **<App Title>** lives in the folder `~/projects/<app-name>` and is saved on GitHub
  (private, Matt invited). It's open in your browser at http://localhost:3000."
- **The one thing they must do now:** "Quit Claude Code and open it again **inside that folder**
  (File → Open Folder → projects → <app-name>). That's how I know which app we're working on."
  This is not optional: the app's rules and permissions only load from inside its folder.
- Then: `/stack:feature <what you want>` to build · `/stack:ship` to save & send to Matt ·
  `/stack:start` to get it running again · `/stack:status` to see where things stand ·
  `/stack:undo` to go back · `/stack:doctor` if something's off · `/stack:deploy` to put it online.
- Emails the app sends land at http://localhost:8025. The example **Notes** screen exists to show the
  pattern; it will be removed when the first real feature is built.
