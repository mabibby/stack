---
name: start
description: >
  Start a stack project on this machine and open it in the browser: Docker services up, database
  migrated, web app + background worker running, health verified. Use when the user says "start my
  app", "run it", "open the app", "is it running?", "turn it on", or runs /stack:start. For things
  that are broken, /stack:doctor.
allowed-tools: Bash, Read, mcp__plugin_playwright_playwright__*
---

# /stack:start — get the app running and in front of them

Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md`. Outcome: the app is open in their browser.
Every app has its own ports — read them, never assume 3000:

```bash
test -f package.json && grep -q '"setup"' package.json || echo NOT_A_STACK_PROJECT
grep -A2 "## Local URLs" AGENTS.md
app=$(grep -E "^APP_URL=" .env.local 2>/dev/null | cut -d= -f2); echo "app=$app"
docker info >/dev/null 2>&1 || echo DOCKER_NOT_RUNNING
curl -s -m 5 "$app/api/health" || echo APP_DOWN
```

- **NOT_A_STACK_PROJECT** → "Claude Code isn't open in an app folder." Tell them: in Terminal,
  `cd ~/projects/<app>` then `claude` (`stack ls` lists their apps), or `/stack:new-app` to make one.
- **DOCKER_NOT_RUNNING** → `open -a Docker`, poll `docker info` every 5 s for 2 minutes. Tell them
  the whale icon in the menu bar should stop animating.
- No `.env.local` or containers not up → `bun run setup` (idempotent: starts Postgres/RustFS/Mailpit on
  this app's ports, migrates, seeds).
- **APP_DOWN** → start `bun run dev` in the background (web + worker together). Poll
  `curl -s "$app/api/health"` every 2 s, up to 90 s, until `"ok":true`. If it never comes up, read the
  dev output for the real error and switch to `/stack:doctor` logic.
- Already up → say so and just open it.

Finish:
```bash
open "$app"
```
Take a Playwright screenshot of the landing page and `Read` it. Then one paragraph: "Your app is
running at <app-url> (opened it for you). Emails the app sends land at <mailpit-url>. It keeps
running while this Claude Code window is open; if you close it, say 'start my app' again."
Mention describing a feature to build, and "ship it" for saving.
