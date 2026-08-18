import type { z } from "zod";
import { logger } from "@/lib/observability/logger";
import { AppError } from "./errors";

/**
 * Every server action is `defineAction(zodSchema, handler)`.
 *   - input is validated (bad input → { ok:false, error:"validation", fieldErrors })
 *   - AppError subclasses → { ok:false, error:<code>, message }
 *   - anything else → logged, returned as { ok:false, error:"internal" }
 * The handler does auth (`requireSessionAction()`) + calls the domain layer.
 * Actions never return raw DB rows by accident: return exactly what the UI needs.
 */
export type ActionSuccess<T> = { ok: true; data: T };
export type ActionFailure = {
  ok: false;
  error: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export const success = <T>(data: T): ActionSuccess<T> => ({ ok: true, data });
export const failure = (
  error: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionFailure =>
  fieldErrors ? { ok: false, error, message, fieldErrors } : { ok: false, error, message };

const zodFieldErrors = (err: z.ZodError): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    const list = out[key] ?? [];
    list.push(issue.message);
    out[key] = list;
  }
  return out;
};

export const defineAction =
  <TInput, TOutput>(
    schema: z.ZodType<TInput>,
    handler: (input: TInput) => Promise<TOutput>,
    opts: { name?: string } = {},
  ) =>
  async (rawInput: unknown): Promise<ActionResult<TOutput>> => {
    const name = opts.name ?? handler.name ?? "action";
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return failure(
        "validation",
        "Please correct the highlighted fields.",
        zodFieldErrors(parsed.error),
      );
    }
    const start = performance.now();
    try {
      const data = await handler(parsed.data);
      logger.debug({ action: name, ms: Math.round(performance.now() - start) }, "action.ok");
      return success(data);
    } catch (err) {
      if (err instanceof AppError) {
        logger.info({ action: name, code: err.code }, "action.rejected");
        return failure(err.code, err.message, err.fieldErrors);
      }
      // Next.js control-flow (redirect/notFound) throws — let it through.
      if (err instanceof Error && "digest" in err && typeof err.digest === "string") throw err;
      logger.error({ action: name, err }, "action.failed");
      return failure("internal", "Something went wrong. Please try again.");
    }
  };

/** Turn a FormData into a plain object for zod (multi-value keys become arrays). */
export const formDataToObject = (formData: FormData): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      out[key] = value;
    }
  }
  return out;
};
