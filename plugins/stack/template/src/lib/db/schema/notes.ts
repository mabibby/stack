import { index, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, publicId, timestamps } from "./shared";

/**
 * Example feature table. Copy this shape for new tables:
 * helpers from ./shared, snake_case handled by drizzle `casing`, FK to user with cascade.
 * Delete this file (and src/lib/domain/notes, the /notes route) once you have real features.
 */
export const note = pgTable(
  "note",
  {
    id: id(),
    publicId: publicId(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull(),
    body: text().notNull().default(""),
    ...timestamps(),
  },
  (t) => [index("note_user_id_idx").on(t.userId)],
);

export type Note = typeof note.$inferSelect;
export type NewNote = typeof note.$inferInsert;
