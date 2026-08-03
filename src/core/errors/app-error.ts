/**
 * Typed application errors for HEXVault.
 */

export type ErrorCode =
  | "CONFIG_INVALID"
  | "MEMORY_NOT_FOUND"
  | "MEMORY_STORE"
  | "LLM_PROVIDER"
  | "LLM_TIMEOUT"
  | "PROVIDER_AUTH"
  | "REVIEW_FAILED"
  | "INGEST_FAILED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts?: { statusCode?: number; details?: Record<string, unknown>; cause?: unknown }
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = opts?.statusCode ?? 500;
    this.details = opts?.details;
    if (opts?.cause) {
      (this as any).cause = opts.cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
