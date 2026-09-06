---
name: setup
description: >
  Get a Mac ready to build stack apps: installs and checks the command-line tools, Node, Bun, Docker
  Desktop, the GitHub CLI, the Railway CLI and the companion Claude Code plugins, signs the user in to
  GitHub, and creates a projects folder. Use on a brand-new machine, when the user says "set up my
  computer", "get me ready", "install everything", "first time", or runs /stack:setup. Mac only.
allowed-tools: Bash, Read, AskUserQuestion
---

# /stack:setup — get this Mac ready (once)

You are guiding someone who has never used a terminal. Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md`.
Do everything you can yourself; when the Mac needs a click or a password from them, say exactly what
window will appear and what to click. One step at a time; confirm each before moving on. Re-running
this skill is safe — it skips what's already installed.

Mac only. If `uname` isn't `Darwin`, stop: "This setup is for a Mac. Tell Matt what computer you have."

## 0. What's already there?

```bash
uname -m; sw_vers -productVersion
xcode-select -p 2>/dev/null && echo clt-ok || echo CLT_MISSING
git --version 2>/dev/null || echo GIT_MISSING
node --version 2>/dev/null || echo NODE_MISSING
bun --version 2>/dev/null || echo BUN_MISSING
docker --version 2>/dev/null || echo DOCKER_MISSING
docker info >/dev/null 2>&1 && echo docker-running || echo DOCKER_NOT_RUNNING
gh --version 2>/dev/null | head -1 || echo GH_MISSING
gh auth status 2>&1 | head -2
railway --version 2>/dev/null || echo RAILWAY_MISSING
claude plugin list 2>/dev/null | grep -E "playwright|context7|railway|stack" || true
```
Tell them in one line what's done and what's left ("3 of 7 things are already installed; I'll do the rest").

## 1. Command-line tools (gives us git)

If `CLT_MISSING`: run `xcode-select --install`. A Mac window appears: tell them to click **Install**,
then **Agree**, and wait (5–10 minutes; the window shows a progress bar). Poll
`xcode-select -p` every 30 s until it succeeds. If the dialog says already installed, run
`sudo xcode-select --reset` is NOT possible from here — ask them to open Terminal (Cmd+Space, type
Terminal, Enter) and paste `xcode-select --install`.

## 2. Node.js (runs the web app)

If `NODE_MISSING` or major version < 20: download the official installer and open it — it's a
normal Mac installer they click through (Continue → Continue → Agree → Install → their Mac password).
```bash
ver=$(curl -fsSL https://nodejs.org/dist/index.json | grep -o '"version":"v[0-9.]*","date":"[^"]*","files":\[[^]]*\],"npm":"[^"]*","v8":"[^"]*","uv":"[^"]*","zlib":"[^"]*","openssl":"[^"]*","modules":"[^"]*","lts":"[A-Z]' | head -1 | grep -o 'v[0-9.]*' | head -1)
curl -fL -o ~/Downloads/node-$ver.pkg "https://nodejs.org/dist/$ver/node-$ver.pkg" && open ~/Downloads/node-$ver.pkg
```
(If that grep finds nothing, fall back to `https://nodejs.org/dist/latest-v22.x/` and pick the `.pkg`.)
Wait for them to say it's done, then verify with `node --version` (open a fresh shell: `zsh -lc 'node --version'`).

## 3. Bun (installs packages, runs scripts)

If `BUN_MISSING`: `curl -fsSL https://bun.sh/install | bash` — no password needed. Then verify with
`zsh -lc 'bun --version'`. If not found, add `export PATH="$HOME/.bun/bin:$PATH"` to `~/.zshrc`.

## 4. Docker Desktop (runs the database on their Mac)

If `DOCKER_MISSING`:
```bash
arch=$( [[ "$(uname -m)" == "arm64" ]] && echo arm64 || echo amd64 )
curl -fL -o ~/Downloads/Docker.dmg "https://desktop.docker.com/mac/main/$arch/Docker.dmg" && open ~/Downloads/Docker.dmg
```
Tell them: "A window with a whale icon opens. Drag **Docker** onto **Applications**. Then open Docker
from Applications, click **Accept**, and choose the recommended settings (skip sign-in)." Then
`open -a Docker` and poll `docker info` every 10 s (up to 3 minutes). Docker Desktop is free for
small businesses. Ask them to tick **Start Docker Desktop when you sign in** (Settings → General) —
it saves a step every day.

## 5. GitHub CLI + sign in (where the code is saved)

If `GH_MISSING`:
```bash
tag=$(curl -sI https://github.com/cli/cli/releases/latest | grep -i '^location:' | sed -E 's#.*/tag/v##' | tr -d '\r\n')
curl -fL -o ~/Downloads/gh.pkg "https://github.com/cli/cli/releases/download/v$tag/gh_${tag}_macOS_universal.pkg" && open ~/Downloads/gh.pkg
```
Normal installer, click through. Then, if `gh auth status` fails: they need a GitHub account
(https://github.com/signup — ask them to create one if they don't have one, and tell Matt their
username). Sign-in is interactive, so open it in a Terminal window for them:
```bash
osascript -e 'tell application "Terminal" to do script "gh auth login --hostname github.com --git-protocol https --web"'
```
Tell them: "A Terminal window opened. Press **Enter** to open the browser, copy the 8-character code
it shows, paste it in the browser, click **Authorize**. Then say done." Verify with `gh auth status`
and `gh auth setup-git`.

## 6. Railway CLI (for putting apps online — optional now)

If `RAILWAY_MISSING`: `bun install -g @railway/cli` (no password). Sign-in happens in `/stack:deploy`.

## 7. Claude Code companions

```bash
claude plugin install playwright@claude-plugins-official
claude plugin install context7@claude-plugins-official
claude plugin install railway@claude-plugins-official
```
Playwright = Claude can click through the app and take screenshots. Context7 = up-to-date docs.
Railway = deploying. If a command says "already installed", fine.

## 8. A home for projects

```bash
mkdir -p ~/projects && open ~/projects
```

## 9. Hand over

Say, in plain words: everything is installed; **restart Claude Code** so the new plugins load;
then open Claude Code **in the `projects` folder** (File → Open Folder, or `cd ~/projects && claude`)
and type `/stack:new-app <name>` to start their first app.
