/**
 * POST the same JSON body a Make/Zapier HTTP step should send to Vercel (Booqable has
 * predefined integrations only—you configure the automation, not a raw URL in Booqable).
 *
 * Flow: POST → Vercel → Stripe Identity session → Booqable PATCH → Resend (if configured).
 *
 * Set BOOQABLE_CUSTOMER_ID to a real Booqable customer UUID. Optionally: WEBHOOK_URL, CUSTOMER_EMAIL.
 *
 * Run: node scripts/trigger-booqable-webhook.mjs
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

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://stripeidentity.vercel.app/api/booqable-order-created";
const BOOQABLE_CUSTOMER_ID = process.env.BOOQABLE_CUSTOMER_ID;
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || "zackquinn6@gmail.com";
const ORDER_ID = process.env.ORDER_ID || `test-order-${Date.now()}`;

if (!BOOQABLE_CUSTOMER_ID) {
  console.error("Set BOOQABLE_CUSTOMER_ID to a real Booqable customer ID (e.g. for Zachary Quinn).");
  console.error("Get it from Booqable dashboard or API.");
  process.exit(1);
}

const body = {
  order: {
    id: ORDER_ID,
    customer_id: BOOQABLE_CUSTOMER_ID,
    customer: { email: CUSTOMER_EMAIL }
  }
};

console.log("Simulated Booqable order-created webhook");
console.log("  URL:", WEBHOOK_URL);
console.log("  customer_id:", BOOQABLE_CUSTOMER_ID);
console.log("  order_id:", ORDER_ID);
console.log("  email:", CUSTOMER_EMAIL);
console.log("");

const res = await fetch(WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("Webhook failed:", res.status, data);
  process.exit(1);
}

console.log("Response:", res.status, data);
if (data.emailSent) {
  console.log("\nEmail sent to", CUSTOMER_EMAIL, "- check inbox for Stripe Identity verification link.");
} else if (data.emailError) {
  console.log("\nVerification session created but email failed:", data.emailError);
} else if (data.skipped) {
  console.log("\nSkipped:", data.reason);
} else if (data.resendConfigured === false) {
  console.log("\nEmail not sent: deployment missing RESEND_API_KEY or RESEND_FROM (see Vercel env).");
}
