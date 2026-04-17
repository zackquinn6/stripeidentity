/**
 * Subscribe Booqable to POST webhook events to your Vercel URL (native push — no Zapier).
 *
 * Uses Booqable API v4 resource webhook_endpoints as documented at:
 * https://developers.booqable.com/#webhook-endpoints-subscribe-to-webhook-events
 *
 * Requires: BOOQABLE_BASE_URL, BOOQABLE_API_KEY, BOOQABLE_WEBHOOK_TARGET_URL
 *   (full HTTPS URL to /api/booqable-order-created, publicly reachable).
 *
 * Events: lib/booqableOrderWebhook.js `BOOQABLE_WEBHOOK_SUBSCRIBE_ORDER_EVENTS`
 * (includes `order.updated` so admin reserve flows reach Vercel; handler requires `reserved`).
 * Your handler also accepts wrapped { order: { id, customer_id } } from tools that reshape payloads.
 *
 * Run: node scripts/register-booqable-webhook-endpoint.mjs
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { BOOQABLE_WEBHOOK_SUBSCRIBE_ORDER_EVENTS } from "../lib/booqableOrderWebhook.js";

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

const baseUrl = process.env.BOOQABLE_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.BOOQABLE_API_KEY;
const targetUrl = process.env.BOOQABLE_WEBHOOK_TARGET_URL?.trim();

const missing = ["BOOQABLE_BASE_URL", "BOOQABLE_API_KEY"].filter(
  (k) => !process.env[k]
);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}
if (!targetUrl) {
  console.error(
    "Set BOOQABLE_WEBHOOK_TARGET_URL to your public POST URL, e.g. https://<project>.vercel.app/api/booqable-order-created"
  );
  process.exit(1);
}

const events = [...BOOQABLE_WEBHOOK_SUBSCRIBE_ORDER_EVENTS].sort();
const url = `${baseUrl}/api/4/webhook_endpoints`;
const body = {
  data: {
    type: "webhook_endpoints",
    attributes: {
      url: targetUrl,
      version: 4,
      events,
    },
  },
};

console.log("POST", url);
console.log("  target:", targetUrl);
console.log("  events:", events.join(", "));
console.log("");

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = text;
}

if (!res.ok) {
  console.error("Booqable webhook_endpoints create failed:", res.status, data);
  process.exit(1);
}

console.log("OK", res.status);
console.log(JSON.stringify(data, null, 2).slice(0, 2500));
