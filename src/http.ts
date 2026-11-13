import { SMEPayError } from "./errors";
import { VERSION } from "./version";

/** Fixed request timeout; deliberately not configurable by merchants. */
const TIMEOUT_MS = 60_000;

/** Longest slice of a non-JSON reply kept in `SMEPayError.raw`. */
const RAW_TEXT_LIMIT = 500;

export interface RequestOptions {
  baseUrl: string;
  path: string;
  body: Record<string, unknown>;
  token?: string;
  /** Internal override for local verification only; never exposed in SMEPay config. */
  timeoutMs?: number;
}

/**
 * POSTs JSON to the SMEPay API and returns the parsed reply.
 * Throws SMEPayError for non-2xx replies, network failures, timeouts and non-JSON replies.
 */
export async function postJSON<T>({ baseUrl, path, body, token, timeoutMs = TIMEOUT_MS }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": `smepay-node/${VERSION}`,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let status: number;
  let text: string;
  try {
    const res = await fetch(baseUrl + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    status = res.status;
    text = await res.text();
  } catch (err) {
    if (controller.signal.aborted) {
      throw new SMEPayError({
        code: "timeout",
        message: `Request to ${path} timed out after ${timeoutMs / 1000}s`,
      });
    }
    throw new SMEPayError({
      code: "network_error",
      message: `Could not reach SMEPay (${path}): ${describeNetworkError(err)}`,
      cause: err,
    });
  } finally {
    clearTimeout(timer);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SMEPayError({
      code: "invalid_response",
      message: `SMEPay returned a non-JSON reply (HTTP ${status}) for ${path}`,
      statusCode: status,
      raw: text.slice(0, RAW_TEXT_LIMIT),
    });
  }

  if (status < 200 || status >= 300) {
    throw apiError(status, data);
  }
  return data as T;
}

/** Builds an SMEPayError from an API error reply: { error, message } or { error, errors }. */
function apiError(status: number, data: unknown): SMEPayError {
  const body = data !== null && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const code = typeof body.error === "string" && body.error !== "" ? body.error : "api_error";

  let message = `SMEPay API error (HTTP ${status})`;
  if (typeof body.message === "string" && body.message !== "") {
    message = body.message;
  } else if (typeof body.errors === "string" && body.errors !== "") {
    message = body.errors;
  } else if (body.errors !== undefined && body.errors !== null) {
    message = JSON.stringify(body.errors);
  }

  return new SMEPayError({ code, message, statusCode: status, raw: data });
}

/** fetch() reports every network failure as "fetch failed"; the real reason (e.g. ECONNREFUSED) is in cause. */
function describeNetworkError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  const cause = err.cause as { code?: unknown; message?: unknown } | undefined;
  if (cause && typeof cause.code === "string") {
    return `${err.message} (${cause.code})`;
  }
  if (cause && typeof cause.message === "string") {
    return `${err.message} (${cause.message})`;
  }
  return err.message;
}
