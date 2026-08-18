"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNoteAction } from "./actions";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  body: z.string().max(5000),
});
type Values = z.infer<typeof schema>;

/**
 * Client form pattern: react-hook-form + zod for instant validation, then call
 * the server action. Server-side fieldErrors are mapped back onto the form so
 * both layers agree and the user always sees why something failed.
 */
export function NoteForm() {
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createNoteAction(values);
      if (!result.ok) {
        for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(name as keyof Values, { message: messages[0] });
        }
        toast.error(result.message);
        return;
      }
      form.reset();
      toast.success("Note saved");
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" aria-invalid={fieldState.invalid} {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="body"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="body">Body</FieldLabel>
              <Textarea id="body" rows={5} aria-invalid={fieldState.invalid} {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <SubmitButton pending={pending}>Save note</SubmitButton>
      </FieldGroup>
    </form>
  );
}
