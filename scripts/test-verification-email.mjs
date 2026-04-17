/**
 * Test: simulate Booqable order (random customer id + given email), create Stripe
 * verification session, send Resend verification email.
 *
 * Run: node scripts/test-verification-email.mjs
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { sendVerificationEmail } from "../lib/sendVerificationEmail.js";

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

if (!process.env.RESEND_FROM) {
  process.env.RESEND_FROM = "Toolio Rentals <onboarding@resend.dev>";
}
const required = ["STRIPE_SECRET_KEY", "RESEND_API_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

const CUSTOMER_EMAIL = "zackquinn6@gmail.com";

async function main() {
  const customerId = randomUUID();
  const orderId = `test-order-${Date.now()}`;

  console.log("1. Simulated Booqable order:");
  console.log("   customer_id:", customerId);
  console.log("   order_id:", orderId);
  console.log("   customer email:", CUSTOMER_EMAIL);

  console.log("\n2. Creating Stripe Identity verification session...");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const flowId = process.env.STRIPE_IDENTITY_FLOW_ID;
  const session = await stripe.identity.verificationSessions.create(
    flowId
      ? {
          verification_flow: flowId,
          metadata: { customer_id: customerId, order_id: orderId },
        }
      : {
          type: "document",
          metadata: { customer_id: customerId, order_id: orderId },
          options: {
            document: { require_id_number: true, require_live_capture: true },
          },
        }
  );

  const verificationUrl = session.url;
  if (!verificationUrl) {
    throw new Error("Stripe session has no url");
  }
  console.log("   Verification URL:", verificationUrl.slice(0, 60) + "...");

  console.log("\n3. Sending verification email via Resend...");
  const result = await sendVerificationEmail({
    to: CUSTOMER_EMAIL,
    verificationUrl,
  });

  if (result.error) {
    console.error("   Resend error:", result.error);
    process.exit(1);
  }
  console.log("   Sent. Message ID:", result.data?.id ?? result);
  console.log("\nDone. Check", CUSTOMER_EMAIL, "for the verification email.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
