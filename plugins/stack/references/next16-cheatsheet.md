# Next.js 16 conventions cheat sheet (verified against next@16.3.1 bundled docs)

Source of truth: `node_modules/next/dist/docs/` (bundled since 16.2). Read it before guessing; training data predates most of this.

## 0. Defaults and toolchain (16.3)
- Requires Node.js >= 20.9, TypeScript >= 5.1. App Router ships React 19.2 canary (`Activity`, `useEffectEvent`, View Transitions).
- **Turbopack is the default** for `next dev` and `next build`. A custom `webpack` config makes `next build` FAIL; use `--webpack` to opt out.
- **`cacheComponents` is OPT-IN, not default.** Without it you are on the "previous model" (fetch not cached, `dynamic`/`revalidate` segment configs). Enabling it turns on `use cache`, PPR-by-default, `cacheLife`/`cacheTag`, and REMOVES `dynamic`, `dynamicParams`, `revalidate`, `fetchCache` segment configs.
- **React Compiler is stable but OPT-IN** (`reactCompiler: true` + `npm i -D babel-plugin-react-compiler`). Not enabled by default.
- `next lint` is removed; `next build` no longer lints. Use `eslint` (flat config, `eslint.config.mjs`) or Biome via package.json scripts. `eslint` key in next.config is removed.
- `next dev` writes to `.next/dev` (separate from build) and a lockfile at `.next/dev/lock` (second `next dev` prints the running PID/URL).
- create-next-app defaults: TS, Tailwind, ESLint, App Router, Turbopack, `@/*` alias, `AGENTS.md` (+ `CLAUDE.md`). Custom setup additionally asks about React Compiler (No/Yes), linter (ESLint/Biome/None), `src/`.
- Default `next.config.ts` from the docs (nothing enabled):
```ts
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents: true,     // opt-in Cache Components / PPR
  // reactCompiler: true,       // opt-in
  // typedRoutes: true,         // stable (was experimental.typedRoutes)
  // output: 'standalone',      // for Docker
  // experimental: { authInterrupts: true }, // for forbidden()/unauthorized()
}
export default nextConfig
```
- `next.config.js|mjs|ts` supported; `.cjs`/`.cts` are NOT. `turbopack` is top-level (was `experimental.turbopack`).

## 1. Breaking vs older Next (memorize)
- `middleware.ts` -> **`proxy.ts`**; export `proxy` (named or default). Runtime is Node.js only; `runtime` config in proxy throws. `skipMiddlewareUrlNormalize` -> `skipProxyUrlNormalize`. Codemod: `npx @next/codemod@canary middleware-to-proxy .`
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are **async only** (sync access fully removed in 16). Also async: `params` in route.ts/default.js/opengraph-image/icon, `id` in sitemap.
- `revalidateTag(tag)` single-arg is deprecated -> **`revalidateTag(tag, 'max')`**. New **`updateTag(tag)`** (Server Actions only, read-your-writes) and **`refresh()`** (Server Actions only). `unstable_cacheLife/cacheTag` -> `cacheLife`/`cacheTag` from `next/cache`.
- `experimental.ppr`, `experimental_ppr`, `experimental.dynamicIO`, `experimental.useCache` are removed -> `cacheComponents: true`.
- Parallel route slots (`@slot`) REQUIRE `default.js` (build fails otherwise).
- `error.tsx` prop is now **`retry`** (stable 16.3; `reset` still exists but `retry` re-fetches + re-renders and is preferred).
- `serverRuntimeConfig`/`publicRuntimeConfig` removed -> env vars. `unstable_rootParams` -> `next/root-params`. AMP removed. `next/legacy/image` deprecated. `images.domains` deprecated -> `images.remotePatterns`.
- Images: `minimumCacheTTL` default 4h, `qualities` default `[75]`, `imageSizes` drops 16, local-IP optimization blocked, `maximumRedirects` 3.
- Smooth-scroll override removed; add `<html data-scroll-behavior="smooth">` to restore old behavior.
- `runtime = 'edge'` is deprecated; Cache Components requires Node.js runtime.
- Global type helpers `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>` are generated (no import) by `next dev|build|typegen`.

## 2. Project structure
- Top level: `app/`, `public/`, optional `src/` (app + proxy.ts go inside `src/`; `.env*` stay at root), `proxy.ts`, `instrumentation.ts`, `next.config.ts`, `.env*`, `eslint.config.mjs`.
- Routing files: `layout` `page` `loading` `not-found` `error` `global-error` `route` `template` `default` (+ `forbidden`, `unauthorized` when authInterrupts). Metadata files: `favicon.ico`, `icon`, `apple-icon`, `opengraph-image`, `twitter-image`, `sitemap`, `robots`.
- Segments: `[slug]`, `[...slug]`, `[[...slug]]`; groups `(group)` (no URL effect; multiple root layouts; navigating between root layouts = full reload); private `_folder` (not routable); slots `@slot`; interception `(.)` `(..)` `(...)`.
- Hierarchy per segment: layout > template > error (boundary) > loading (Suspense) > not-found > page. `error.tsx` does NOT catch errors in its own segment's layout (use `global-error.tsx` for root).
- A folder is public only when it has `page` or `route`. `route.ts` and `page.tsx` cannot share a segment.

## 3. Pages and layouts (async props)
```tsx
// app/blog/[slug]/page.tsx  — PageProps is global, no import
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params            // Promise<{ slug: string }>
  const { q } = await props.searchParams          // Promise<Record<string, string|string[]|undefined>>
  const post = await getPost(slug)
  if (!post) notFound()                           // from 'next/navigation'
  return <h1>{post.title}</h1>
}
```
- Layouts get `children` + `params` (Promise) but NOT `searchParams`/pathname (use client `useSearchParams`/`usePathname`). Layouts don't re-render on navigation, so don't do per-navigation auth checks there.
- Client Component pages read promises with `use(params)` / `use(searchParams)` from React.
- Root layout must render `<html>` and `<body>`; use `metadata`/`generateMetadata`, never hand-written `<head>` tags.
- Root params under a dynamic root layout (`app/[lang]/layout.tsx`): `import { lang } from 'next/root-params'` (Server Components only).
- Cache Components tip: don't `await params` at the top of a layout; pass the promise down and await inside `<Suspense>` so the shell prerenders.

## 4. Server vs Client Components
- Everything is a Server Component unless the file starts with `'use client'` (before imports). Add it only at the boundary; its imports become client code automatically.
- Client Components cannot be `async`; they receive only serializable props (no functions/classes; server actions are allowed).
- Pass Server Components into Client Components as `children`/props (slots); Context providers are `'use client'` wrappers rendered as deep as possible.
- `import 'server-only'` at top of DAL/data modules => build error if imported into client graph. `client-only` for the reverse. Installing the packages is optional (Next handles them internally).
- Only `NEXT_PUBLIC_*` env vars reach the browser (inlined at build); everything else is server-only.

## 5. Data fetching
- Fetch in async Server Components (fetch, ORM, DB). **`fetch` is NOT cached by default**; identical fetches within one render are memoized.
- Stream slow parts: `loading.tsx` (wraps page in Suspense) or explicit `<Suspense fallback>` around the async child (preferred, more granular). `loading.tsx` cannot cover data awaited in the same segment's layout.
- Parallel: start promises then `Promise.all`; sequential only when dependent. Wrap request-scoped helpers in `React.cache()` to dedupe per request.
- Client fetching: pass a promise from server and `use(promise)` inside Suspense, or SWR/React Query.
- Never call your own Route Handlers from Server Components; call the data layer directly.

## 6. Caching and revalidation
**Without `cacheComponents` (default):** `fetch(url, { cache: 'force-cache' })` or `next: { revalidate, tags }`; `unstable_cache` for non-fetch; segment exports `dynamic` (`'auto'|'force-dynamic'|'error'|'force-static'`), `revalidate` (statically analyzable number/false/0), `fetchCache`. Cookies/headers/searchParams make the route dynamic. GET route handlers dynamic unless `export const dynamic = 'force-static'`.

**With `cacheComponents: true`:** dynamic-by-default, PPR static shell + streaming holes; build fails if uncached/runtime data sits outside `<Suspense>` (dev overlay offers fixes: stream/cache/`export const instant = false`).
```ts
import { cacheLife, cacheTag } from 'next/cache'
export async function getProducts() {
  'use cache'                 // function, component, page, or whole file; must be async
  cacheLife('hours')          // always set one: default|seconds|minutes|hours|days|weeks|max or {stale,revalidate,expire}
  cacheTag('products')        // for on-demand invalidation
  return db.query('select * from products')
}
```
- Cache key = build id + function id + serialized args + closed-over values. Args/returns must be serializable (no class instances). `React.cache` scope is isolated inside `use cache`.
- Inside `use cache` you CANNOT call `cookies()/headers()/searchParams` (error `next-request-in-use-cache`); read them outside and pass values as args. `'use cache: private'` (client-only cache) and `'use cache: remote'` (shared handler) are variants.
- Per-request values (`Math.random`, `Date.now`, sync DB drivers, runtime `process.env`): `await connection()` (`next/server`) or (16.3) `await io()` (`next/cache`, preferred, prefetchable) before them, inside `<Suspense>`.
- Runtime `use cache` store is in-memory per instance (ephemeral on serverless); new deploy invalidates everything. `generateStaticParams` must return >= 1 param with Cache Components.
- Invalidation APIs (`next/cache`): `revalidateTag(tag, 'max')` = stale-while-revalidate, allowed in actions + route handlers; `updateTag(tag)` = expire now, **Server Actions only**; `revalidatePath(path, 'page'|'layout')` (type required for dynamic patterns; use rewrite destination path); `refresh()` = re-render current route without invalidating cache, Server Actions only. Prefer tags over paths.

## 7. Server Actions / mutations
- `'use server'` at top of file (importable from client) or inline in an async function inside a Server Component. Only POST; treated as public endpoints => **auth + authz + validation inside EVERY action**, even if the page already checked. Return only what the UI needs.
- Client dispatch is sequential (no `Promise.all` of actions). `redirect()` throws (call outside try/catch, after revalidation). Setting cookies, `updateTag`, `revalidatePath`, `refresh`, `redirect` re-render the current route in the same roundtrip; `revalidateTag(...,'max')` does not.
- `useActionState(action, initialState)` -> `[state, formAction, pending]`; the action signature becomes `(prevState, formData)`.
```ts
// app/actions.ts
'use server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
const Schema = z.object({ title: z.string().min(1).trim() })
export type State = { errors?: { title?: string[] }; message?: string } | undefined
export async function createPost(_prev: State, formData: FormData): Promise<State> {
  const session = await verifySession()               // throws/redirects if unauthenticated
  const parsed = Schema.safeParse({ title: formData.get('title') })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }
  const post = await db.post.create({ data: { ...parsed.data, authorId: session.userId } })
  updateTag('posts')                                  // read-your-writes
  redirect(`/posts/${post.id}`)                       // throws; keep it last, outside try/catch
}
```
```tsx
'use client'
import { useActionState } from 'react'
import { createPost } from '@/app/actions'
export function Form() {
  const [state, formAction, pending] = useActionState(createPost, undefined)
  return (
    <form action={formAction}>
      <input name="title" required />
      {state?.errors?.title && <p aria-live="polite">{state.errors.title}</p>}
      <button disabled={pending}>Create</button>
    </form>
  )
}
```
- Extra args: `action.bind(null, id)`. Pending in nested button: `useFormStatus()` from `react-dom`. Optimistic: `useOptimistic`.
- Cookies: `const store = await cookies(); store.set(...)/delete(...)` only in Server Functions or Route Handlers (never during render).
- Config: `experimental.serverActions.{allowedOrigins, bodySizeLimit}` (default 1MB). Multi-instance: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (base64, 32 bytes) or you get "Failed to find Server Action".
- Prefer thin actions delegating to a `server-only` Data Access Layer that does auth + ownership (IDOR) checks; take IDs from the client, derive identity from the session.

## 8. Error handling / auth interrupts
```tsx
'use client' // error.tsx MUST be a Client Component
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <button onClick={() => retry()}>Try again</button>
}
```
- `global-error.tsx` (client, must render `<html><body>`) replaces the root layout on failure; no `metadata` export there. `not-found.tsx` + `notFound()`. Component-level boundaries: `catchError(Fallback)` from `next/error` (stable 16.3).
- Expected errors: return values from actions (not throw). Production server error messages are redacted; correlate via `error.digest`.
- `forbidden()` (403) / `unauthorized()` (401) from `next/navigation` + `app/forbidden.tsx` / `app/unauthorized.tsx` **require `experimental.authInterrupts: true`**. They throw (`never`), can't be used in the root layout, are swallowed by try/catch, and must be `await`ed in the render path. Usable in Server Components, Server Functions, Route Handlers.

## 9. Route Handlers (`route.ts`)
```ts
// app/api/users/[id]/route.ts
import type { NextRequest } from 'next/server'
export async function GET(req: NextRequest, ctx: RouteContext<'/api/users/[id]'>) {
  const { id } = await ctx.params                       // params is a Promise
  const q = req.nextUrl.searchParams.get('q')
  return Response.json({ id, q })                       // or NextResponse.json
}
```
- Methods: GET HEAD POST PUT PATCH DELETE OPTIONS (OPTIONS auto-generated). Not cached by default; opt in with `dynamic = 'force-static'` (previous model) or, with Cache Components, prerendered automatically when it touches no runtime data; `use cache` cannot be inside the handler body, extract a helper.
- Cannot coexist with `page.tsx` in the same segment. Auth-check every handler; `updateTag`/`refresh` are NOT allowed here (use `revalidateTag(tag,'max')`).

## 10. `proxy.ts` (formerly middleware)
```ts
// proxy.ts (project root or src/) — Node.js runtime, one file per project
import { NextResponse, type NextRequest } from 'next/server'
export function proxy(request: NextRequest) {           // or export default; may be async
  const session = request.cookies.get('session')?.value // optimistic check only, no DB calls
  if (!session && request.nextUrl.pathname.startsWith('/dashboard'))
    return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'] }
```
- Without `matcher` it runs on every request incl. static assets. `matcher` values must be constants. Forward request headers via `NextResponse.next({ request: { headers } })`. `fetch` cache options have no effect. Server Actions are POSTs to their page path, so a matcher that excludes the path also skips them; never rely on proxy for authz.
- Order: `headers` -> `redirects` (config) -> proxy -> beforeFiles rewrites -> filesystem -> afterFiles -> dynamic routes -> fallback. Not supported with `output: 'export'`.

## 11. Authentication pattern (docs-recommended)
- DAL in `lib/dal.ts` with `import 'server-only'` and `export const verifySession = cache(async () => { const c = (await cookies()).get('session')?.value; const s = await decrypt(c); if (!s?.userId) redirect('/login'); return { userId: s.userId } })`.
- Call `verifySession()`/`getUser()` in pages, leaf components, actions, route handlers - not (only) layouts; do NOT `return null` in layouts as a guard. Client Components can't import the DAL; pass data down.
- Sessions: stateless (jose/iron-session; `httpOnly`, `secure`, `sameSite: 'lax'`, `expires`, `path: '/'`) or DB sessions. Set/delete cookies only in actions/handlers.

## 12. Environment variables
- `.env`, `.env.local`, `.env.development|production|test(.local)`; order: process.env > `.env.$NODE_ENV.local` > `.env.local` (skipped in test) > `.env.$NODE_ENV` > `.env`. `$VAR` expansion supported. Load outside Next with `@next/env` `loadEnvConfig(process.cwd())`.
- `NEXT_PUBLIC_*` are inlined at build (frozen for a Docker image). Runtime server env: read `process.env.X` after `await connection()` (or any request-time API) so it is not baked into a prerender.

## 13. Deploying / self-hosting (Docker)
- `next build` + `next start` supports everything (Cache Components, ISR, proxy, `after`, streaming). Static export (`output: 'export'`) loses server features.
- `output: 'standalone'` emits `.next/standalone` (+ minimal `server.js`, no `node_modules` install needed). It does NOT copy `public/` or `.next/static`; copy them yourself. Docs command: `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/`; run `node server.js` (env `PORT`, `HOSTNAME=0.0.0.0`). Monorepo: `outputFileTracingRoot`; missing native files: `outputFileTracingIncludes`.
```dockerfile
# multi-stage build; runner stage (mirrors the docs' cp commands / examples/with-docker)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```
- Multi-instance: shared `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; consistent build (`generateBuildId`); `deploymentId` for skew protection; ISR/data cache is per-instance disk+memory by default -> `cacheHandler` + `cacheMaxMemorySize: 0` (and `cacheHandlers` for `use cache: remote`), implement `refreshTags()` for cross-instance tag sync.
- Put a reverse proxy in front; nginx needs `X-Accel-Buffering: no` (or disabled buffering) for streaming/PPR. Graceful shutdown: send SIGTERM and allow 10-30s drain so `after()` callbacks finish. Serverless: in-memory `use cache` does not persist.
- `after(cb)` from `next/server`: runs after the response; usable in components, actions, handlers, proxy; not a request-time API.

## 14. Misc config worth knowing
- `serverExternalPackages: ['pkg']` opts server deps out of bundling (many like `@prisma/client`, `@aws-sdk/client-s3`, `sharp` are auto-externalized).
- `typedRoutes: true` (stable) types `<Link href>`; `logging.fetches.fullUrl`, `logging.browserToTerminal` (dev console -> terminal); `experimental.taint` for React taint APIs; `experimental.optimizePackageImports` (Turbopack does this automatically).
- Cache profiles: `cacheLife: { custom: { stale, revalidate, expire } }` in next.config; `expire` must exceed `revalidate`.
- Segment configs still valid: `runtime` (`'nodejs'`), `maxDuration`, `dynamicParams` (not with Cache Components), `instant`/`prefetch` (Cache Components only).
- Dev tooling for agents: Next MCP server at `/_next/mcp` on the dev server; `next build --debug-prerender` for prerender errors; error pages under nextjs.org/docs/messages/*.
