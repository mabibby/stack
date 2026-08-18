"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionAction } from "@/lib/auth/session";
import { createNote, deleteNote, MAX_BODY, MAX_TITLE } from "@/lib/domain/notes/mutations";
import { defineAction } from "@/lib/server/action";

/**
 * Server actions = thin glue: validate (schema) → auth → domain call → revalidate.
 * No business logic here; that lives in src/lib/domain/notes.
 */
export const createNoteAction = defineAction(
  z.object({
    title: z.string().trim().min(1, "Title is required").max(MAX_TITLE),
    body: z.string().max(MAX_BODY).default(""),
  }),
  async (input) => {
    const { user } = await requireSessionAction();
    const created = await createNote(user.id, input);
    revalidatePath("/notes");
    return created;
  },
  { name: "createNote" },
);

export const deleteNoteAction = defineAction(
  z.object({ publicId: z.string().min(1) }),
  async ({ publicId }) => {
    const { user } = await requireSessionAction();
    await deleteNote(user.id, publicId);
    revalidatePath("/notes");
    return null;
  },
  { name: "deleteNote" },
);
