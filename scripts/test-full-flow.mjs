/**
 * Test full flow: order-created -> unique verification URL, then optional webhook trigger.
 * Requires BOOQABLE_BASE_URL, BOOQABLE_API_KEY, STRIPE_SECRET_KEY (from .env or shell).
 * Run from repo root: node scripts/test-full-flow.mjs
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
for (const envPath of [join(root, ".env"), join(root, "..", ".env")]) {
  if (!existsSync(envPath)) continue;
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (key && value !== undefined) process.env[key] = value;
      }
    }
  }
  break;
}

const required = ["BOOQABLE_BASE_URL", "BOOQABLE_API_KEY", "STRIPE_SECRET_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  console.error("Set them in .env (project or parent dir) or in the shell before running.");
  process.exit(1);
}

const CUSTOMER_ID = "4b8bb784-d0d7-4ce3-bd6c-12560ec4a153";
const ORDER_ID = `test-order-${Date.now()}`;

const mockRes = () => {
  const out = { statusCode: 200, body: null };
  out.status = (code) => {
    out.statusCode = code;
    return out;
  };
  out.json = (data) => {
    out.body = data;
    return out;
  };
  return out;
};

const req = {
  method: "POST",
  body: {
    order: {
      id: ORDER_ID,
      customer_id: CUSTOMER_ID,
      customer: { email: "test@example.com" },
    },
  },
};

console.log("1. Calling order-created handler (customer_id:", CUSTOMER_ID + ")...\n");

const { default: handler } = await import("../api/booqable-order-created.js");
const res = mockRes();
await handler(req, res);

if (res.statusCode !== 200) {
  console.error("Order-created failed:", res.statusCode, res.body);
  process.exit(1);
}

if (res.body?.skipped) {
  console.log("(Skipped - customer already Verified)\n", res.body);
  process.exit(0);
}

if (!res.body?.verificationUrl) {
  console.error("No verificationUrl in response:", res.body);
  process.exit(1);
}

console.log("Order-created OK:");
console.log("  customerId:", res.body.customerId);
console.log("  orderId:", res.body.orderId);
console.log("\n--- Verification link (use in order confirmation email; open to complete Stripe Identity) ---");
console.log(res.body.verificationUrl);
console.log("---");
console.log("\n2. To complete the flow and trigger the Stripe webhook:");
console.log("   - Forward webhooks: stripe listen --forward-to https://stripeidentity.vercel.app/api/stripe-webhook");
console.log("   - Open the verificationUrl in a browser and complete identity verification.");
console.log("   - Stripe will send identity.verification_session.verified; the webhook will set Booqable to 'Verified'.");
