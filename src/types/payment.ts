/**
 * Payment status values the External API returns.
 * TEST_* values appear for businesses in test mode.
 * `(string & {})` keeps autocomplete while still accepting any value the API may add later.
 */
export type PaymentStatus =
  | "CREATED"
  | "INITIATED"
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "SETTLED"
  | "REFUNDED"
  | "REFUND_PENDING"
  | "TEST_SUCCESS"
  | "TEST_FAILED"
  | "TEST_PENDING"
  | (string & {});

/** Customer details; at least one of email or mobile is required. */
export type CustomerDetails =
  | { email: string; mobile?: string; name?: string }
  | { mobile: string; email?: string; name?: string };

// ---- payment.create → POST /api/external/order/create ----

export interface CreatePaymentParams {
  /** Amount in rupees, as a string, e.g. "100.50". */
  amount: string;
  /** Your own order reference; must be unique for your business. Returned later as ref_id / external_reference_id. */
  order_id: string;
  /** URL that receives the payment result webhook. */
  callback_url: string;
  customer_details: CustomerDetails;
}

export interface CreatePaymentResponse {
  status: boolean;
  /** Pass this as `slug` to payment.initiate. */
  order_slug: string;
  /** SMEPay's order ID. */
  order_id: string;
  amount: number;
  payment_status: PaymentStatus;
  /** Hosted SMEPay payment page for this order. */
  payment_url: string;
  /** Your order_id, echoed back. */
  ref_id: string;
  customer_details: { name: string; email: string; mobile: string };
  message: string;
  callback_url?: string;
}

// ---- payment.initiate → POST /api/external/order/initiate ----

export interface InitiatePaymentParams {
  /** `order_slug` returned by payment.create. */
  slug: string;
}

export interface InitiatePaymentResponse {
  status: boolean;
  /** SMEPay's order ID. */
  order_id: string;
  /** Your order_id. */
  external_reference_id: string;
  /** UPI payment link. */
  payment_link: string;
  transaction_id: string;
  /** QR code image, base64-encoded. */
  qr_code: string;
  payment_status: PaymentStatus;
  /** Unix timestamp (seconds). */
  expires_at: number;
  /** UPI app key → app-specific payment link. */
  intents: Record<string, string>;
  message: string;
}

// ---- payment.getStatus → POST /api/external/order/status ----

/** Look up by SMEPay's `order_id` or your `external_reference_id` (used first if both are given). */
export type GetPaymentStatusParams = (
  | { order_id: string; external_reference_id?: string }
  | { external_reference_id: string; order_id?: string }
) & {
  /** Saved for the webhook only if the order has no callback_url yet. */
  callback_url?: string;
};

export interface GetPaymentStatusResponse {
  status: boolean;
  /** Your order_id. */
  external_reference_id: string;
  /** SMEPay's order ID. */
  order_id: string;
  payment_status: PaymentStatus;
  amount: number;
  /** Unix timestamp (seconds). */
  created_at: number;
  /** Unix timestamp (seconds); null until the payment is processed. */
  processed_at: number | null;
  /** Bank reference number, when available. */
  utr?: string;
}
