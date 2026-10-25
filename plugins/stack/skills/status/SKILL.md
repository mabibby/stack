---
name: status
description: >
  Explain where a stack project stands, in plain words: what's changed and not yet saved, what's
  saved, which features exist, whether the app is running locally and whether it's online. Use when
  the user asks "where are we?", "what have we done?", "is this saved?", "what's live?", "has it been
  reviewed?", or runs /stack:status.
allowed-tools: Bash, Read
---

# /stack:status — where things stand

Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md`. Read-only: change nothing.

```bash
git fetch origin --quiet 2>/dev/null || echo NO_REMOTE
branch=$(git branch --show-current); echo "branch=$branch"
git status --short
echo "unsent=$(git rev-list --count origin/$branch..HEAD 2>/dev/null || echo '?')"
echo "from_main=$(git rev-list --count $branch..origin/main 2>/dev/null || echo '?')"     # reviewed fixes on main we don't have
echo "unreviewed=$(git rev-list --count origin/main..origin/$branch 2>/dev/null || echo '?')"  # only if they ask about review
git log --oneline -8
ls docs/features 2>/dev/null
gh run list --branch "$branch" --limit 1 --json conclusion,status,displayTitle 2>/dev/null || echo no-ci
app=$(grep -E "^APP_URL=" .env.local | cut -d= -f2); curl -s -m 5 "$app/api/health" >/dev/null && echo "app-running $app" || echo app-not-running
if railway status >/dev/null 2>&1; then railway status | head -5; for s in web worker; do echo "$s: $(railway service status --service $s 2>&1 | head -3 | tr '\n' ' ')"; done; else echo not-linked-to-railway; fi
```

Report as short bullets, translated:
- **Not yet saved** — list the changed areas by feature/page, not file paths ("the workouts screen",
  "the app's settings"). If nothing: "Everything is saved."
- **Saved on this Mac only** (`unsent` > 0) — count + the subjects (from `git log`) in plain words;
  suggest `/stack:ship`. Otherwise: "Everything is saved."
- **Fixes waiting** — only if `from_main` > 0: "There are N fixes waiting; the next save brings them in."
- Review status (`unreviewed`) is not part of the normal report. Only if they ask whether Matt has
  seen it: "N of your saves haven't been reviewed yet" — that's normal and doesn't block anything.
- **Features so far** — from `docs/features/*.md` titles, if any.
- **Running?** — local app up or not (offer `/stack:start`); online or not (offer `/stack:deploy`),
  with the live URL if Railway is linked (`railway domain` / `railway status`).
- **Checks on GitHub** — if the last run failed, that save is NOT live ("the checks caught a problem
  with <subject>; the live site is still on the previous version") and offer to fix it.
- **Live app healthy?** — if linked, both `web` and `worker` must show a successful, running deployment.
  The worker has no public page, so this is the only place a dead worker shows up ("emails and
  background jobs have stopped"). If either is crashed or failed: read `railway logs --service <s>`
  and fix it (`/stack:doctor` logic, then `/stack:ship`); if it's not a code problem, it needs Matt.
