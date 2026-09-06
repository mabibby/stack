#!/usr/bin/env bash
# PreToolUse guard for Bash. Reads the tool-call JSON on stdin. Exit 2 = block (stderr goes to Claude).
# Only enforced inside projects created from the stack template, so Matt's other repos are unaffected.
# Deliberate override for bootstrap pushes:  STACK_ALLOW_MAIN=1 git push ...
set -u
input="$(cat)"

# Enforce only in stack projects (marker line lives in AGENTS.md).
if ! { [[ -f AGENTS.md ]] && grep -qF 'created from the **stack** template' AGENTS.md; }; then
  exit 0
fi

# Pull the command string out of the JSON without needing jq (keeps JSON escapes; fine for matching).
cmd="$(printf '%s' "$input" | sed -nE 's/.*"command":"((\\.|[^"\\])*)".*/\1/p' | head -n 1)"
[[ -z "$cmd" ]] && exit 0
[[ "$cmd" == *"STACK_ALLOW_MAIN=1"* ]] && exit 0

deny() {
  printf '✘ Blocked by the stack guard-rails: %s\n' "$1" >&2
  exit 2
}

# ---- git push -------------------------------------------------------------
if [[ "$cmd" =~ git[[:space:]]+push ]]; then
  if [[ "$cmd" =~ (--force|--force-with-lease|--force-if-includes|[[:space:]]-f([[:space:]]|$)|[[:space:]]\+[A-Za-z]) ]]; then
    deny "force pushes rewrite history on the server. Use /stack:ship — it pulls first, then pushes."
  fi
  if [[ "$cmd" =~ ([[:space:]]|:)main([[:space:]]|$|\\\") ]]; then
    deny "pushing to main is Matt's job. Push the working branch instead (/stack:ship)."
  fi
  if [[ "$cmd" =~ (--delete|-d[[:space:]]|[[:space:]]:refs/|[[:space:]]:[A-Za-z]) ]]; then
    deny "deleting a branch on GitHub. Ask Matt if a branch really needs to go."
  fi
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ "$branch" == "main" ]]; then
    deny "you are on main. Switch to the working branch first (git switch dev), then /stack:ship."
  fi
fi

# ---- history rewriting / data loss ---------------------------------------
[[ "$cmd" =~ git[[:space:]]+reset[[:space:]]+(--hard|--merge) ]] && deny "git reset --hard throws work away. Use /stack:undo instead."
[[ "$cmd" =~ git[[:space:]]+commit[[:space:]].*--amend ]] && deny "amending rewrites a commit. Make a new commit instead."
[[ "$cmd" =~ git[[:space:]]+(rebase[[:space:]]+-i|rebase[[:space:]]+--interactive|filter-branch|filter-repo) ]] && deny "interactive rebase / history filtering is not allowed here."
[[ "$cmd" =~ git[[:space:]]+branch[[:space:]]+(-D|-d)[[:space:]]+(main|dev)([[:space:]]|$) ]] && deny "deleting main or the working branch."
[[ "$cmd" =~ git[[:space:]]+push.*--mirror ]] && deny "mirror pushes."

# ---- database ------------------------------------------------------------
[[ "$cmd" =~ drizzle-kit[[:space:]]+push ]] && deny "drizzle-kit push skips migrations. Use /stack:db-change (generate → review → migrate)."
[[ "$cmd" =~ db:push ]] && deny "db:push skips migrations. Use /stack:db-change."
[[ "$cmd" =~ (DROP[[:space:]]+(DATABASE|SCHEMA)|drop[[:space:]]+(database|schema)) ]] && deny "dropping a database or schema. Locally use bun run db:reset; never in production."

# ---- filesystem ----------------------------------------------------------
[[ "$cmd" =~ rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*[[:space:]]+(/|~|\$HOME|\.git|\.|\*|drizzle)([[:space:]]|/?$) ]] && deny "recursive delete of the repo, home folder, .git or drizzle/."

exit 0
