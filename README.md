# smepay-node

Official Node.js SDK for the SMEPay External API. Accept UPI payments in three calls; login, tokens and errors are handled for you.

Node.js 18+ · zero dependencies · `import` and `require` · TypeScript types included.

```bash
npm install smepay-node
```

## Usage

```ts
import { SMEPay } from "smepay-node"; // or: const { SMEPay } = require("smepay-node");

const smepay = new SMEPay({
  clientId: process.env.SMEPAY_CLIENT_ID,         // from the SMEPay dashboard
  clientSecret: process.env.SMEPAY_CLIENT_SECRET,
  environment: "test",                            // "test" (default) or "live"
});

// 1. Create an order
const order = await smepay.payment.create({
  amount: "100.50",                               // string, in rupees
  order_id: "ORD-1001",                           // your reference, unique per order
  callback_url: "https://yoursite.com/smepay/callback",
  customer_details: { name: "Asha", mobile: "9876543210" }, // email or mobile required
});

// 2. Start the payment: show payment.qr_code (base64 PNG) or payment.intents (UPI app links)
const payment = await smepay.payment.initiate({ slug: order.order_slug });

// 3. Check the status (or use { order_id: order.order_id })
const status = await smepay.payment.getStatus({ external_reference_id: "ORD-1001" });
console.log(status.payment_status, status.utr); // "SUCCESS", "123456789012"
```

Field names match the API exactly, and responses are returned as the API sends them.

| Method | Returns |
|---|---|
| `payment.create` | `order_slug`, `order_id` (SMEPay's), `ref_id` (yours), `payment_url`, `payment_status` |
| `payment.initiate` | `payment_link`, `qr_code`, `intents`, `expires_at`, `payment_status` |
| `payment.getStatus` | `payment_status`, `amount`, `created_at`, `processed_at`, `utr` |

`initiate` can be called again if a payment failed or expired. Alternatively, skip `initiate` and redirect the customer to `payment_url` (the hosted page); use one or the other per order.

**Statuses:** `CREATED` → `INITIATED` / `PENDING` → `SUCCESS` or `FAILED` / `EXPIRED`; also `SETTLED`, `REFUNDED`, `REFUND_PENDING`. Test-mode businesses get `TEST_SUCCESS`, `TEST_FAILED`, `TEST_PENDING`.

## Errors

Every failure throws an `SMEPayError` with `code`, `message`, `statusCode` (null if no reply) and `raw` (API reply).

```ts
import { SMEPayError } from "smepay-node";

try {
  await smepay.payment.create({ ... });
} catch (err) {
  if (err instanceof SMEPayError && err.code === "duplicate_order_id") { /* ... */ }
}
```

| Code | Meaning |
|---|---|
| `invalid_config` | Missing `clientId` / `clientSecret`, or bad `environment` |
| `invalid_client_id`, `invalid_credentials` | Wrong credentials |
| `environment_mismatch` | `environment` doesn't match your business's mode |
| `ip_not_whitelisted` | Live: your server IP isn't whitelisted |
| `insufficient_wallet_balance`, `wallet_validation_failed` | Live: wallet balance too low |
| `invalid_request`, `validation_error` | Missing or invalid field |
| `amount_below_minimum`, `amount_exceeds_maximum` | Amount outside your allowed range |
| `duplicate_order_id` | `order_id` already used |
| `transaction_not_found` | No such order for your business |
| `payment_already_processed` | `initiate` on an order already paid / in progress |
| `network_error`, `timeout`, `invalid_response` | Couldn't reach SMEPay / no reply in 60s / unreadable reply |

Calls are never retried automatically, so a failed `create` is never sent twice.

## Test vs live

| | `test` | `live` |
|---|---|---|
| Server | `staging.smepay.in` | `extranet.smepay.in` |
| Money / fees | None | Real; fees from your SMEPay wallet |
| Requirements | — | Server IP whitelisted, wallet ≥ ₹10 |

## Webhooks

When a payment finishes, SMEPay POSTs `ref_id`, `transaction_id`, `status`, `amount`, `created_at`, `processed_at` and `utr` to your `callback_url`. Confirm with `payment.getStatus` before marking an order paid.

## Security

Use the SDK only on your server. Keep `clientSecret` in an environment variable, never in code or the browser. The SDK never logs your secret or token.

## Example

[`examples/full-flow.ts`](examples/full-flow.ts): put `SMEPAY_CLIENT_ID` / `SMEPAY_CLIENT_SECRET` in `.env`, then `npm install && npm run build && node --env-file=.env examples/full-flow.ts`.

## License

MIT
