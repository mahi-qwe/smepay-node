import { SMEPayError } from "./errors";
import { postJSON } from "./http";

const AUTH_PATH = "/api/external/auth";

/** Fetch a new token when less than this much of its lifetime is left. */
const REFRESH_MARGIN_MS = 60_000;

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  environment: string;
}

export interface TokenManagerOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
}

/**
 * Logs in with client_id/client_secret and caches the access token.
 * Concurrent callers share a single in-flight login.
 */
export class TokenManager {
  readonly #opts: TokenManagerOptions;
  #token: string | null = null;
  #expiresAt = 0;
  #pending: Promise<string> | null = null;

  constructor(opts: TokenManagerOptions) {
    this.#opts = opts;
  }

  /** Returns a cached token, or logs in if there is none or it is about to expire. */
  async getToken(): Promise<string> {
    if (this.#token && Date.now() < this.#expiresAt - REFRESH_MARGIN_MS) {
      return this.#token;
    }
    if (!this.#pending) {
      this.#pending = this.#login().finally(() => {
        this.#pending = null;
      });
    }
    return this.#pending;
  }

  /** Drops the cached token if it is the one the server just rejected. */
  invalidate(token: string): void {
    if (this.#token === token) {
      this.#token = null;
      this.#expiresAt = 0;
    }
  }

  async #login(): Promise<string> {
    const { baseUrl, clientId, clientSecret, timeoutMs } = this.#opts;
    // Measured before the call so network time counts against the token's lifetime.
    const startedAt = Date.now();
    const res = await postJSON<AuthResponse>({
      baseUrl,
      path: AUTH_PATH,
      body: { client_id: clientId, client_secret: clientSecret },
      timeoutMs,
    });

    if (typeof res?.access_token !== "string" || res.access_token === "" || typeof res.expires_in !== "number") {
      throw new SMEPayError({
        code: "invalid_response",
        message: "SMEPay auth reply did not contain an access token",
        statusCode: 200,
        raw: res,
      });
    }

    this.#token = res.access_token;
    this.#expiresAt = startedAt + res.expires_in * 1000;
    return this.#token;
  }
}
