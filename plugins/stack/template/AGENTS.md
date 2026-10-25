<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# **APP_TITLE** — rules for working in this repo

This project was created from the **stack** template. The full architecture guide lives in the
`stack` plugin (`/stack:feature` etc.); these are the non-negotiables for THIS repo.

## Stack (fixed — do not swap any of these)

Bun · TypeScript (strict) · Next.js app router · Postgres + Drizzle · better-auth · pg-boss ·
Tailwind v4 + shadcn/ui · react-hook-form + zod · Biome · Playwright + `bun test` · Railway.

## Layout

| Path                                              | What lives there                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/app/(auth)`, `(app)`, `api/`                 | Routes. `(app)/layout.tsx` enforces sign-in for everything inside it.                            |
| `src/app/**/actions.ts`                           | Server actions — thin: validate → auth → domain → revalidate.                                    |
| `src/lib/domain/<feature>/{queries,mutations}.ts` | **Business rules live here.** Plain functions, take `db`, throw `AppError`s. No Next imports.    |
| `src/lib/db/schema/*.ts`                          | One file per feature. Use `id()`, `publicId()`, `timestamps()` from `shared.ts`.                 |
| `src/lib/jobs/`                                   | Queue names + payload types (`queues.ts`), producer (`queue.ts`), handlers.                      |
| `worker/index.ts`                                 | The background worker process.                                                                   |
| `src/components/ui`                               | shadcn — generated, don't hand-edit; add more with `bunx shadcn add <name>`.                     |
| `src/lib/env.ts`                                  | Every env var, zod-validated. Add here FIRST, then `.env.example`.                               |
| `src/lib/auth/signup-policy.ts`                   | Who may create an account (`SIGNUP_ALLOWLIST`). Empty locally; set in prod for invite-only apps. |
| `scripts/dev.ts`, `.githooks/`                    | `bun run dev` runs web + worker together. Git hooks refuse pushes to main and force pushes.      |
| `.github/workflows/ci.yml`                        | The same checks + build + browser tests on every push.                                           |
| `tests/unit`, `tests/e2e`                         | `bun test` (domain logic, fake db) and Playwright (real browser, real stack).                    |

## Rules

1. **Schema changes go through Drizzle migrations.** Edit `src/lib/db/schema/*`, run `bun run db:generate --name <what_changed>`, then `bun run db:migrate`. NEVER `db:push`, never hand-edit `drizzle/*.sql`, never edit a migration that has been committed — write a new one.
2. **Auth is server-side, on every page and action.** Pages call `requireSession()` (the `(app)` layout does too, but layouts don't re-run on client navigation); actions call `requireSessionAction()`; every DB query is scoped by `userId` (see `deleteNote`). Never trust ids from the client without a `userId` filter.
3. **URLs use `publicId`, never the numeric `id`.**
4. **Anything slow, retryable or scheduled is a job**, not an inline `await` in a request: add to `QUEUES`, write a handler, `enqueue()` it. Emails to users other than the one waiting go through `QUEUES.SEND_EMAIL`.
5. **Env vars**: never read `process.env` outside `src/lib/env.ts`. Never commit `.env.local`.
6. **Forms**: react-hook-form + zod on the client, the same zod schema shape in the action, `defineAction` for every action, map `fieldErrors` back with `form.setError`.
7. **UI**: shadcn components + Tailwind utilities. No new UI libraries. `cn()` for class merging. Toasts via `sonner`.
8. **Logging**: `logger.info({ ctx }, "dotted.event.name")` — never `console.log` in app code.
9. **Latest stable everything.** Every library, runtime (Node LTS, Bun) and Docker image stays on its newest stable release — never betas/RCs, never younger than the 3-day cooldown in `bunfig.toml`. When anything is behind, run `/stack:upgrade` first. New dependencies: `bun add <pkg>@latest`, `bunx shadcn@latest add …`, and read the docs for the installed version (Context7), not memory.
10. **YAGNI**: no monorepo, no tRPC/GraphQL, no react-query, no global state library, no Redis, no feature flags, no i18n, no extra services — until a real, present need. Ask before adding a dependency.
11. **Formatting**: Biome owns it. `bun run lint:fix` before every commit; `bun run check` must pass.
12. **Guard-rails are real**: pushes to `main`, force pushes, `git reset --hard` and `db:push` are blocked by the stack plugin hook and by `.githooks/pre-push`. Don't work around them — take the safe route (push the working branch, `/stack:undo`, `/stack:db-change`).
13. **The person you work with is not a developer, and this is their app.** How to talk to them (outcomes not tech, "saved" not "pushed", open the page and show screenshots, Matt stays in the background) is loaded by the stack plugin at the start of every session from its `references/voice.md` — follow it. App URL for `open`: http://localhost:**PORT_WEB**.

## Definition of done (for every feature)

- [ ] `bun run check` passes (lint + types + unit tests)
- [ ] Playwright spec in `tests/e2e/` for the happy path — and it passes (`bun run test:e2e`)
- [ ] Verified in a real browser (Playwright MCP): screens look right at desktop AND phone width (390px), errors are friendly
- [ ] `.env.example` + `src/lib/env.ts` updated if config changed; migration generated if schema changed
- [ ] Committed with a conventional message (`feat(notes): add archive action`) and pushed to the working branch; once live, CI (`.github/workflows/ci.yml`) is green — Railway deploys only green commits

## Local URLs

App http://localhost:**PORT_WEB** · Mailpit (every email) http://localhost:**PORT_MAIL** · Files (RustFS console) http://localhost:**PORT_S3_CONSOLE**/rustfs/console/ · Postgres localhost:**PORT_PG** · `bun run db:studio`

This app owns port slot **PORT_SLOT** (ports are per app so several apps can run at once; `stack ls` lists them).

Start everything with ONE command: `bun run dev` (web + worker). Infra: `bun run setup` (idempotent).
