# **APP_TITLE**

Built on the **stack** template: Bun · Next.js · Postgres/Drizzle · better-auth · pg-boss · Tailwind/shadcn · Railway.

## Run it locally

Prereqs (once): [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running), [Node LTS](https://nodejs.org), [Bun](https://bun.sh), git.

```bash
bun install
bun run setup        # starts Postgres/RustFS/Mailpit in Docker, migrates, seeds, writes .env.local
bun run dev          # http://localhost:__PORT_WEB__ — web app + background worker together
```

| Thing                     | Where                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| App                       | http://localhost:**PORT_WEB**                                                                     |
| Every email the app sends | http://localhost:**PORT_MAIL** (Mailpit)                                                          |
| Uploaded files            | http://localhost:**PORT_S3_CONSOLE**/rustfs/console/ (RustFS console, `rustfs` / `rustfs-secret`) |
| Database browser          | `bun run db:studio`                                                                               |

## Everyday commands

```bash
bun run check        # lint + typecheck + unit tests — must be green before pushing
bun run test:e2e     # Playwright, uses the running dev server
bun run db:generate --name <change>   # after editing src/lib/db/schema/*
bun run db:migrate
bun run db:reset     # LOCAL ONLY: wipe data + start again
bun run infra:down   # stop the Docker services
stack ls             # all your apps, their URLs, which are running
```

## How the app is organised

Read [`AGENTS.md`](./AGENTS.md) — the rules and layout in one page. The `notes` feature is a complete
worked example of the pattern (schema → domain → server action → form → e2e test); copy it, then delete it.

## Who can sign up?

Locally anyone can (tests rely on it). In production set `SIGNUP_ALLOWLIST` on Railway to a comma-separated
list of emails and/or `@domains` to make the app invitation-only. Leave it empty for public sign-up.

## Deploying

Railway, all declared in `.railway/railway.ts`: `web` and `worker` (same Dockerfile), a Postgres
database and a bucket for uploads, with every setting and variable. `railway config plan` shows what
would change, `railway config apply` makes it so; `/stack:deploy` walks through it. Migrations run as
web's pre-deploy step. Health: `/api/health`.
