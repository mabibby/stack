import { desc, eq } from "drizzle-orm";
import { type Db, db as defaultDb } from "@/lib/db/client";
import { note } from "@/lib/db/schema";

/**
 * Domain layer, read side. Plain async functions that take a `db` (so tests can
 * pass a transaction) and return exactly the shape callers need — never `select *`
 * blindly into the UI. No Next.js imports here: this must run in the worker too.
 */
export type NoteListItem = {
  publicId: string;
  title: string;
  body: string;
  createdAt: Date;
};

export const listNotesForUser = async (
  userId: string,
  db: Db = defaultDb,
): Promise<NoteListItem[]> =>
  db
    .select({
      publicId: note.publicId,
      title: note.title,
      body: note.body,
      createdAt: note.createdAt,
    })
    .from(note)
    .where(eq(note.userId, userId))
    .orderBy(desc(note.createdAt));
