---
name: undo
description: >
  Take a stack project back to a previous state safely: throw away work since the last save, or undo
  the last save(s) by reverting them. Never rewrites history that has been pushed. Use when the
  user says "undo", "go back", "put it back how it was", "I didn't want that", "scrap that", "revert",
  or runs /stack:undo.
allowed-tools: Bash, Read, AskUserQuestion
---

# /stack:undo — go back, safely

Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md`. This is the one skill that deliberately
loses work, so **always show what will be lost and get a yes** before doing it.

## 1. What do they mean?

```bash
git status --short
git log --oneline -5
git rev-list --count origin/$(git branch --show-current)..HEAD 2>/dev/null
```
Two situations — pick from context, ask only if unclear (one question, two options):
- **A. Unsaved work since the last save** (`git status` shows changes) → they usually mean "throw
  away what we just did". Describe it as features/screens, not files.
- **B. The last save(s)** (clean tree, they want an earlier state) → revert one or more commits.
  Show the last few saves as a numbered list in plain words and ask which point to go back to.

Never use `git reset --hard`, never rewrite anything that's been pushed (the guard-rails block it anyway).

## 2A. Throw away unsaved work

Say: "This will remove <plain list>. Your last save (<subject>) stays. OK?" On yes:
```bash
git restore --staged . && git restore . && git clean -fd
```
If the discarded work included a **new migration** (`drizzle/*.sql` was untracked) it may already be
applied to the local database. Then run `bun run db:reset` (say: "I'm also resetting your local
test data so the database matches") — local only, never in production.

## 2B. Undo saved work

```bash
git revert --no-edit <oldest-sha>..HEAD      # or a single sha
```
This adds a new save that reverses those changes — history stays honest. If the reverted saves
included a migration, the database *structure* isn't automatically reverted: locally run
`bun run db:reset`; if it was already deployed, tell them "the change to what the app stores stays
in place for now — this one needs Matt to remove it safely from the live data". Conflicts → stop, restore
the tree (`git revert --abort`), explain in one sentence, and offer to undo the change by hand instead (a new save that puts it back).

## 3. Confirm visually

If the app is running, `open` the affected page and screenshot it (Playwright MCP if available) so
they can see it's back. Then `bun run check` to make sure nothing is broken. Offer `/stack:ship` to save
the undo.
