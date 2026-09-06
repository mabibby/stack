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

```bash
test -f package.json && grep -q '"setup"' package.json || echo NOT_A_STACK_PROJECT
docker info >/dev/null 2>&1 || echo DOCKER_NOT_RUNNING
curl -s -m 5 http://localhost:3000/api/health || echo APP_DOWN
```

- **NOT_A_STACK_PROJECT** → "Claude Code isn't open in an app folder." Tell them to open the app's
  folder (File → Open Folder → `projects/<app>`), or `/stack:new-app` to make one.
- **DOCKER_NOT_RUNNING** → `open -a Docker`, poll `docker info` every 5 s for 2 minutes. Tell them
  the whale icon in the menu bar should stop animating.
- Then `bun run setup` (idempotent: starts Postgres/MinIO/Mailpit, migrates, seeds, stops another
  stack app if it holds the ports — say so if it did).
- **APP_DOWN** → start `bun run dev` in the background (it runs web + worker together). Wait until
  `curl -s http://localhost:3000/api/health` returns `"ok":true` (poll every 2 s, up to 90 s). If it
  never comes up, read the dev output for the real error and switch to `/stack:doctor` logic.
- Already up → say so and just open it.

Finish:
```bash
open http://localhost:3000
```
Take a Playwright screenshot of the landing page and `Read` it. Then one paragraph: "Your app is
running at http://localhost:3000 (opened it for you). Emails the app sends land at
http://localhost:8025. It keeps running while this Claude Code window is open; if you close it,
run /stack:start again." Mention `/stack:feature` for building and `/stack:ship` for saving.
