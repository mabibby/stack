import { createId } from "@paralleldrive/cuid2";
import { bigint, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Column helpers so every table looks the same.
 *
 *  id        — internal bigint identity PK. Fast joins; NEVER exposed in URLs.
 *  publicId  — cuid2 string exposed in URLs / APIs (unguessable, no enumeration).
 *  timestamps — created_at / updated_at with timezone.
 *
 * Usage:
 *   export const thing = pgTable("thing", { id: id(), publicId: publicId(), ..., ...timestamps() });
 */
export const id = () => bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity();

export const publicId = () =>
  text()
    .notNull()
    .unique()
    .$defaultFn(() => createId());

export const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
