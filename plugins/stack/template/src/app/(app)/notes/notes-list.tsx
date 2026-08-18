"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NoteListItem } from "@/lib/domain/notes/queries";
import { deleteNoteAction } from "./actions";

export function NotesList({ notes }: { notes: NoteListItem[] }) {
  const [pending, startTransition] = useTransition();

  if (notes.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing yet — add your first note.</p>;
  }

  const remove = (publicId: string) =>
    startTransition(async () => {
      const result = await deleteNoteAction({ publicId });
      if (!result.ok) toast.error(result.message);
    });

  return (
    <ul className="grid gap-3">
      {notes.map((n) => (
        <li key={n.publicId}>
          <Card size="sm">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <CardTitle className="text-base">{n.title}</CardTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${n.title}`}
                disabled={pending}
                onClick={() => remove(n.publicId)}
              >
                <Trash2 />
              </Button>
            </CardHeader>
            {n.body ? (
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground text-sm">{n.body}</p>
              </CardContent>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
