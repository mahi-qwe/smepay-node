/** Body keys that must never appear in an error, even if an API reply echoes them. */
const SENSITIVE_KEYS = new Set(["access_token", "client_secret", "authorization"]);

export interface SMEPayErrorParams {
  code: string;
  message: string;
  statusCode?: number | null;
  raw?: unknown;
  cause?: unknown;
}

/**
 * Thrown for every failed SDK call.
 *
 * - API errors: `code` is the API's `error` field (e.g. "duplicate_order_id"),
 *   `statusCode` is the HTTP status, `raw` is the API's reply body.
 * - SDK-side errors: `code` is "network_error", "timeout" or "invalid_response";
 *   `statusCode` is null unless a reply was received.
 */
export class SMEPayError extends Error {
  readonly code: string;
  readonly statusCode: number | null;
  readonly raw: unknown;

  constructor({ code, message, statusCode = null, raw = null, cause }: SMEPayErrorParams) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SMEPayError";
    this.code = code;
    this.statusCode = statusCode;
    this.raw = redact(raw);
  }
}

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted]" : val;
  }
  return out;
}
