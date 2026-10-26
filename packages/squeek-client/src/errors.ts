/** Thrown when an HTTP response is an API error, or the client rejects a call before sending it (status 0). */
export class SqueekApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;
  readonly path: string;

  constructor(details: {
    status: number;
    code: string;
    message?: string;
    requestId?: string | null;
    retryAfterSeconds?: number | null;
    path: string;
  }) {
    super(details.message ?? `${details.path}: ${details.code} (HTTP ${details.status})`);
    this.name = "SqueekApiError";
    this.status = details.status;
    this.code = details.code;
    this.requestId = details.requestId ?? null;
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
    this.path = details.path;
  }
}

/** Thrown when a body is not JSON, or a 304 arrives with nothing cached. */
export class SqueekResponseError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(path: string, status: number, message: string) {
    super(message);
    this.name = "SqueekResponseError";
    this.status = status;
    this.path = path;
  }
}

/** Thrown when a decimal string is not a safe unsigned integer, or a formula input is invalid. */
export class SqueekNumericError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqueekNumericError";
  }
}
