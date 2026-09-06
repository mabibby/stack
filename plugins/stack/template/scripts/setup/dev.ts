#!/usr/bin/env bun
/**
 * One-command local bootstrap: `bun run setup`. Idempotent — safe to re-run any time.
 *  1. Ensure Docker is running.
 *  2. Create .env.local from .env.example (with a fresh BETTER_AUTH_SECRET) if missing.
 *  3. docker compose up -d  (Postgres, MinIO + bucket, Mailpit).
 *  4. Wait for health checks.
 *  5. Run DB migrations, then seed.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const log = (msg: string) => console.log(`▸ ${msg}`);
const fail = (msg: string): never => {
  console.error(`\n✘ ${msg}\n`);
  process.exit(1);
};

const run = (cmd: string, args: string[], env: Record<string, string> = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} failed (exit ${r.status ?? "signal"})`);
};
const quiet = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim() };
};

// 1. Docker
if (!quiet("docker", ["info"]).ok) {
  fail(
    "Docker isn't running. Open Docker Desktop, wait for the whale to settle, then run `bun run setup` again.",
  );
}

// 2. .env.local
if (existsSync(".env.local")) {
  log(".env.local exists — leaving it alone");
} else {
  const secret = randomBytes(32).toString("base64url");
  const example = readFileSync(".env.example", "utf8").replace(
    /^BETTER_AUTH_SECRET=.*$/m,
    `BETTER_AUTH_SECRET=${secret}`,
  );
  writeFileSync(".env.local", example);
  log("created .env.local from .env.example (fresh BETTER_AUTH_SECRET)");
}

// 3. infra — first, politely stop another compose project (usually another stack app) that
// already holds one of the host ports this project publishes.
const composeConfig = quiet("docker", ["compose", "config", "--format", "json"]).out;
const thisProject = composeConfig.match(/"name":\s*"([^"]+)"/)?.[1] ?? "";
const publishedPorts = [...composeConfig.matchAll(/"published":\s*"?(\d+)"?/g)].map((m) => m[1]);
const holders = new Set<string>();
for (const port of publishedPorts) {
  const projects = quiet("docker", [
    "ps",
    "--filter",
    `publish=${port}`,
    "--format",
    '{{.Label "com.docker.compose.project"}}',
  ]).out.split("\n");
  for (const p of projects.map((s) => s.trim())) if (p && p !== thisProject) holders.add(p);
}
for (const other of holders) {
  log(`stopping containers of another project ("${other}") that hold the local ports`);
  const ids = quiet("docker", [
    "ps",
    "-q",
    "--filter",
    `label=com.docker.compose.project=${other}`,
  ]).out;
  if (ids) run("docker", ["stop", ...ids.split("\n").filter(Boolean)]);
}

log("docker compose up -d");
run("docker", ["compose", "up", "-d", "--remove-orphans"]);

// 4. health
const projectName = thisProject;
const waitHealthy = async (service: string, timeoutMs = 90_000) => {
  const container = `${projectName}-${service}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = quiet("docker", ["inspect", "--format", "{{.State.Health.Status}}", container]);
    if (r.ok && r.out === "healthy") return;
    await Bun.sleep(750);
  }
  fail(
    `${container} didn't become healthy in ${timeoutMs / 1000}s — try \`docker compose logs ${service}\``,
  );
};
log("waiting for postgres, minio, mailpit…");
await waitHealthy("postgres");
await waitHealthy("minio");
await waitHealthy("mailpit");
log("infrastructure healthy");

// 5. migrate + seed (drizzle-kit reads .env.local via Next-style dotenv? No — pass it explicitly)
const envLocal = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [
        l.slice(0, idx).trim(),
        l
          .slice(idx + 1)
          .trim()
          .replace(/^"(.*)"$/, "$1"),
      ];
    }),
);
log("running migrations");
run("bun", ["run", "db:migrate"], envLocal);
log("seeding");
run("bun", ["run", "db:seed"], envLocal);

// 6. git guard-rails (no pushes to main, no force pushes) — only once this is a git repo.
if (existsSync(".git")) {
  run("git", ["config", "core.hooksPath", ".githooks"]);
  log("git hooks installed (.githooks)");
}

console.log(`
✅ Ready.

  bun run dev          → app on http://localhost:__PORT_WEB__ (web + background worker together)

  Mailpit (all email lands here):  http://localhost:__PORT_MAIL__
  MinIO console:                    http://localhost:__PORT_MINIO_CONSOLE__  (minio / minio-secret)
  Drizzle Studio (browse the DB):   bun run db:studio
`);
