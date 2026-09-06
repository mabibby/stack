---
name: ship
description: >
  Save and send the current work in a stack project: bring in Matt's latest changes, run the full check
  (lint, types, tests), fix what's fixable, write a conventional commit, and push to the working branch
  (never main, never force). Use when the user says "ship", "push", "save this", "commit", "send it to
  Matt", "check it in", or runs /stack:ship.
allowed-tools: Bash, Read, Edit, Glob, Grep, AskUserQuestion
---

# /stack:ship — check, save, send to Matt

To the user this is "save and send to Matt". Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md`.

## 1. Where are we?

```bash
git status --short && git branch --show-current && git remote -v
grep -i "working branch" AGENTS.md || true
```
- Working branch = the one named in `AGENTS.md`; default `dev`. If currently on `main`, switch:
  `git switch <working-branch>` (create from main if missing). Uncommitted changes come along.
- Nothing to commit and nothing ahead of origin → say "everything is already saved and sent" and stop.

## 2. Bring in Matt's changes first

```bash
git fetch origin
git rev-list --count HEAD..origin/main     # >0 → Matt has changes we don't have
```
If > 0: commit the current work first (step 4, so nothing is lost), then
`git merge --no-edit origin/main`. Clean → carry on. Conflicts → resolve if trivial (formatting,
lockfile: re-run `bun install`); otherwise `git merge --abort`, and tell the user in one sentence
that their work and Matt's changed the same thing and that Matt needs to look — then still push
the unmerged work so Matt can see it.

## 3. Make it green

```bash
bun run lint:fix
bun run typecheck
bun run test
```
Fix failures yourself (they're usually formatting or a type). If tests are red for a real reason,
fix the code — don't delete or skip the test. If the fix is beyond a quick change, stop, explain in
plain words, and ask whether to save as work-in-progress (`wip(scope): …`) or keep fixing.

If the change touched UI/actions/schema and the dev server is running, also `bun run test:e2e`.
Playwright not installed → `bunx playwright install chromium`.

Also check: `git diff --cached --name-only; git diff --name-only` must not include `.env`, `.env.local`
or anything with real credentials; `drizzle/` changes must be new files, not edits to committed migrations
(if they are, stop and explain — that needs `/stack:db-change`).

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
Rejected as non-fast-forward → `git pull --rebase origin <working-branch>` then push again. Conflicts
→ resolve if trivial; otherwise stop and explain what conflicted in plain words. **Never** `--force`,
`--force-with-lease`, `reset --hard`, or delete branches (the guard-rails block them anyway).

## 6. Report (plain words)

"Saved and sent to Matt: <subject in plain words>." Include the link Matt will use:
`https://github.com/<owner>/<repo>/compare/main...<working-branch>`. If Matt's changes were merged
in, say so ("I also brought in Matt's latest changes"). Mention anything Matt needs to know (a new
setting the live site will need, a change to what's stored, a new dependency).
