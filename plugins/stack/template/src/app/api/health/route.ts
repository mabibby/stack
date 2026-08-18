import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** Railway health check + a quick "is everything wired?" for humans. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" });
  } catch (err) {
    return Response.json(
      { ok: false, db: "down", error: err instanceof Error ? err.message : "unknown" },
      { status: 503 },
    );
  }
}
