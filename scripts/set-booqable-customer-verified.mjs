/**
 * Simulate “identity verified” in Booqable (same PATCH as stripe-webhook after Stripe verifies).
 * Does not touch Stripe; only updates customer custom property identity_verified → Verified.
 *
 * Requires BOOQABLE_BASE_URL, BOOQABLE_API_KEY (from .env or shell).
 * Set BOOQABLE_CUSTOMER_ID or pass UUID as first argument.
 *
 * Run: node scripts/set-booqable-customer-verified.mjs
 * Run: node scripts/set-booqable-customer-verified.mjs 252a2fbc-b2e5-40c2-a9d0-5a5e366ce78d
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { assertToolioBooqableBaseUrl } from "../lib/toolioBooqableOrigin.js";

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

const apiKey = process.env.BOOQABLE_API_KEY;
const customerId =
  process.argv[2] || process.env.BOOQABLE_CUSTOMER_ID;

const required = ["BOOQABLE_BASE_URL", "BOOQABLE_API_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

const urlCheck = assertToolioBooqableBaseUrl(process.env.BOOQABLE_BASE_URL);
if (!urlCheck.ok) {
  console.error(urlCheck.error);
  process.exit(1);
}
const baseUrl = urlCheck.normalized;

if (!customerId) {
  console.error(
    "Set BOOQABLE_CUSTOMER_ID or pass customer UUID as first argument."
  );
  process.exit(1);
}

const url = `${baseUrl}/api/4/customers/${customerId}`;
console.log("PATCH", url);
console.log("  identity_verified → Verified\n");

const res = await fetch(url, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    data: {
      type: "customers",
      id: customerId,
      attributes: {
        properties_attributes: [
          { identifier: "identity_verified", value: "Verified" },
        ],
      },
    },
  }),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error("Booqable PATCH failed:", res.status, body);
  process.exit(1);
}

console.log("OK", res.status);
console.log(JSON.stringify(body, null, 2).slice(0, 1200));
