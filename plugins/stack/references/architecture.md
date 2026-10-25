# The stack — architecture & conventions

This is how apps built with the `stack` plugin are put together. Read it before writing code in a
project created by `/stack:new-app`. It is opinionated on purpose: one way to do each thing, so
product thinking is where the effort goes. Companion doc: `next16-cheatsheet.md` (Next.js gotchas).

## 1. Principles

1. **YAGNI, aggressively.** Build what the current feature needs. No abstractions "for later", no
   extra services, no monorepo, no state libraries, no config flags for hypothetical futures. When
   a real need arrives, the layered design makes adding things cheap.
2. **Boring, proven tech — on its latest stable release.** Everything below has been used across many
   production apps. Don't swap a piece for something else without discussing it; do keep every piece
   on its newest stable version (§12).
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
| Package manager / scripts | **Bun** (+ **Node LTS** installed) | `bun install`, `bun run`, `bun test`, `bunx`. Not npm/pnpm/yarn. Next itself runs under Node (its bin shebang); Bun runs the worker and scripts. |
| Language | **TypeScript** (strict) | `type` over `interface`; no `any`; explicit return types on domain functions. |
| Framework | **Next.js** (app router, latest) | Turbopack. RSC + server actions. `proxy.ts` not `middleware.ts`. See cheat sheet. |
| Database | **Postgres** (18 locally, Railway in prod) | One DB for app data, auth tables and job queues. |
| ORM / migrations | **Drizzle** + `postgres-js` | `casing: "snake_case"`, schema per feature file, SQL migrations in `drizzle/`. |
| Auth | **better-auth** | Email+password, email OTP, magic link. Drizzle adapter. Server-side session helpers. |
| Background jobs | **pg-boss** | Queues in Postgres (`pgboss` schema). Separate worker process. Cron via `boss.schedule`. |
| UI | **Tailwind v4 + shadcn/ui** (radix-nova, neutral) | `lucide-react` icons, `sonner` toasts, `next-themes`. `cn()` from `@/lib/utils`. |
| Forms | **react-hook-form + zod** | shadcn `Field*` components. Same zod shape client + server. |
| Email | `sendEmail()` → **Mailpit** (dev) / **Resend** (prod) | Switched purely by env. Templates in `src/lib/email/templates.ts`. |
| Files | **S3 API** → **RustFS** (dev) / Railway bucket, R2 or S3 (prod) | Presigned upload/download URLs; browser never sees credentials. Bucket + CORS (APP_URL only) via `bun run storage:setup`. |
| Logging | **pino** | `logger.info({ ctx }, "dotted.event")`. Pretty in dev, JSON in prod. |
| Lint/format | **Biome** | Replaces ESLint + Prettier. `bun run lint:fix`. |
| Tests | **`bun test`** (unit) + **Playwright** (e2e) | Unit = domain logic with fake db. E2E = real stack, Mailpit API for OTPs. |
| Local infra | **Docker Compose** | Postgres, RustFS, Mailpit (image tags pinned). App runs natively for fast reload: `bun run dev` = web + worker in one terminal (`scripts/dev.ts`). |
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
    auth/              auth.ts (server), client.ts (browser), session.ts (getSession/requireSession),
                       signup-policy.ts (SIGNUP_ALLOWLIST: who may create an account)
    server/            action.ts (defineAction), errors.ts (AppError family)
    domain/<feature>/  queries.ts, mutations.ts     jobs/        queues.ts, queue.ts, handlers/
    email/             send.ts, templates.ts        storage/     s3.ts (presign helpers)
    observability/     logger.ts                    utils.ts     cn()
worker/index.ts        the background process
scripts/               dev.ts (web+worker), setup/dev.ts, seed.ts, db-reset.ts (bun scripts, not app code)
.githooks/             pre-push guard (no pushes to main, no force) — installed by setup
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
Handlers must be **idempotent** (retries happen). Keep `batchSize: 1` (the default): a throw fails and
retries the whole batch, repeating side effects for jobs that already succeeded. Batch only with
`perJobResults: true`. Scheduled work: `await boss.schedule(QUEUES.X, "0 3 * * *")` in `worker/index.ts`.
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
- **Every account confirms its email before it gets a session** (`requireEmailVerification`). A password
  sign-up, or a password sign-in that was never confirmed, gets a 403 `EMAIL_NOT_VERIFIED` and an
  "email-verification" code; `/verify?purpose=verify` calls `emailOtp.verifyEmail` (signs them in, keeps
  the password). Never confirm with a *sign-in* code — on an unconfirmed account that deletes the
  password (anti-takeover). This is what makes `SIGNUP_ALLOWLIST` mean anything: otherwise anyone can
  sign up as an allowed address. Consequence: production needs working email before anyone can join.
- **Server**: `getSession()` (nullable), `requireSession()` (redirects), `requireSessionAction()` (throws).
  `(app)/layout.tsx` guards every route inside it for UX, but layouts don't re-render on client-side
  navigation — so **every page calls `requireSession()` and every action calls `requireSessionAction()`
  itself** (cheap: cookie-cached). `proxy.ts` is not needed for auth.
- **Client**: `useSession()` for display only, never for authorization.
- **Authorization = the query.** Filter by `userId` (or membership) in the domain function itself.
  A missing row for another user's id is a `NotFoundError`, not a `ForbiddenError` (don't leak existence).
- **Who can sign up** = `SIGNUP_ALLOWLIST` (env; empty = anyone; emails and/or `@domains`), enforced in
  better-auth's `user.create.before` hook so every method obeys it. Invite-only apps just set it in prod.
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
- `/stack:ship` = merge `origin/main` into the working branch (so reviewed fixes flow back) → `bun run check`
  → conventional commit → `git push`. Never `--force`, never `reset --hard`, never rewrite pushed history.
  Conflicts → resolve if trivial, else stop and ask. Guard-rails enforce this twice: the plugin's
  PreToolUse hook (`scripts/guard.sh`, only inside stack projects) and `.githooks/pre-push`.
  The reviewer pushes to main from their own shell (`STACK_ALLOW_MAIN=1 git push`); inside Claude Code the
  hook only honours that for a new app's first push.
- Commit per feature or coherent slice: `feat(scope): …`, `fix(scope): …`, `chore: …`, `test(e2e): …`,
  `refactor(scope): …`, `docs: …`. Subject ≤ 72 chars, imperative.
- **CI** (`.github/workflows/ci.yml`): every push runs `check`, the production build and the e2e suite
  against real Postgres/RustFS/Mailpit. Once live, `wip` saves stay local (never pushed), and Railway's
  "Wait for CI" means only green commits deploy.
- Secrets never enter git: `.env.local` is ignored; keys go in Railway variables.

## 10. Deployment (Railway)

One Railway project per app, **declared in `.railway/railway.ts`** (Railway Infrastructure as Code,
`railway/iac`; `railway config plan` / `apply`): **`web`** (Dockerfile; pre-deploy = `db:migrate`,
start = `bun run start`, health `/api/health`), **`worker`** (same Dockerfile; start `bun run worker`,
restart `ALWAYS`), **Postgres**, and a **bucket** (S3-compatible, wired by reference). Only secrets
(`BETTER_AUTH_SECRET`, `RESEND_API_KEY`) are set by hand; the file `preserve()`s them. A plan that
destroys anything is never applied (the guard blocks `--confirm-destructive`). Apps deployed before the
file existed are adopted with `railway config pull` (`/stack:deploy` → Adopt). `railway.toml` is the
deprecated Config as Code — Railway stops reading it on 2026-12-01. Env vars on both app services:
`APP_URL`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `BETTER_AUTH_SECRET`, `EMAIL_FROM`,
`RESEND_API_KEY`, `SIGNUP_ALLOWLIST`, `S3_*` (from the bucket), `LOG_LEVEL=info`,
`NODE_ENV=production`. Deploy branch is `dev` (the builder sees their work live; `main` is the reviewed
copy), with **Wait for CI** on for both services. The worker restarts `ALWAYS` (no retry cap — nothing
else would notice it was down); `/stack:status` checks both services. Postgres backups on.
`/stack:deploy` does this.

## 11. Explicitly not in v1 (and how to add later)

| Need | Add when real | How |
|---|---|---|
| AI features | a feature calls for it | Vercel AI SDK + `@ai-sdk/anthropic`; `src/lib/ai/`; `ANTHROPIC_API_KEY` in env |
| Payments | first paid plan | Stripe Checkout + webhook route handler + `subscription` table; job for webhook side effects |
| Roles / teams | second user type or org sharing | better-auth `organization`/`admin` plugin |
| Analytics | first marketing question | PostHog |
| Realtime | a screen must update without refresh | start with polling; then SSE route handler |
| Cron | first scheduled task | `boss.schedule()` in worker — no new service |
| Search | LIKE isn't enough | Postgres full-text (`tsvector`) before any search service |
| Caching | a measured slow page | Next `use cache` (`cacheComponents`) — cheat sheet |
| i18n, feature flags, admin panel, monorepo, tRPC, react-query, Redis | — | not until a concrete, present need |

## 12. Versions: latest stable, always

- **Policy**: every npm dependency, the runtimes (newest **Node LTS**, newest **Bun**) and every Docker image
  stay on their newest *stable* release. Not betas, RCs or canaries (e.g. Drizzle 1.0 while it's an RC,
  Postgres 19rc). Falling behind is how a stack rots: MinIO's images vanished from Docker Hub and every
  app pinned to them broke on a fresh machine.
- **Checked automatically**: `${CLAUDE_PLUGIN_ROOT}/scripts/versions.ts` runs at the start of every session
  (cached 6 h) and at the start of every `/stack:feature`. It compares `package.json` (via `bun outdated`),
  `packageManager`, the Dockerfile, `docker-compose.yml`, the workflow actions and the plugin against the
  live registries, and prints the exact `bun add …@latest` lines.
- **3-day cooldown**: `bunfig.toml` `[install] minimumReleaseAge = 259200`, and the check ignores npm,
  Bun, Node, Docker and Action releases younger than that. Hijacked releases are usually pulled within
  hours; "latest" means latest *that has survived three days*. Never bypass it.
- **Upgraded deliberately**: `/stack:upgrade` — patch/minor in one go; each major on its own after reading its
  release notes; shadcn components refreshed from the registry; runtimes and images bumped; then the full
  check, e2e and a browser click-through. Saved as its own change, before feature work.
- **New dependencies**: `bun add <pkg>@latest`, `bunx shadcn@latest add <component>`; read the docs for the
  installed version (Context7) rather than relying on memory.
- **Image tags are pinned** (`rustfs/rustfs:1.0.4`, `axllent/mailpit:v1.32.0`) so upgrades are visible in
  git. Postgres pins only its major (`18-alpine`): a major bump means resetting local data, and the live
  database is upgraded separately on Railway (needs Matt).
