#!/usr/bin/env bash
# One-line Mac setup for building apps the stack way. Safe to re-run; skips what's already done.
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/mabibby/stack/main/install.sh)"
# Installs: Xcode command-line tools, Homebrew, git, Node, Bun, GitHub CLI, Railway CLI, Docker Desktop,
# Claude Code, this repo (~/.stack/repo), the `stack` command, the stack plugin + companions, and
# signs you in to GitHub. Then: `stack new <app-name>`.
set -euo pipefail

STACK_HOME="${STACK_HOME:-$HOME/.stack}"
REPO_URL="${STACK_REPO_URL:-https://github.com/mabibby/stack.git}"
REPO="$STACK_HOME/repo"
PROJECTS="${STACK_PROJECTS:-$HOME/projects}"
BIN="${STACK_BIN:-$HOME/.local/bin}"

say()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
note() { printf '  \033[33m→\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✘ %s\033[0m\n\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

[[ "$(uname)" == "Darwin" ]] || die "This installer is for a Mac. Tell Matt what computer you have."
printf '\n\033[1mstack — setting up this Mac. Takes 10–30 minutes, mostly waiting.\033[0m\n'
printf 'When your Mac asks for your password, that is expected: type it (nothing shows while you type) and press Enter.\n'

# 1. Xcode command-line tools (git, compilers)
say "Command-line tools"
if xcode-select -p >/dev/null 2>&1; then ok "already installed"; else
  note "A window will pop up: click Install, then Agree. Waiting for it to finish…"
  xcode-select --install >/dev/null 2>&1 || true
  until xcode-select -p >/dev/null 2>&1; do sleep 10; done
  ok "installed"
fi

# 2. Homebrew (installs everything else)
say "Homebrew"
if have brew || [[ -x /opt/homebrew/bin/brew ]] || [[ -x /usr/local/bin/brew ]]; then ok "already installed"; else
  note "Press Enter when Homebrew asks, then type your Mac password."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
if [[ -x /opt/homebrew/bin/brew ]]; then BREW=/opt/homebrew/bin/brew; else BREW=/usr/local/bin/brew; fi
eval "$("$BREW" shellenv)"
grep -q 'brew shellenv' "$HOME/.zprofile" 2>/dev/null || printf '\neval "$(%s shellenv)"\n' "$BREW" >> "$HOME/.zprofile"

# 3. Tools
say "Node, Bun, GitHub CLI, Railway CLI"
for pkg in node gh railway; do
  if brew list --formula "$pkg" >/dev/null 2>&1 || have "$pkg"; then ok "$pkg"; else brew install -q "$pkg"; ok "$pkg installed"; fi
done
if have bun; then ok "bun"; else brew install -q oven-sh/bun/bun; ok "bun installed"; fi

# 4. Docker Desktop
say "Docker Desktop (runs your app's database on this Mac)"
if [[ -d "/Applications/Docker.app" ]]; then ok "already installed"; else
  brew install -q --cask docker-desktop 2>/dev/null || brew install -q --cask docker
  ok "installed"
fi
if ! docker info >/dev/null 2>&1; then
  open -a Docker
  note "Docker is starting. The first time it asks you to Accept the terms and choose settings — click Accept / Finish. Waiting…"
  for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 4; done
  docker info >/dev/null 2>&1 && ok "Docker running" || note "Docker isn't running yet — open Docker Desktop from Applications and finish its setup, then re-run this installer."
else ok "Docker running"; fi

# 5. Claude Code
say "Claude Code"
if have claude || [[ -x "$BIN/claude" ]]; then ok "already installed"; else
  curl -fsSL https://claude.ai/install.sh | bash
  ok "installed"
fi
mkdir -p "$BIN"
grep -q '.local/bin' "$HOME/.zprofile" 2>/dev/null || printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.zprofile"
export PATH="$BIN:$PATH"

# 6. This repo + the `stack` command
say "The stack toolkit"
mkdir -p "$STACK_HOME"
if [[ -d "$REPO_URL/.git" ]]; then
  # Local working copy (Matt's machine): link it instead of cloning, so `stack` tracks the working tree.
  [[ -L "$REPO" || ! -e "$REPO" ]] && ln -sfn "$(cd "$REPO_URL" && pwd)" "$REPO"; ok "linked to $REPO_URL"
elif [[ -d "$REPO/.git" ]]; then git -C "$REPO" pull -q --ff-only && ok "updated"
else git clone -q "$REPO_URL" "$REPO" && ok "downloaded"; fi
ln -sf "$REPO/bin/stack" "$BIN/stack"; chmod +x "$REPO/bin/stack"
ok "'stack' command installed"

# 7. Claude Code plugins
say "Claude Code plugins"
if claude plugin marketplace list 2>/dev/null | grep -q mabibby-stack; then ok "marketplace already added"; else claude plugin marketplace add "$REPO" >/dev/null && ok "marketplace added"; fi
for p in stack@mabibby-stack playwright@claude-plugins-official context7@claude-plugins-official railway@claude-plugins-official; do
  if claude plugin list 2>/dev/null | grep -q "$p"; then ok "$p"; else claude plugin install "$p" >/dev/null 2>&1 && ok "$p installed" || note "couldn't install $p — Claude may ask you to sign in first; re-run this installer after 'claude' has been signed in once"; fi
done

# 8. GitHub sign-in
say "GitHub (where your code is saved)"
if gh auth status >/dev/null 2>&1; then ok "signed in as $(gh api user --jq .login)"; else
  note "You need a GitHub account (free): https://github.com/signup — create one if you haven't, then come back."
  note "Press Enter to open the browser, copy the code shown here, paste it there, click Authorize."
  gh auth login --hostname github.com --git-protocol https --web
fi
gh auth setup-git >/dev/null 2>&1 || true

# 9. Projects folder
mkdir -p "$PROJECTS"

printf '\n\033[1m✅ This Mac is ready.\033[0m\n\n'
printf '  1. Quit Terminal (Cmd+Q) and open it again, so the new commands are found.\n'
printf '  2. If you have never opened Claude Code: type  claude  , press Enter, and sign in (then type /exit).\n'
printf '  3. Create your first app:   stack new my-first-app\n\n'
printf '  Tell Matt your GitHub username: %s\n\n' "$(gh api user --jq .login 2>/dev/null || echo '(sign in to GitHub first)')"
