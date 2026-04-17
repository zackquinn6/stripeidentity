/**
 * List Booqable v4 webhook_endpoints for this account (GET /api/4/webhook_endpoints).
 * Use this when Vercel receives no POSTs — usually no endpoint, wrong URL, or wrong events.
 *
 * Requires: BOOQABLE_BASE_URL, BOOQABLE_API_KEY
 * Run: node scripts/list-booqable-webhook-endpoints.mjs
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

const urlCheck = assertToolioBooqableBaseUrl(process.env.BOOQABLE_BASE_URL);
if (!urlCheck.ok) {
  console.error(urlCheck.error);
  process.exit(1);
}
const baseUrl = urlCheck.normalized;
const apiKey = process.env.BOOQABLE_API_KEY;
const missing = ["BOOQABLE_BASE_URL", "BOOQABLE_API_KEY"].filter(
  (k) => !process.env[k]
);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

const listUrl = `${baseUrl}/api/4/webhook_endpoints`;
console.log("GET", listUrl, "\n");

const res = await fetch(listUrl, {
  headers: { Authorization: `Bearer ${apiKey}` },
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = text;
}

if (!res.ok) {
  console.error("List failed:", res.status, data);
  process.exit(1);
}

const rows = Array.isArray(data?.data) ? data.data : [];
if (rows.length === 0) {
  console.log("No webhook_endpoints on this Booqable account.");
  console.log(
    "Create one: set BOOQABLE_WEBHOOK_TARGET_URL and run node scripts/register-booqable-webhook-endpoint.mjs"
  );
  process.exit(0);
}

for (const row of rows) {
  const id = row.id;
  const a = row.attributes || {};
  console.log("—");
  console.log("  id:", id);
  console.log("  url:", a.url);
  console.log("  version:", a.version);
  console.log("  events:", Array.isArray(a.events) ? a.events.join(", ") : a.events);
}

console.log("\n", rows.length, "endpoint(s). If none match your Vercel URL, Booqable will not POST there on reserve.");
