---
name: ship
description: >
  Save the current work in a stack project: bring in reviewed fixes from main, run the full check
  (lint, types, tests), fix what's fixable, write a conventional commit, and push to the working branch
  (never main, never force). Use when the user says "ship", "ship it", "push", "save this", "commit",
  "send it", "check it in", or runs /stack:ship.
allowed-tools: Bash, Read, Edit, Glob, Grep, AskUserQuestion
---

# /stack:ship — check, save, push

To the user this is just "saving" (and, once the app is online, "it goes live once the checks pass").
Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md` — in particular, don't frame any of this as
sending work to someone or waiting for review.

## 1. Where are we?

```bash
git status --short && git branch --show-current && git remote -v
grep -i "working branch" AGENTS.md || true
```
- Working branch = the one named in `AGENTS.md`; default `dev`. If currently on `main`, switch:
  `git switch <working-branch>` (create from main if missing). Uncommitted changes come along.
- Nothing to commit and nothing ahead of origin → say "everything is already saved and sent" and stop.

## 2. Bring in reviewed fixes from main first

```bash
git fetch origin
git rev-list --count HEAD..origin/main     # >0 → main has fixes we don't have
```
If > 0: commit the current work first (step 4, so nothing is lost), then
`git merge --no-edit origin/main`. Clean → carry on silently (mention it only if it changed something
they'll see). Conflicts → resolve if trivial (formatting, lockfile: re-run `bun install`); otherwise
`git merge --abort`, still push the unmerged work, and tell them in one sentence that this one needs
Matt — both sides changed the same thing.

## 3. Make it green

```bash
bun run lint:fix
bun run typecheck
bun run test
```
Fix failures yourself (they're usually formatting or a type). If tests are red for a real reason,
fix the code — don't delete or skip the test. If the fix is beyond a quick change, stop, explain in
plain words, and ask whether to save as work-in-progress (`wip(scope): …`) or keep fixing.
**Work-in-progress never goes online.** If the app is live (`AGENTS.md` has a `Live:` line), a `wip`
save is a local commit only — skip step 5 and say "Saved on this Mac. It goes online once it passes
the checks." (Before the app is live, pushing a `wip` save is fine.)

If the change touched UI/actions/schema and the dev server is running, also `bun run test:e2e`.
Playwright not installed → `bunx playwright install chromium`.

Also check: `git diff --cached --name-only; git diff --name-only` must not include `.env`, `.env.local`
or anything with real credentials; `drizzle/` changes must be new files, not edits to committed migrations
(if they are, stop and explain — that needs `/stack:db-change`).

**Live data.** If the app is online (`AGENTS.md` has a `Live:` line) and a new `drizzle/*.sql` contains
`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN … TYPE` or a `RENAME`, saving will apply it to real data within
minutes. Say what will be lost or changed, in their words, and ask. Recommend getting Matt to look first;
proceed only on a clear yes.

## 4. Commit

Group into one commit per coherent change (usually one). Conventional format:
`feat(notes): add archive action` · `fix(auth): show error when code expires` · `chore(deps): …` ·
`test(e2e): cover project creation` · `docs: …`. Subject ≤ 72 chars, imperative mood, body optional
(bullets of what/why). Include new migrations, `docs/features/*.md`, and lockfile changes.

```bash
git add -A
git commit -m "<type>(<scope>): <subject>" -m "<optional body>"
```

## 5. Push

```bash
git push -u origin <working-branch>
```
Rejected as non-fast-forward → `git pull --no-rebase --no-edit origin <working-branch>` then push again
(merge, not rebase — a rebase would flatten the merge from main and replay its commits). Conflicts
→ resolve if trivial; otherwise stop and explain what conflicted in plain words. **Never** `--force`,
`--force-with-lease`, `reset --hard`, or delete branches (the guard-rails block them anyway).

If the app is live, GitHub now runs the full checks (`.github/workflows/ci.yml`) and Railway only
deploys once they pass. Wait for it: `gh run watch --exit-status $(gh run list --branch <working-branch>
--limit 1 --json databaseId -q '.[0].databaseId')` (a few minutes). Red → `gh run view --log-failed`,
fix, and ship again; the live site stays on the last good version meanwhile.

## 6. Report (plain words)

"Saved: <subject in plain words>." If the app is online, add "— it's live" once CI is green (or
"— the checks found a problem, I'm fixing it" if not). Tell them
only what *they* need to act on (e.g. a new setting the live site needs, and where to get it).
Anything the reviewer should know (a new dependency, a change to what's stored) goes in the commit
body, not the chat.
