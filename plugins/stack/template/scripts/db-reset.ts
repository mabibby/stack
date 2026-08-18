#!/usr/bin/env bun
/**
 * Nuke local data and start again: drops the docker volumes and re-runs setup.
 * LOCAL ONLY. Useful when migrations get tangled during early development.
 */
import { spawnSync } from "node:child_process";

if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
  console.error("Refusing to reset a non-local database.");
  process.exit(1);
}
console.log("▸ docker compose down -v (deleting local Postgres + MinIO data)");
spawnSync("docker", ["compose", "down", "-v", "--remove-orphans"], { stdio: "inherit" });
console.log("▸ re-running setup");
const r = spawnSync("bun", ["run", "setup"], { stdio: "inherit" });
if (r.status === 0) {
  console.log(
    "⚠  If `bun run dev` or `bun run dev:worker` were running, restart them — they hold connections to the old database.",
  );
}
process.exit(r.status ?? 1);
