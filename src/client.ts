import { TokenManager } from "./auth";
import { SMEPayError } from "./errors";
import { postJSON } from "./http";

export type Environment = "test" | "live";

export interface SMEPayConfig {
  /** client_id from the SMEPay dashboard. */
  clientId: string;
  /** client_secret from the SMEPay dashboard. Keep it in an env variable, never in code. */
  clientSecret: string;
  /** "test" (default) or "live"; must match the business's mode on SMEPay. */
  environment?: Environment;
}

const BASE_URLS: Record<Environment, string> = {
  test: "https://staging.smepay.in",
  live: "https://extranet.smepay.in",
};

/** 401 codes meaning the token itself was rejected; a fresh login may fix these. */
const TOKEN_ERROR_CODES = new Set(["invalid_token", "invalid_external_token", "invalid_token_type"]);

interface ApiClientOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
}

/** Internal: authenticated POSTs with client_id added to the body. Not exported from the package. */
export class ApiClient {
  readonly #baseUrl: string;
  readonly #clientId: string;
  readonly #timeoutMs: number | undefined;
  readonly #auth: TokenManager;

  constructor(opts: ApiClientOptions) {
    this.#baseUrl = opts.baseUrl;
    this.#clientId = opts.clientId;
    this.#timeoutMs = opts.timeoutMs;
    this.#auth = new TokenManager(opts);
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const fullBody = { ...body, client_id: this.#clientId };
    const token = await this.#auth.getToken();
    try {
      return await this.#send<T>(path, fullBody, token);
    } catch (err) {
      if (!(err instanceof SMEPayError && err.statusCode === 401 && TOKEN_ERROR_CODES.has(err.code))) {
        throw err;
      }
      // Token rejected (e.g. server session lost): log in again once and repeat the call once.
      this.#auth.invalidate(token);
      const freshToken = await this.#auth.getToken();
      return this.#send<T>(path, fullBody, freshToken);
    }
  }

  #send<T>(path: string, body: Record<string, unknown>, token: string): Promise<T> {
    return postJSON<T>({ baseUrl: this.#baseUrl, path, body, token, timeoutMs: this.#timeoutMs });
  }
}

export class SMEPay {
  readonly environment: Environment;
  readonly #api: ApiClient;

  constructor(config: SMEPayConfig) {
    if (!config || typeof config !== "object") {
      throw invalidConfig("SMEPay config is required: new SMEPay({ clientId, clientSecret })");
    }
    const { clientId, clientSecret, environment = "test" } = config;
    if (typeof clientId !== "string" || clientId.trim() === "") {
      throw invalidConfig("clientId is required");
    }
    if (typeof clientSecret !== "string" || clientSecret.trim() === "") {
      throw invalidConfig("clientSecret is required");
    }
    if (environment !== "test" && environment !== "live") {
      throw invalidConfig(`environment must be "test" or "live", got ${JSON.stringify(environment)}`);
    }

    this.environment = environment;
    this.#api = new ApiClient({
      baseUrl: BASE_URLS[environment],
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
  }
}

function invalidConfig(message: string): SMEPayError {
  return new SMEPayError({ code: "invalid_config", message });
}
