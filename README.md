# stack — Matt's way of building web apps, packaged for Claude Code

One plugin that turns "I want an app that does X" into a working, deployed product without you making
technology decisions. It bootstraps a project from a proven template and gives Claude Code six
commands that encode the architecture, the workflow and the guard-rails.

| Command | You say… | Claude does… |
|---|---|---|
| `/stack:new-app` | "new app called fitness-tracker" | checks your machine, scaffolds, starts local services, sets up GitHub, proves it works in a browser |
| `/stack:feature` | "let users log a workout with a date and notes" | writes a 15-line spec, builds it end-to-end the standard way, tests it, shows you a screenshot |
| `/stack:ship` | "ship it" | lint + types + tests, conventional commit, push to your working branch (never main, never force) |
| `/stack:db-change` | "we also need to store the gym location" | changes the data model via a reviewed migration |
| `/stack:deploy` | "put it online" | Railway: web + worker + Postgres + bucket, env vars, domain, health check |
| `/stack:doctor` | "it's not working" | finds and fixes the usual local-dev problems |

## What you get in every app

Bun · TypeScript · Next.js (app router) · Postgres + Drizzle · better-auth (password, email code, magic
link) · pg-boss background jobs + worker · Tailwind + shadcn/ui · react-hook-form + zod · Biome ·
Playwright + `bun test` · Docker Compose for local Postgres/MinIO/Mailpit · Dockerfile + Railway config.
A worked example feature ("Notes") shows the pattern; delete it once you have real ones.

Architecture and conventions: [`plugins/stack/references/architecture.md`](plugins/stack/references/architecture.md).

## Install (once, ~10 minutes)

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop/ — install, open it, leave it running.
2. **Node.js LTS** — https://nodejs.org (the "LTS" download). Next.js runs on Node.
3. **Bun** — in Terminal: `curl -fsSL https://bun.sh/install | bash` then open a new Terminal window.
4. **Git + GitHub CLI** — `brew install git gh` (install [Homebrew](https://brew.sh) first if `brew` is missing), then `gh auth login` and follow the browser steps.
5. **Claude Code** — https://docs.claude.com/en/docs/claude-code/overview (`npm i -g @anthropic-ai/claude-code` or the desktop app), then run `claude` once and sign in.
6. **This plugin** — inside `claude`:
   ```
   /plugin marketplace add mabibby/stack
   /plugin install stack@mabibby-stack
   ```
   Restart Claude Code. Type `/stack:` and you should see the six commands.
7. Recommended companions (inside `claude`): `/plugin install playwright@claude-plugins-official`
   (lets Claude click through your app), `/plugin install context7@claude-plugins-official`
   (up-to-date library docs), and the Railway plugin when you deploy.

## Your first app

```
cd ~/projects
claude
/stack:new-app fitness-tracker
```
Answer the two or three questions (title, GitHub repo, working branch). When it says ready, open
http://localhost:3000. Then: `/stack:feature <what you want>` … `/stack:ship` … repeat.

## The working agreement

- You build on the **working branch** (default `dev`) — every `/stack:ship` pushes there.
- Matt reviews and merges to `main`. You never push to `main`, never force-push, never rewrite history.
- Secrets live in `.env.local` (local) and Railway variables (prod) — never in git.
- Every feature ships with a browser test and has been clicked through before it's called done.

## For Matt: maintaining the template

- The template app is `plugins/stack/template/` (placeholders `__APP_NAME__`, `__APP_TITLE__`,
  `__DB_NAME__`, stamped by `scripts/new-app.sh`). To upgrade dependencies: stamp a copy, `bun update`,
  run `bun run check` + `bun run test:e2e`, copy back `package.json`/`bun.lock` (re-placeholder the
  lockfile name), regenerate `drizzle/` if the auth schema changed.
- Skills live in `plugins/stack/skills/*/SKILL.md`; principles in `plugins/stack/references/`.
- Validate: `claude plugin validate .` · Release: bump `plugin.json` version, `claude plugin tag plugins/stack`.
- Local dev of the plugin: `/plugin marketplace add /path/to/this/repo` then install `stack@mabibby-stack`.
