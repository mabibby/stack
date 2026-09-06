---
name: status
description: >
  Explain where a stack project stands, in plain words: what's changed and not yet saved, what's saved
  but not sent to Matt, what Matt has merged, whether the app is running locally and whether it's
  online. Use when the user asks "where are we?", "what have we done?", "is this saved?", "did Matt
  get it?", "what's live?", or runs /stack:status.
allowed-tools: Bash, Read
---

# /stack:status — where things stand

Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md`. Read-only: change nothing.

```bash
git fetch origin --quiet 2>/dev/null || echo NO_REMOTE
branch=$(git branch --show-current); echo "branch=$branch"
git status --short
echo "unsent=$(git rev-list --count origin/$branch..HEAD 2>/dev/null || echo '?')"
echo "matt_merged=$(git rev-list --count $branch..origin/main 2>/dev/null || echo '?')"   # commits on main we don't have
git log --oneline -8
ls docs/features 2>/dev/null
curl -s -m 5 http://localhost:3000/api/health >/dev/null && echo app-running || echo app-not-running
railway status 2>/dev/null | head -5 || echo not-linked-to-railway
```

Report as short bullets, translated:
- **Not yet saved** — list the changed areas by feature/page, not file paths ("the workouts screen",
  "the app's settings"). If nothing: "Everything is saved."
- **Saved, not yet sent to Matt** — count + the subjects (from `git log`) in plain words.
  If > 0: suggest `/stack:ship`.
- **From Matt** — if main has commits you don't have: "Matt has made N changes you don't have yet;
  `/stack:ship` will bring them in." If main is behind the working branch: "Matt hasn't merged your
  last N changes yet." Compare URL: `https://github.com/<owner>/<repo>/compare/main...<branch>`.
- **Features so far** — from `docs/features/*.md` titles, if any.
- **Running?** — local app up or not (offer `/stack:start`); online or not (offer `/stack:deploy`),
  with the live URL if Railway is linked (`railway domain` / `railway status`).
