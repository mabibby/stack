---
name: feature
description: >
  Build a product feature end-to-end in a stack project: turn a plain-English request into a short
  spec, then implement it the standard way (schema → migration → domain → server action → UI → e2e test),
  verify it in a real browser, and get it ready to ship. Use when the user describes something they want
  the app to do ("add…", "I want users to be able to…", "build the X screen", "make it so…"), or runs
  /stack:feature.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, mcp__plugin_playwright_playwright__*, mcp__plugin_context7_context7__*
---

# /stack:feature — build a feature the standard way

The user thinks in product terms; you translate into the architecture. Keep them in the loop at two
moments only: **the spec** (before code) and **the demo** (after). Everything between is yours.

Read first, every time (they're short): the repo's `AGENTS.md`, then
`${CLAUDE_PLUGIN_ROOT}/references/architecture.md` §3–§8, and skim
`${CLAUDE_PLUGIN_ROOT}/references/next16-cheatsheet.md` when touching pages/actions/caching.
For library specifics (better-auth, drizzle, pg-boss, shadcn, playwright) prefer Context7 docs over memory.

## 1. Understand (≤ 3 questions, only if needed)

Restate the request as: **who** does it, **what** they see/do, **what changes** as a result. Ask only
what materially changes the build (e.g. "should other users see it, or just the owner?"). Never ask
technical questions ("which table?", "server or client?") — decide those yourself.

## 2. Spec (show it, get a nod)

Write `docs/features/<slug>.md` (create dir if missing) — ~15 lines:
- Goal (one sentence) · Screens/flows (bullets) · Data (new/changed tables + fields, in words)
- Background work (jobs, emails) if any · Out of scope (what you're deliberately not doing — YAGNI)
- Done when (3–5 checkable statements, phrased as the user would verify them)
Show it in chat. If they say go (or don't object to obvious stuff), proceed. Small changes (copy, a
button, a column) don't need a spec — just say what you'll do and do it.

## 3. Build (in this order — each step leaves the app working)

1. **Schema** — `src/lib/db/schema/<feature>.ts` using `id()/publicId()/timestamps()`; export from
   `schema/index.ts`; `bun run db:generate --name <change>`; read the SQL; `bun run db:migrate`.
2. **Domain** — `src/lib/domain/<feature>/queries.ts` + `mutations.ts`. Rules and ownership checks here.
   Unit test any non-trivial rule in `tests/unit/`.
3. **Actions** — `src/app/(app)/<feature>/actions.ts` with `defineAction`; `requireSessionAction()`; `revalidatePath`.
4. **UI** — page (RSC) + client form/list components; shadcn components (`bunx shadcn add x` if
   missing); react-hook-form + zod; toasts; loading/empty/error states; add nav link in `app-header.tsx`.
5. **Jobs / email / files** — only if the spec says so, via `QUEUES` + handler / `sendEmail` / presign.
6. **E2E** — `tests/e2e/<feature>.spec.ts` walking the happy path (see `smoke.spec.ts` for sign-in
   via Mailpit OTP; reuse that helper by extracting to `tests/e2e/helpers.ts` if a second spec needs it).
7. **Env** — anything new: `env.ts` → `.env.example` → `.env.local` (tell the user if prod needs it).

Conventions to hold: no business logic in components/actions · every query scoped by user ·
`publicId` in URLs · no new dependencies without saying why (and prefer none) · Biome-clean.

## 4. Verify (non-negotiable)

```bash
bun run check          # lint + typecheck + unit
bun run test:e2e       # needs dev server running (bun run dev) — start it if not
```
Then **use Playwright MCP** to click through the feature yourself as the user would: happy path, an
invalid input, and empty state. Screenshot the main screen(s). Fix anything ugly or confusing —
labels, spacing, error copy — you own the polish. If a job is involved, run `bun run dev:worker` and
confirm it processed (worker log / Mailpit / DB via `db:studio` or a query).

## 5. Demo + ship

Tell the user in plain words: what they can now do, where to click, what's out of scope. Attach the
screenshot(s). Then offer `/stack:ship` (or just run it if they said "and ship it").

## When the request is vague, huge, or a "whole app"

Break it into a numbered list of features, order by dependency, get agreement on the first 1–3, and
build them one at a time (spec → build → verify → ship each). Say what you're leaving for later.

## When you hit something the template doesn't cover

Check §11 of `architecture.md` for the sanctioned way to add it. If it isn't there (payments,
external API, AI), propose the smallest addition, name the new dependency, and ask before adding.
