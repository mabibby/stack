import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { listNotesForUser } from "@/lib/domain/notes/queries";
import { NoteForm } from "./note-form";
import { NotesList } from "./notes-list";

export const metadata: Metadata = { title: "Notes" };

/** Server component: fetch directly from the domain layer, pass plain data down. */
export default async function NotesPage() {
  const { user } = await requireSession();
  const notes = await listNotesForUser(user.id);

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">New note</h1>
        <NoteForm />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold">Your notes ({notes.length})</h2>
        <NotesList notes={notes} />
      </section>
    </div>
  );
}
