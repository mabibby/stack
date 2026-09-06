# __APP_TITLE__

Built on the **stack** template: Bun · Next.js · Postgres/Drizzle · better-auth · pg-boss · Tailwind/shadcn · Railway.

## Run it locally

Prereqs (once): [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running), [Node LTS](https://nodejs.org), [Bun](https://bun.sh), git.

```bash
bun install
bun run setup        # starts Postgres/MinIO/Mailpit in Docker, migrates, seeds, writes .env.local
bun run dev          # http://localhost:3000 — web app + background worker together
```

| Thing | Where |
|---|---|
| App | http://localhost:3000 |
| Every email the app sends | http://localhost:8025 (Mailpit) |
| Uploaded files | http://localhost:9001 (MinIO console, `minio` / `minio-secret`) |
| Database browser | `bun run db:studio` |

## Everyday commands

```bash
bun run check        # lint + typecheck + unit tests — must be green before pushing
bun run test:e2e     # Playwright, uses the running dev server
bun run db:generate --name <change>   # after editing src/lib/db/schema/*
bun run db:migrate
bun run db:reset     # LOCAL ONLY: wipe data + start again
bun run infra:down   # stop the Docker services
```

## How the app is organised

Read [`AGENTS.md`](./AGENTS.md) — the rules and layout in one page. The `notes` feature is a complete
worked example of the pattern (schema → domain → server action → form → e2e test); copy it, then delete it.

## Who can sign up?

Locally anyone can (tests rely on it). In production set `SIGNUP_ALLOWLIST` on Railway to a comma-separated
list of emails and/or `@domains` to make the app invitation-only. Leave it empty for public sign-up.

## Deploying

Railway: three services from this repo — `web` (Dockerfile, `railway.toml`), `worker` (same Dockerfile,
config path `railway.worker.toml`), and a Postgres database, plus a bucket for uploads. `/stack:deploy` walks
through it. Migrations run on web start (`railway.toml` startCommand). Health: `/api/health`.
