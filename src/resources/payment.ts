import type { ApiClient } from "../client";
import type {
  CreatePaymentParams,
  CreatePaymentResponse,
  GetPaymentStatusParams,
  GetPaymentStatusResponse,
  InitiatePaymentParams,
  InitiatePaymentResponse,
} from "../types/payment";

export class PaymentResource {
  readonly #api: ApiClient;

  constructor(api: ApiClient) {
    this.#api = api;
  }

  /** Creates a payment order. Next step: payment.initiate({ slug: order_slug }). */
  create(params: CreatePaymentParams): Promise<CreatePaymentResponse> {
    return this.#api.post("/api/external/order/create", { ...params });
  }

  /** Starts the payment for an order; returns the UPI link, QR code and app intents. */
  initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResponse> {
    return this.#api.post("/api/external/order/initiate", { ...params });
  }

  /** Fetches the current payment status of an order. */
  getStatus(params: GetPaymentStatusParams): Promise<GetPaymentStatusResponse> {
    return this.#api.post("/api/external/order/status", { ...params });
  }
}
