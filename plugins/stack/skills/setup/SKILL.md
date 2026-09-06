---
name: setup
description: >
  Check a Mac is ready to build stack apps and fix what's missing by running Matt's installer
  (Xcode tools, Homebrew, Node, Bun, Docker Desktop, GitHub CLI, Railway CLI, Claude Code plugins,
  the `stack` command, GitHub sign-in). Use when the user says "set up my computer", "get me ready",
  "install everything", "first time", "stack command not found", or runs /stack:setup. Mac only.
allowed-tools: Bash, Read
---

# /stack:setup — is this Mac ready?

Follow `${CLAUDE_PLUGIN_ROOT}/references/voice.md`. The installer is a Terminal script (it needs the
user's password and an interactive GitHub sign-in, which Claude can't do), so your job is to check
and then hand them the exact line to paste.

```bash
uname; command -v stack && stack doctor || echo STACK_CLI_MISSING
```
- Not `Darwin` → stop: "This setup is for a Mac. Tell Matt what computer you have."
- All green → say so; next step is `stack new <app-name>` in Terminal, or `/stack:new-app` here.
- Anything missing, or **STACK_CLI_MISSING** → open Terminal for them with the installer already running:
  ```bash
  osascript -e 'tell application "Terminal" to do script "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/mabibby/stack/main/install.sh)\""'
  ```
  Tell them: "A Terminal window opened and is setting things up. It will ask for your Mac password
  (nothing shows while you type) and later open the browser to sign in to GitHub — press Enter, copy
  the code, click Authorize. Say 'done' when it prints ✅." Then re-run `stack doctor` to confirm.
  If Terminal can't be opened, give them the line to paste themselves.
- After the installer: they should **quit and reopen Claude Code** so plugins load.
