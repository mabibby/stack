/**
 * Typed errors thrown from the domain layer. `defineAction` maps them to
 * { ok:false, error:<code>, message } so UI can show friendly text and
 * unexpected errors are logged (never leaked) as "internal".
 */
export class AppError extends Error {
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super("validation", message, fieldErrors);
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super("unauthenticated", message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super("forbidden", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super("not_found", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super("conflict", message, fieldErrors);
    this.name = "ConflictError";
  }
}
