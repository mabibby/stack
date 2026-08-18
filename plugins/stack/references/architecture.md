# The stack — architecture & conventions

This is how apps built with the `stack` plugin are put together. Read it before writing code in a
project created by `/stack:new-app`. It is opinionated on purpose: one way to do each thing, so
product thinking is where the effort goes. Companion doc: `next16-cheatsheet.md` (Next.js gotchas).

## 1. Principles

1. **YAGNI, aggressively.** Build what the current feature needs. No abstractions "for later", no
   extra services, no monorepo, no state libraries, no config flags for hypothetical futures. When
   a real need arrives, the layered design makes adding things cheap.
2. **Boring, proven tech.** Everything below has been used across many production apps by Matt.
   Don't swap a piece for something newer without discussing it.
3. **Server-first.** Pages are React Server Components that call the domain layer directly. Client
   components are leaves (forms, menus, interactive widgets). Mutations are server actions.
4. **Business rules live in one place** — `src/lib/domain/*` — never in components, actions,
   route handlers or job handlers. Those are thin adapters.
5. **Correctness is enforced by the framework, not by remembering.** Env validated at boot, zod at
   every boundary, TypeScript strict, Biome, `defineAction`, `requireSession`. If a rule can be a
   type or a lint, it isn't a comment.
6. **Verify in a browser.** Nothing is "done" until it's been clicked through (Playwright MCP) and
   the e2e spec passes. Type-check green is necessary, not sufficient.
7. **Small, honest increments.** Feature → check → commit → push. Conventional commits so history
   reads like a changelog.

## 2. The stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime + package manager | **Bun** | `bun install`, `bun run`, `bun test`, `bunx`. Not npm/pnpm/yarn. |
| Language | **TypeScript** (strict) | `type` over `interface`; no `any`; explicit return types on domain functions. |
| Framework | **Next.js** (app router, latest) | Turbopack. RSC + server actions. `proxy.ts` not `middleware.ts`. See cheat sheet. |
| Database | **Postgres** (18 locally, Railway in prod) | One DB for app data, auth tables and job queues. |
| ORM / migrations | **Drizzle** + `postgres-js` | `casing: "snake_case"`, schema per feature file, SQL migrations in `drizzle/`. |
| Auth | **better-auth** | Email+password, email OTP, magic link. Drizzle adapter. Server-side session helpers. |
| Background jobs | **pg-boss** | Queues in Postgres (`pgboss` schema). Separate worker process. Cron via `boss.schedule`. |
| UI | **Tailwind v4 + shadcn/ui** (radix-nova, neutral) | `lucide-react` icons, `sonner` toasts, `next-themes`. `cn()` from `@/lib/utils`. |
| Forms | **react-hook-form + zod** | shadcn `Field*` components. Same zod shape client + server. |
| Email | `sendEmail()` → **Mailpit** (dev) / **Resend** (prod) | Switched purely by env. Templates in `src/lib/email/templates.ts`. |
| Files | **S3 API** → **MinIO** (dev) / Railway bucket, R2 or S3 (prod) | Presigned upload/download URLs; browser never sees credentials. |
| Logging | **pino** | `logger.info({ ctx }, "dotted.event")`. Pretty in dev, JSON in prod. |
| Lint/format | **Biome** | Replaces ESLint + Prettier. `bun run lint:fix`. |
| Tests | **`bun test`** (unit) + **Playwright** (e2e) | Unit = domain logic with fake db. E2E = real stack, Mailpit API for OTPs. |
| Local infra | **Docker Compose** | Postgres, MinIO (+bucket), Mailpit. App runs natively for fast reload. |
| Hosting | **Railway** | `web` + `worker` services from one Dockerfile, Postgres, bucket. Health `/api/health`. |

## 3. How a request flows

```
Browser ──▶ src/app/(app)/notes/page.tsx        (RSC: requireSession → domain query → render)
        ──▶ note-form.tsx (client)               (react-hook-form + zod)
              └─▶ actions.ts  createNoteAction   (defineAction: zod → requireSessionAction → domain → revalidatePath)
                    └─▶ src/lib/domain/notes/mutations.ts  createNote(userId, input, db)   ← business rules
                          └─▶ src/lib/db (Drizzle) ──▶ Postgres
              optional  └─▶ enqueue(QUEUES.X, payload)  ──▶ pgboss table ──▶ worker/index.ts ──▶ handler
```

Layers, top to bottom, and the rule for each:

| Layer | Path | Allowed to know about |
|---|---|---|
| Route / page / layout | `src/app/**/page.tsx`, `layout.tsx` | session helpers, domain **queries**, components |
| Client component | `*.tsx` with `"use client"` | UI components, its own action(s), `authClient` |
| Server action | `src/app/**/actions.ts` | zod, `requireSessionAction`, domain functions, `revalidatePath` |
| Route handler | `src/app/api/**/route.ts` | same as actions; only for webhooks/health/external callers |
| Domain | `src/lib/domain/<feature>/{queries,mutations}.ts` | `db`, schema, errors, jobs `enqueue`, storage, email. **No Next imports.** |
| Infrastructure | `src/lib/{db,auth,jobs,email,storage,observability,env}` | the outside world |
| Worker | `worker/index.ts`, `src/lib/jobs/handlers/*` | domain + infrastructure |

If a domain function needs something request-specific (the user id, a file), it's passed in as an argument.

## 4. Directory map

```
src/
  app/
    (auth)/            sign-in, sign-up, verify (OTP), forgot-password, reset-password — public
    (app)/             everything requiring sign-in; (app)/layout.tsx calls requireSession()
      <feature>/       page.tsx + actions.ts + *-form.tsx / *-list.tsx colocated
    api/auth/[...all]  better-auth handler          api/health   Railway health check
    layout.tsx  page.tsx  error.tsx  not-found.tsx  globals.css
  components/
    ui/                shadcn (generated — add with `bunx shadcn add x`, never hand-edit)
    app-shell/         header, user menu            forms/       SubmitButton etc.
  lib/
    env.ts             zod-validated env — the ONLY place process.env is read
    db/client.ts       db + pgClient                db/schema/   shared.ts, auth.ts, <feature>.ts, index.ts
    auth/              auth.ts (server), client.ts (browser), session.ts (getSession/requireSession)
    server/            action.ts (defineAction), errors.ts (AppError family)
    domain/<feature>/  queries.ts, mutations.ts     jobs/        queues.ts, queue.ts, handlers/
    email/             send.ts, templates.ts        storage/     s3.ts (presign helpers)
    observability/     logger.ts                    utils.ts     cn()
worker/index.ts        the background process
scripts/               setup/dev.ts, seed.ts, db-reset.ts (bun scripts, not app code)
tests/unit/ tests/e2e/ tests/setup.ts
drizzle/               generated SQL migrations + meta (commit them, never edit applied ones)
```

Naming: files **kebab-case**; React components **PascalCase** exports; one component per file;
named exports everywhere except Next's required default exports (page/layout/error/not-found).
Import via `@/…`. No barrel files except `db/schema/index.ts`.

## 5. Patterns (copy these)

### 5.1 New table
```ts
// src/lib/db/schema/projects.ts
import { index, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, publicId, timestamps } from "./shared";

export const project = pgTable("project", {
  id: id(),                 // bigint identity — internal only
  publicId: publicId(),     // cuid2 — goes in URLs
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text().notNull(),
  ...timestamps(),
}, (t) => [index("project_user_id_idx").on(t.userId)]);
export type Project = typeof project.$inferSelect;
```
Then: add `export * from "./projects"` to `schema/index.ts` → `bun run db:generate --name add_project` →
read the SQL → `bun run db:migrate`. Enums: `pgEnum("project_status", ["draft","live"])`. Every FK
gets an index. Money: `numeric` or integer minor units — never float. Prefer columns over JSON blobs;
`jsonb` only for genuinely schemaless payloads.

### 5.2 Domain module
```ts
// src/lib/domain/projects/mutations.ts
export const createProject = async (userId: string, input: { name: string }, db: Db = defaultDb) => {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Name is required.", { name: ["Name is required."] });
  const [row] = await db.insert(project).values({ userId, name }).returning({ publicId: project.publicId });
  if (!row) throw new Error("Insert returned no row");
  return row;
};
```
Rules: takes `userId` (or the session) explicitly · every read/write is scoped by ownership in the
`where` · throws `ValidationError / NotFoundError / ForbiddenError / ConflictError` · returns exactly
what callers need · uses `db.transaction(async (tx) => …)` when >1 write must succeed together.

### 5.3 Server action
```ts
"use server";
export const createProjectAction = defineAction(
  z.object({ name: z.string().trim().min(1).max(120) }),
  async (input) => {
    const { user } = await requireSessionAction();
    const created = await createProject(user.id, input);
    revalidatePath("/projects");
    return created;
  },
  { name: "createProject" },
);
```
Always `defineAction`. Result is `{ ok: true, data } | { ok: false, error, message, fieldErrors? }`.
Redirect after success from the client (`router.push`) or via `redirect()` inside the handler.

### 5.4 Page (server component)
```tsx
export default async function ProjectsPage() {
  const { user } = await requireSession();
  const projects = await listProjectsForUser(user.id);
  return <ProjectsList projects={projects} />;   // pass plain data down
}
```
Dynamic segments: `params`/`searchParams` are **Promises** — `const { id } = await params;`. Type
props with the global `PageProps<"/projects/[id]">` / `LayoutProps<"/">` helpers (run `bun run typecheck`
which regenerates route types).

### 5.5 Client form
`react-hook-form` + `zodResolver` + shadcn `Field/FieldLabel/FieldError` + `SubmitButton`; on
submit call the action inside `startTransition`, map `fieldErrors` back with `form.setError`, toast
the `message` on failure, `form.reset()` + `toast.success` on success. See
`src/app/(app)/notes/note-form.tsx` — copy it.

### 5.6 Background job
1. `queues.ts`: add `PROJECT_EXPORT: "project.export"` + payload type + `JobPayloads` entry.
2. `handlers/project-export.ts`: `boss.work<Payload>(QUEUES.PROJECT_EXPORT, async (jobs) => { for (const job of jobs) … })`.
3. Register it in `handlers/index.ts`.
4. Producer: `await enqueue(QUEUES.PROJECT_EXPORT, { projectId })` from a domain function or action.
Handlers must be **idempotent** (retries happen). Scheduled work: `await boss.schedule(QUEUES.X, "0 3 * * *")` in `worker/index.ts`.
Track long jobs with a status column on the entity (`state: 'queued' | 'running' | 'done' | 'failed'`), never by polling pg-boss from the UI.

### 5.7 Email
`await sendEmail({ to, ...someTemplate(args) })` for mail the current user is waiting on (OTP,
reset). Everything else: `enqueue(QUEUES.SEND_EMAIL, { to, ...template })`. New template = a
function in `templates.ts` returning `{ subject, html, text }`. Locally, open http://localhost:8025.

### 5.8 File upload
Server action returns `{ key, url: await presignUpload(key, contentType) }` (key from
`objectKey("uploads/" + user.id, filename)`); the browser `PUT`s the file to `url`; a second action
records `key` on the entity. Reads: `presignDownload(key)`. Delete: `deleteObject(key)` — from a job
if it's a cascade.

### 5.9 New env var
Add to the zod schema in `src/lib/env.ts` (required or `.optional()` with a sensible default) →
add to `.env.example` with a comment → add to `.env.local` → tell Railway (`railway variables set`).
Public (browser) vars must be prefixed `NEXT_PUBLIC_`.

### 5.10 New shadcn component
`bunx shadcn add <name>` (e.g. `sheet`, `command`, `calendar`, `data-table`). Never edit
`components/ui/*` by hand; wrap/compose in your own component instead.

## 6. Auth & authorization

- Flows: password (`authClient.signIn.email`), 6-digit code (`emailOtp.sendVerificationOtp` →
  `/verify` → `signIn.emailOtp`), magic link (`signIn.magicLink`), forgot/reset password. All emails
  arrive in Mailpit locally.
- **Server**: `getSession()` (nullable), `requireSession()` (redirects), `requireSessionAction()` (throws).
  `(app)/layout.tsx` already guards every route inside it. `proxy.ts` is not needed for auth.
- **Client**: `useSession()` for display only, never for authorization.
- **Authorization = the query.** Filter by `userId` (or membership) in the domain function itself.
  A missing row for another user's id is a `NotFoundError`, not a `ForbiddenError` (don't leak existence).
- Roles/orgs when needed: better-auth `admin` / `organization` plugins, or a `role` column via
  `user.additionalFields`. Not before.
- SMS OTP when needed: better-auth `phoneNumber` plugin with a `sendOTP` callback (Twilio); stub to
  logger locally. Not before.

## 7. Data conventions

- Tables singular (`note`, `project`); columns snake_case (Drizzle does it); `created_at/updated_at`
  everywhere; `deleted_at` only if the product needs undo — default is hard delete with cascades.
- `publicId` in every URL/API; internal `id` for joins.
- Timestamps `withTimezone`; store UTC; format in the UI (`Intl.DateTimeFormat`, or add `date-fns` when needed).
- Migrations: forward-only. Renames: drizzle-kit asks "rename or create+drop?" — answer rename.
  A migration that's been committed/pushed is immutable — write a new one.
- Seed = reference data only (plans, roles, lookup rows). Sample content goes in e2e fixtures.

## 8. Testing

| Kind | Tool | What | Where |
|---|---|---|---|
| Unit | `bun test` | domain rules with a fake `db`; pure helpers | `tests/unit/*.test.ts` |
| E2E | Playwright | one happy-path spec per feature, real browser + stack; OTP via Mailpit API | `tests/e2e/*.spec.ts` |
| Manual | Playwright MCP | click through the feature before calling it done; screenshot key screens | — |

Don't unit-test React components or Drizzle queries; the e2e spec covers them. Selectors: `getByRole`,
`getByLabel` — accessible names, not CSS.

## 9. Git workflow (solo builder, reviewer merges)

- Work on the **working branch** named in the repo's `AGENTS.md` (default `dev`). Never commit to `main`.
- `/stack:ship` = `bun run check` → conventional commit → `git push`. Never `--force`, never
  `reset --hard`, never rewrite pushed history. Conflicts on push → `git pull --rebase`, resolve, push;
  if unsure, stop and ask.
- Commit per feature or coherent slice: `feat(scope): …`, `fix(scope): …`, `chore: …`, `test(e2e): …`,
  `refactor(scope): …`, `docs: …`. Subject ≤ 72 chars, imperative.
- Secrets never enter git: `.env.local` is ignored; keys go in Railway variables.

## 10. Deployment (Railway)

One Railway project per app: **`web`** (Dockerfile → `railway.toml`; start = migrate then serve;
health `/api/health`), **`worker`** (same Dockerfile; config path `railway.worker.toml`; start
`bun run worker`), **Postgres**, and a **bucket** (S3-compatible). Env vars on both app services:
`APP_URL`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `BETTER_AUTH_SECRET`, `EMAIL_FROM`,
`RESEND_API_KEY`, `S3_*` (from the bucket), `LOG_LEVEL=info`, `NODE_ENV=production`. Deploy branch is
`dev` while one person is building, `main` once releases are reviewed. `/stack:deploy` does this.

## 11. Explicitly not in v1 (and how to add later)

| Need | Add when real | How |
|---|---|---|
| AI features | a feature calls for it | Vercel AI SDK + `@ai-sdk/anthropic`; `src/lib/ai/`; `ANTHROPIC_API_KEY` in env |
| Payments | first paid plan | Stripe Checkout + webhook route handler + `subscription` table; job for webhook side effects |
| Roles / teams | second user type or org sharing | better-auth `organization`/`admin` plugin |
| Error tracking | first real users | `@sentry/nextjs`, DSN in env |
| Analytics | first marketing question | PostHog |
| Realtime | a screen must update without refresh | start with polling; then SSE route handler |
| Cron | first scheduled task | `boss.schedule()` in worker — no new service |
| Search | LIKE isn't enough | Postgres full-text (`tsvector`) before any search service |
| Caching | a measured slow page | Next `use cache` (`cacheComponents`) — cheat sheet |
| i18n, feature flags, admin panel, monorepo, tRPC, react-query, Redis | — | not until a concrete, present need |
