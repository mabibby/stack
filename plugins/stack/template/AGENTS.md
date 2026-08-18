<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# __APP_TITLE__ — rules for working in this repo

This project was created from the **stack** template. The full architecture guide lives in the
`stack` plugin (`/stack:feature` etc.); these are the non-negotiables for THIS repo.

## Stack (do not swap any of these without asking Matt)

Bun · TypeScript (strict) · Next.js app router · Postgres + Drizzle · better-auth · pg-boss ·
Tailwind v4 + shadcn/ui · react-hook-form + zod · Biome · Playwright + `bun test` · Railway.

## Layout

| Path | What lives there |
|---|---|
| `src/app/(auth)`, `(app)`, `api/` | Routes. `(app)/layout.tsx` enforces sign-in for everything inside it. |
| `src/app/**/actions.ts` | Server actions — thin: validate → auth → domain → revalidate. |
| `src/lib/domain/<feature>/{queries,mutations}.ts` | **Business rules live here.** Plain functions, take `db`, throw `AppError`s. No Next imports. |
| `src/lib/db/schema/*.ts` | One file per feature. Use `id()`, `publicId()`, `timestamps()` from `shared.ts`. |
| `src/lib/jobs/` | Queue names + payload types (`queues.ts`), producer (`queue.ts`), handlers. |
| `worker/index.ts` | The background worker process. |
| `src/components/ui` | shadcn — generated, don't hand-edit; add more with `bunx shadcn add <name>`. |
| `src/lib/env.ts` | Every env var, zod-validated. Add here FIRST, then `.env.example`. |
| `tests/unit`, `tests/e2e` | `bun test` (domain logic, fake db) and Playwright (real browser, real stack). |

## Rules

1. **Schema changes go through Drizzle migrations.** Edit `src/lib/db/schema/*`, run `bun run db:generate --name <what_changed>`, then `bun run db:migrate`. NEVER `db:push`, never hand-edit `drizzle/*.sql`, never edit a migration that has been committed — write a new one.
2. **Auth is server-side.** Pages/layouts use `requireSession()`; actions use `requireSessionAction()`; every DB query is scoped by `userId` (see `deleteNote`). Never trust ids from the client without a `userId` filter.
3. **URLs use `publicId`, never the numeric `id`.**
4. **Anything slow, retryable or scheduled is a job**, not an inline `await` in a request: add to `QUEUES`, write a handler, `enqueue()` it. Emails to users other than the one waiting go through `QUEUES.SEND_EMAIL`.
5. **Env vars**: never read `process.env` outside `src/lib/env.ts`. Never commit `.env.local`.
6. **Forms**: react-hook-form + zod on the client, the same zod schema shape in the action, `defineAction` for every action, map `fieldErrors` back with `form.setError`.
7. **UI**: shadcn components + Tailwind utilities. No new UI libraries. `cn()` for class merging. Toasts via `sonner`.
8. **Logging**: `logger.info({ ctx }, "dotted.event.name")` — never `console.log` in app code.
9. **YAGNI**: no monorepo, no tRPC/GraphQL, no react-query, no global state library, no Redis, no feature flags, no i18n, no extra services — until a real, present need. Ask before adding a dependency.
10. **Formatting**: Biome owns it. `bun run lint:fix` before every commit; `bun run check` must pass.

## Definition of done (for every feature)

- [ ] `bun run check` passes (lint + types + unit tests)
- [ ] Playwright spec in `tests/e2e/` for the happy path — and it passes (`bun run test:e2e`)
- [ ] Verified in a real browser (Playwright MCP): screens look right, errors are friendly
- [ ] `.env.example` + `src/lib/env.ts` updated if config changed; migration generated if schema changed
- [ ] Committed with a conventional message (`feat(notes): add archive action`) and pushed to the working branch

## Local URLs

App http://localhost:3000 · Mailpit http://localhost:8025 · MinIO console http://localhost:9001 · `bun run db:studio`
