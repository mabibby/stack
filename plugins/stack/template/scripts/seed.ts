#!/usr/bin/env bun
/**
 * Seed data for local development. Idempotent (upserts). Runs on `bun run setup`
 * and `bun run db:seed`. Never runs in production.
 * Add reference data here (roles, lookup tables) — NOT sample user content.
 */
import { pgClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

const seed = async () => {
  // Example: nothing to seed yet. When you add reference tables, upsert them here:
  //   await db.insert(plan).values([...]).onConflictDoNothing();
  logger.info("seed.done (nothing to seed yet)");
};

seed()
  .then(() => pgClient.end())
  .catch(async (err) => {
    logger.error({ err }, "seed.failed");
    await pgClient.end();
    process.exit(1);
  });
