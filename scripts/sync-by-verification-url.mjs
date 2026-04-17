/**
 * One-time / legacy sync: match Stripe Identity verified sessions to Booqable.
 *
 * Prefers session.metadata.customer_id when present. Otherwise matches by
 * session.url against Booqable customers that still have identity_verification_url
 * stored (legacy rows only — the live app no longer writes that field).
 *
 * Patches only identity_verified on Booqable (does not write verification URL).
 *
 * Run from repo root: node scripts/sync-by-verification-url.mjs
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Stripe from "stripe";
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

const required = ["BOOQABLE_BASE_URL", "BOOQABLE_API_KEY", "STRIPE_SECRET_KEY"];
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
const apiKey = process.env.BOOQABLE_API_KEY;

async function listBooqableCustomers() {
  const customers = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${baseUrl}/customers?page[number]=${page}&page[size]=50`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Booqable list failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const data = json.data ?? [];
    if (data.length === 0) break;
    for (const c of data) {
      const attrs = c.attributes ?? {};
      customers.push({
        id: c.id,
        name: attrs.name,
        email: attrs.email,
        verification_url: attrs.properties?.identity_verification_url,
      });
    }
    if (data.length < 50) break;
    page += 1;
  }
  return customers;
}

async function patchBooqableCustomer(customerId, status) {
  const res = await fetch(`${baseUrl}/customers/${customerId}`, {
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
          properties_attributes: [{ identifier: "identity_verified", value: status }],
        },
      },
    }),
  });
  if (!res.ok) return { ok: false, status: res.status, text: await res.text() };
  return { ok: true };
}

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  console.log("1. Fetching Stripe Identity verification sessions (live mode)...");
  const allSessions = [];
  await stripe.identity.verificationSessions
    .list({ limit: 100 })
    .autoPagingEach((session) => {
      allSessions.push({
        id: session.id,
        status: session.status,
        url: session.url ?? null,
        metadata: session.metadata ?? {},
      });
    });

  const verifiedSessions = allSessions.filter((s) => s.status === "verified");
  if (allSessions.length > 0) {
    const byStatus = {};
    for (const s of allSessions) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    console.log(`   Total sessions: ${allSessions.length}`, byStatus);
  }
  console.log(`   Verified sessions: ${verifiedSessions.length}`);

  if (verifiedSessions.length === 0) {
    if (allSessions.length === 0) {
      console.log("   No verification sessions in Stripe. Done.");
    } else {
      console.log("   No sessions with status=verified. Sessions:", allSessions.map((s) => ({ id: s.id, status: s.status })));
    }
    return;
  }

  console.log("2. Fetching Booqable customers...");
  const customers = await listBooqableCustomers();
  const urlToCustomer = new Map();
  for (const c of customers) {
    const url = c.verification_url;
    if (url) urlToCustomer.set(url.trim(), c);
  }
  console.log(`   Found ${customers.length} customer(s), ${urlToCustomer.size} with verification URL`);

  console.log("3. Matching Stripe to Booqable and patching...");
  let patched = 0;
  let skipped = 0;
  for (const session of verifiedSessions) {
    let customerId = null;
    let customerLabel = "";

    if (session.metadata?.customer_id) {
      customerId = session.metadata.customer_id;
      customerLabel = `metadata.customer_id ${customerId}`;
    }
    if (!customerId && session.url) {
      const customer = urlToCustomer.get(session.url.trim());
      if (customer) {
        customerId = customer.id;
        customerLabel = customer.name || customer.email || customerId;
      }
    }

    if (!customerId) {
      console.log(`   No Booqable match for Stripe session ${session.id} (no metadata.customer_id, no legacy URL match)`);
      skipped += 1;
      continue;
    }

    const result = await patchBooqableCustomer(customerId, "Verified");
    if (result.ok) {
      console.log(`   Patched ${customerLabel} → Verified`);
      patched += 1;
    } else {
      console.error(`   Failed to patch ${customerId}: ${result.status} ${result.text}`);
    }
  }

  console.log(`\nDone. Patched: ${patched}, no match: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
