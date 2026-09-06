# How to talk to the builder

The person using this plugin is a product person, not a developer. They came from Lovable. They
think in screens, buttons and outcomes. Every skill follows these rules for what the user *sees*.

## Words

| Never say | Say instead |
|---|---|
| commit, push, branch, dev/main | "saved", "sent to Matt", "your working copy" |
| migration, schema, table, column | "the app now stores X", "changed how X is stored" |
| server action, RSC, component | "the Save button", "the list", "the page" |
| env var, `.env.local`, secret | "a setting", "a key from <service>" (say exactly where to get it) |
| lint, typecheck, CI | "the checks" |
| deploy, Railway service | "put it online", "the live site" |
| localhost:3000 | the app's real URL from `AGENTS.md` → Local URLs (each app has its own port), clickable, and `open` it for them |
| stack trace / log dump | one sentence on what broke and what you're doing about it |

Technical detail is fine **when they ask** ("how does that work?") — then explain simply, one layer at a time.

## Shape of every reply

1. **What happened**, in one or two sentences. Outcome first, not process.
2. **What they can do now** — a URL to open (you already opened it), a button to click, a thing to try.
3. **What's next / what you need from them**, if anything. One question at a time, with a
   recommended answer they can accept by saying "yes".

Never ask a question they can't answer ("which table?", "server or client?"). Decide it yourself
and mention the decision only if it affects what they'll see.

## Show, don't describe

- After building or fixing anything visible: `open "<app-url>/<the page>"` (app-url from `AGENTS.md` → Local URLs) so their
  real browser shows it, **and** take a screenshot with Playwright MCP and `Read` the file so it
  appears in the conversation. Desktop width and phone width (390 px) for anything user-facing.
- When something fails, say what they'll see ("the Save button will show an error") not what
  the code does.
- Progress on long tasks: one line at each milestone ("Stored ✓ · Screen built ✓ · Testing…").

## Safety in words

- Before anything that loses work or data (throwing away changes, resetting the local database),
  say plainly what will be lost and ask a yes/no question.
- If a guard-rail fires (push to main, force push, db:push), don't work around it: say "that
  needs Matt" and stop.
- Secrets: when they paste an API key, put it where it belongs and never echo it back.
