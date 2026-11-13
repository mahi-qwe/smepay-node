/**
 * Full flow: create → initiate → getStatus.
 *
 * Put credentials in a .env file (never commit it):
 *   SMEPAY_CLIENT_ID=...
 *   SMEPAY_CLIENT_SECRET=...
 *   SMEPAY_ENVIRONMENT=test          # optional, "test" (default) or "live"
 *   SMEPAY_CALLBACK_URL=https://...  # optional, where the result webhook is sent
 *   SMEPAY_CUSTOMER_MOBILE=98xxxxxxxx # optional
 *
 * Run (from the repo root, after `npm install && npm run build`):
 *   node --env-file=.env examples/full-flow.ts    # Node 22.18+
 *   npx tsx --env-file=.env examples/full-flow.ts # older Node
 */
import { SMEPay, SMEPayError } from "smepay-node";
import type { Environment } from "smepay-node";

async function main(): Promise<void> {
  const smepay = new SMEPay({
    clientId: process.env.SMEPAY_CLIENT_ID ?? "",
    clientSecret: process.env.SMEPAY_CLIENT_SECRET ?? "",
    environment: (process.env.SMEPAY_ENVIRONMENT as Environment | undefined) ?? "test",
  });
  console.log(`Environment: ${smepay.environment}`);

  // 1. Create the order. order_id is your own reference and must be unique.
  const order = await smepay.payment.create({
    amount: "1.00",
    order_id: `DEMO-${Date.now()}`,
    callback_url: process.env.SMEPAY_CALLBACK_URL ?? "https://example.com/smepay/callback",
    customer_details: {
      name: "Demo Customer",
      mobile: process.env.SMEPAY_CUSTOMER_MOBILE ?? "9999999999",
    },
  });
  console.log("\n1. create");
  console.log(`   order_id (SMEPay): ${order.order_id}`);
  console.log(`   ref_id (yours):    ${order.ref_id}`);
  console.log(`   order_slug:        ${order.order_slug}`);
  console.log(`   payment_status:    ${order.payment_status}`);
  console.log(`   payment_url:       ${order.payment_url}`);

  // 2. Start the payment: get the UPI link, QR code and app intents to show the customer.
  const payment = await smepay.payment.initiate({ slug: order.order_slug });
  console.log("\n2. initiate");
  console.log(`   payment_status:    ${payment.payment_status}`);
  console.log(`   payment_link:      ${payment.payment_link}`);
  console.log(`   qr_code:           base64, ${payment.qr_code.length} chars`);
  console.log(`   intents:           ${Object.keys(payment.intents).join(", ") || "(none)"}`);
  console.log(`   expires_at:        ${new Date(payment.expires_at * 1000).toISOString()}`);

  // 3. Check the status, by your reference (or by SMEPay's order_id).
  const status = await smepay.payment.getStatus({ external_reference_id: order.ref_id });
  console.log("\n3. getStatus");
  console.log(`   payment_status:    ${status.payment_status}`);
  console.log(`   amount:            ${status.amount}`);
  console.log(`   processed_at:      ${status.processed_at ?? "(not yet)"}`);
  console.log(`   utr:               ${status.utr ?? "(none yet)"}`);
}

main().catch((err: unknown) => {
  if (err instanceof SMEPayError) {
    console.error(`\nSMEPayError [${err.code}] (HTTP ${err.statusCode ?? "-"}): ${err.message}`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
