/**
 * Stable, machine-readable error codes thrown by turbomem.
 */
export type TurboMemErrorCode =
  | "NOT_INITIALISED"
  | "EMBEDDING_FAILED"
  | "STORAGE_FAILED"
  | "EXTRACTION_FAILED"
  | "DIMENSION_MISMATCH"
  | "INVALID_CONFIG"
  | "INVALID_INPUT";

/**
 * Base error class for all turbomem errors. Carries a stable {@link code} so
 * callers can branch on error type without matching on message strings.
 */
export class TurboMemError extends Error {
  readonly code: TurboMemErrorCode;
  override readonly cause?: unknown;

  constructor(code: TurboMemErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "TurboMemError";
    this.code = code;
    this.cause = options?.cause;
    Object.setPrototypeOf(this, TurboMemError.prototype);
  }
}

export class NotInitialisedError extends TurboMemError {
  constructor(message = "TurboMemory not initialised. Call await memory.init() first.") {
    super("NOT_INITIALISED", message);
    this.name = "NotInitialisedError";
    Object.setPrototypeOf(this, NotInitialisedError.prototype);
  }
}

export class EmbeddingError extends TurboMemError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("EMBEDDING_FAILED", message, options);
    this.name = "EmbeddingError";
    Object.setPrototypeOf(this, EmbeddingError.prototype);
  }
}

export class StorageError extends TurboMemError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("STORAGE_FAILED", message, options);
    this.name = "StorageError";
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class ExtractionError extends TurboMemError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("EXTRACTION_FAILED", message, options);
    this.name = "ExtractionError";
    Object.setPrototypeOf(this, ExtractionError.prototype);
  }
}

export class DimensionMismatchError extends TurboMemError {
  constructor(message: string) {
    super("DIMENSION_MISMATCH", message);
    this.name = "DimensionMismatchError";
    Object.setPrototypeOf(this, DimensionMismatchError.prototype);
  }
}

export class ConfigError extends TurboMemError {
  constructor(message: string) {
    super("INVALID_CONFIG", message);
    this.name = "ConfigError";
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}
