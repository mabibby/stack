import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, isDev, isProd } from "@/lib/env";
import * as schema from "./schema";

/**
 * Single shared Postgres pool + Drizzle instance.
 * Cached on globalThis in dev so Next's HMR doesn't open a new pool per reload.
 */
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

const pgClient =
  globalForDb.pgClient ??
  postgres(env.DATABASE_URL, {
    max: isProd ? 10 : 4,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (!isProd) globalForDb.pgClient = pgClient;

export const db = drizzle(pgClient, { schema, casing: "snake_case", logger: isDev });

export type Db = typeof db;
export { pgClient };
