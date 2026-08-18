import { and, eq } from "drizzle-orm";
import { type Db, db as defaultDb } from "@/lib/db/client";
import { note } from "@/lib/db/schema";
import { NotFoundError, ValidationError } from "@/lib/server/errors";

/**
 * Domain layer, write side. Business rules live HERE (not in actions, not in
 * components) so they hold whether the caller is a server action, a route
 * handler, a job or a script. Throw AppError subclasses for expected failures.
 */
export const MAX_TITLE = 120;
export const MAX_BODY = 5000;

export type CreateNoteInput = { title: string; body?: string };

export const createNote = async (userId: string, input: CreateNoteInput, db: Db = defaultDb) => {
  const title = input.title.trim();
  const body = (input.body ?? "").trim();
  if (!title) throw new ValidationError("Title is required.", { title: ["Title is required."] });
  if (title.length > MAX_TITLE)
    throw new ValidationError(`Title must be ${MAX_TITLE} characters or fewer.`);
  if (body.length > MAX_BODY)
    throw new ValidationError(`Body must be ${MAX_BODY} characters or fewer.`);

  const [row] = await db
    .insert(note)
    .values({ userId, title, body })
    .returning({ publicId: note.publicId });
  if (!row) throw new Error("Insert returned no row");
  return row;
};

export const deleteNote = async (
  userId: string,
  publicId: string,
  db: Db = defaultDb,
): Promise<void> => {
  // Scope by userId so users can only delete their own — authorization in the query itself.
  const deleted = await db
    .delete(note)
    .where(and(eq(note.publicId, publicId), eq(note.userId, userId)))
    .returning({ id: note.id });
  if (deleted.length === 0) throw new NotFoundError("That note doesn't exist.");
};
