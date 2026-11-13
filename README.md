# smepay-node

Official Node.js SDK for the SMEPay External API: accept UPI payments with three calls.
The SDK handles login, token reuse and errors for you.

- Node.js 18 or newer
- Zero dependencies
- Works with `import` and `require`, with TypeScript types included

## Install

```bash
npm install smepay-node
```

## Quick start

```ts
import { SMEPay } from "smepay-node";
// or: const { SMEPay } = require("smepay-node");

const smepay = new SMEPay({
  clientId: process.env.SMEPAY_CLIENT_ID,
  clientSecret: process.env.SMEPAY_CLIENT_SECRET,
  environment: "test", // "test" (default) or "live"
});

// 1. Create an order
const order = await smepay.payment.create({
  amount: "100.50",
  order_id: "ORD-1001", // your own reference, unique per order
  callback_url: "https://yoursite.com/smepay/callback",
  customer_details: { name: "Asha", mobile: "9876543210", email: "asha@example.com" },
});

// 2. Start the payment and show the QR / UPI apps to the customer
const payment = await smepay.payment.initiate({ slug: order.order_slug });

// 3. Check the status
const status = await smepay.payment.getStatus({ external_reference_id: "ORD-1001" });
console.log(status.payment_status); // e.g. "SUCCESS"
```

## Configuration

| Option | Required | Description |
|---|---|---|
| `clientId` | Yes | `client_id` from the SMEPay dashboard. |
| `clientSecret` | Yes | `client_secret` from the SMEPay dashboard. Keep it in an environment variable, never in code. |
| `environment` | No | `"test"` (default) or `"live"`. Must match your business's mode on SMEPay. |

You never call login yourself. The SDK logs in on the first call, reuses the token, and logs in again
when it is about to expire. Each request waits at most 60 seconds.

## Methods

Field names are exactly the API's (snake_case). Responses are returned as the API sends them.

### `payment.create(params)`

Creates a payment order.

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | string | Yes | Amount in rupees, e.g. `"100.50"`. |
| `order_id` | string | Yes | Your own order reference. Must be unique for your business. |
| `callback_url` | string | Yes | URL that receives the payment result (see [Webhooks](#webhooks)). |
| `customer_details` | object | Yes | `{ name?, email?, mobile? }`; at least `email` or `mobile`. |

Returns: `order_slug` (pass to `initiate`), `order_id` (SMEPay's ID), `ref_id` (your `order_id`),
`amount`, `payment_status` (`"CREATED"`), `payment_url`, `customer_details`, `message`, `callback_url`.

### `payment.initiate(params)`

Starts the payment for an order and returns what to show the customer.

| Param | Type | Required | Description |
|---|---|---|---|
| `slug` | string | Yes | `order_slug` from `create`. |

Returns: `payment_link` (UPI link), `qr_code` (base64 image), `intents` (UPI app key → app link),
`payment_status` (`"INITIATED"`), `expires_at` (Unix seconds), `order_id`, `external_reference_id`,
`transaction_id`, `message`.

Show the QR: `<img src="data:image/png;base64,${payment.qr_code}">`.
You can call `initiate` again for the same order if the payment failed or expired.

You can also skip `initiate` and send the customer to `payment_url`, the hosted SMEPay page.
Use one or the other for an order, not both.

### `payment.getStatus(params)`

| Param | Type | Required | Description |
|---|---|---|---|
| `external_reference_id` | string | One of these two | Your `order_id`. Used first if both are given. |
| `order_id` | string | One of these two | SMEPay's `order_id` from `create`. |
| `callback_url` | string | No | Saved only if the order has no callback URL yet. |

Returns: `payment_status`, `amount`, `created_at`, `processed_at` (`null` until processed), `utr`
(bank reference, when available), `order_id`, `external_reference_id`.

### Payment status values

| Status | Meaning |
|---|---|
| `CREATED` | Order created, payment not started. |
| `INITIATED` / `PENDING` | Payment started, waiting for the customer or the bank. |
| `SUCCESS` | Paid. |
| `FAILED` | Payment failed. |
| `EXPIRED` | Not paid in time. |
| `SETTLED` | Paid and settled. |
| `REFUNDED` / `REFUND_PENDING` | Refunded / refund in progress. |
| `TEST_SUCCESS` / `TEST_FAILED` / `TEST_PENDING` | Same as above, for businesses in test mode. |

## Errors

Every failure throws an `SMEPayError`:

```ts
import { SMEPayError } from "smepay-node";

try {
  await smepay.payment.create({ ... });
} catch (err) {
  if (err instanceof SMEPayError) {
    console.log(err.code);       // e.g. "duplicate_order_id"
    console.log(err.message);    // human-readable reason
    console.log(err.statusCode); // HTTP status, or null if no reply was received
    console.log(err.raw);        // full API reply body
  }
}
```

Common codes:

| Code | When |
|---|---|
| `invalid_config` | Missing `clientId` / `clientSecret`, or unknown `environment` (thrown by `new SMEPay`). |
| `invalid_client_id`, `invalid_client`, `invalid_credentials` | Wrong `clientId` or `clientSecret`. |
| `environment_mismatch`, `invalid_endpoint` | `environment` doesn't match your business's mode. |
| `ip_not_whitelisted` | Live only: your server's IP isn't whitelisted on SMEPay. |
| `insufficient_wallet_balance`, `wallet_validation_failed` | Live only: wallet balance too low for the fee. |
| `api_not_enabled` | External API isn't enabled for your business. |
| `invalid_request`, `validation_error` | A required field is missing or invalid. |
| `amount_below_minimum`, `amount_exceeds_maximum` | Amount outside your business's allowed range. |
| `duplicate_order_id` | You already used this `order_id`. |
| `transaction_not_found` | No order with that slug / ID for your business. |
| `payment_already_processed` | `initiate` called on an order that is already paid or in progress. |
| `payment_initiation_failed`, `transaction_creation_failed` | SMEPay couldn't complete the request; try again later. |
| `network_error` | Couldn't reach SMEPay. |
| `timeout` | No reply within 60 seconds. |
| `invalid_response` | SMEPay sent a reply the SDK couldn't read. |
| `api_error` | Any other error without a code. |

The SDK never retries a failed call by itself, so a failed `create` is never sent twice.

## Test vs live

| | `test` | `live` |
|---|---|---|
| Server | `staging.smepay.in` | `extranet.smepay.in` |
| Fees | None | Charged from your SMEPay wallet |
| IP whitelist | Not checked | Your server's IP must be whitelisted on SMEPay |
| Wallet | Not checked | At least ₹10 needed, or every call fails at login |

Use the `clientId` / `clientSecret` that belong to the matching mode.

## Webhooks

When a payment finishes, SMEPay sends a POST to your `callback_url` with
`ref_id`, `transaction_id`, `status`, `amount`, `created_at`, `processed_at` and `utr`.

Before you mark an order as paid, confirm the status with `payment.getStatus`.

## Example

[`examples/full-flow.ts`](examples/full-flow.ts) runs create → initiate → getStatus:

```bash
npm install && npm run build
# create .env with SMEPAY_CLIENT_ID and SMEPAY_CLIENT_SECRET (never commit it)
node --env-file=.env examples/full-flow.ts
```

## Security

- Keep `clientSecret` in an environment variable or secret manager; never commit it or send it to a browser.
- Use this SDK only on your server, never in frontend code.
- The SDK never logs your secret or token, and removes them from `SMEPayError.raw`.

## License

MIT
