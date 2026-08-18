import { describe, expect, mock, test } from "bun:test";
import type { Db } from "@/lib/db/client";
import { createNote } from "@/lib/domain/notes/mutations";
import { ValidationError } from "@/lib/server/errors";

/**
 * Unit tests target the domain layer with a fake `db` — fast, no containers.
 * Anything touching the real DB belongs in tests/e2e (Playwright).
 */
const fakeDb = (returning: unknown[]) =>
  ({
    insert: () => ({ values: () => ({ returning: mock(async () => returning) }) }),
  }) as unknown as Db;

describe("createNote", () => {
  test("rejects an empty title", async () => {
    await expect(createNote("u1", { title: "   " }, fakeDb([]))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  test("trims and inserts", async () => {
    const result = await createNote(
      "u1",
      { title: "  Hello ", body: " world " },
      fakeDb([{ publicId: "abc" }]),
    );
    expect(result).toEqual({ publicId: "abc" });
  });
});
