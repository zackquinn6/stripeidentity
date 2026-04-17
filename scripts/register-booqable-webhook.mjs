/**
 * Register Booqable API v4 webhook endpoint so dashboard / manual orders POST to Vercel.
 *
 * Creates POST https://{company}.booqable.com/api/4/webhook_endpoints with version 4
 * and order events used by api/booqable-order-created (see lib/booqableOrderWebhook.js).
 *
 * Requires BOOQABLE_BASE_URL, BOOQABLE_API_KEY, BOOQABLE_WEBHOOK_TARGET_URL (full HTTPS URL to /api/booqable-order-created).
 *
 * Run: node scripts/register-booqable-webhook.mjs
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { IDENTITY_ORDER_WEBHOOK_EVENTS } from "../lib/booqableOrderWebhook.js";

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
const targetUrl =
  process.env.BOOQABLE_WEBHOOK_TARGET_URL || process.env.WEBHOOK_URL;
if (!targetUrl?.trim()) {
  console.error(
    "Set BOOQABLE_WEBHOOK_TARGET_URL to the public HTTPS URL for this project’s POST handler, e.g. https://<project>.vercel.app/api/booqable-order-created"
  );
  process.exit(1);
}

const missing = ["BOOQABLE_BASE_URL", "BOOQABLE_API_KEY"].filter(
  (k) => !process.env[k]
);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

const events = [...IDENTITY_ORDER_WEBHOOK_EVENTS].sort();

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
console.log(JSON.stringify(data, null, 2).slice(0, 2000));
