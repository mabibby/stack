---
name: ship
description: >
  Save and push the current work in a stack project: run the full check (lint, types, tests), fix
  what's fixable, write a conventional commit, and push to the working branch (never main, never force).
  Use when the user says "ship", "push", "save this", "commit", "send it to Matt", "check it in", or
  runs /stack:ship.
allowed-tools: Bash, Read, Edit, Glob, Grep, AskUserQuestion
---

# /stack:ship — check, commit, push

## 1. Where are we?

```bash
git status --short && git branch --show-current && git remote -v
grep -i "working branch" AGENTS.md || true
```
- Working branch = the one named in `AGENTS.md`; default `dev`. If currently on `main`, switch:
  `git switch <working-branch>` (create from main if missing). Uncommitted changes come along.
- Nothing to commit and nothing ahead of origin → say so and stop.

## 2. Make it green

```bash
bun run lint:fix
bun run typecheck
bun run test
```
Fix failures yourself (they're usually formatting or a type). If tests are red for a real reason,
fix the code — don't delete or skip the test. If the fix is beyond a quick change, stop, explain in
plain words, and ask whether to commit as work-in-progress (`wip(scope): …`) or keep fixing.

If a dev server is running, also `bun run test:e2e` when the change touched UI/actions/schema.
Playwright not installed → `bunx playwright install chromium`.

Also check: `git diff --cached --name-only; git diff --name-only` must not include `.env`, `.env.local`
or anything with real credentials; `drizzle/` changes must be new files, not edits to committed migrations
(if they are, stop and explain — that needs `/stack:db-change`).

## 3. Commit

Group into one commit per coherent change (usually one). Conventional format:
`feat(notes): add archive action` · `fix(auth): show error when code expires` · `chore(deps): …` ·
`test(e2e): cover project creation` · `docs: …`. Subject ≤ 72 chars, imperative mood, body optional
(bullets of what/why). Include new migrations, `docs/features/*.md`, and lockfile changes.

```bash
git add -A
git commit -m "<type>(<scope>): <subject>" -m "<optional body>"
```

## 4. Push

```bash
git push -u origin <working-branch>
```
Rejected as non-fast-forward → `git pull --rebase origin <working-branch>` then push again. Conflicts
→ resolve if trivial (formatting, lockfile: re-run `bun install`); otherwise stop and explain what
conflicted in plain words. **Never** `--force`, `--force-with-lease`, `reset --hard`, or delete branches.

## 5. Report

One or two sentences: what was committed (the subject line), that it's on `<working-branch>` on
GitHub, and the compare URL: `https://github.com/<owner>/<repo>/compare/main...<working-branch>` for
Matt to review. Mention anything Matt needs to know (new env var, migration, new dependency).
