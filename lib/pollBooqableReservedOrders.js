/**
 * List recent Booqable orders in `reserved` status (stock committed).
 * Uses GET /api/4/orders with include=customer, then filters in process.
 *
 * @see https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow
 */

/**
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {number} lookbackMinutes Only orders whose updated_at (or created_at) is within this window.
 * @returns {Promise<{ ok: true, orders: { orderId: string, customerId: string }[] } | { ok: false, status: number }>}
 */
export async function listRecentReservedOrdersForPoll(
  baseUrl,
  apiKey,
  lookbackMinutes
) {
  const root = String(baseUrl).replace(/\/$/, "");
  const url = `${root}/api/4/orders?page[size]=50&sort=-updated_at&include=customer`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return { ok: false, status: res.status, orders: [] };
  }
  const json = await res.json();
  const rows = Array.isArray(json.data) ? json.data : [];
  const threshold = Date.now() - lookbackMinutes * 60 * 1000;
  const out = [];

  for (const row of rows) {
    const attrs = row.attributes || {};
    const st = String(attrs.status ?? "").toLowerCase();
    if (st !== "reserved") {
      continue;
    }
    const tsRaw = attrs.updated_at ?? attrs.created_at;
    const ts = tsRaw ? Date.parse(tsRaw) : NaN;
    if (Number.isFinite(ts) && ts < threshold) {
      continue;
    }
    const cid = row.relationships?.customer?.data?.id;
    if (cid == null || String(cid).trim() === "") {
      continue;
    }
    out.push({ orderId: String(row.id), customerId: String(cid).trim() });
  }

  return { ok: true, orders: out };
}
