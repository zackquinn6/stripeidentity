/**
 * Booqable API v4 — order webhooks and follow-up reads.
 *
 * Order lifecycle (admin / dashboard): New → Draft (saved) → Reserved → …
 * Webhook resource events use dot names (e.g. order.saved_as_draft).
 *
 * @see https://developers.booqable.com/
 * @see https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow
 */

/** Events that should start the identity flow (not order.updated / canceled / etc.). */
export const IDENTITY_ORDER_WEBHOOK_EVENTS = new Set([
  "order.saved_as_draft",
  "order.saved_as_concept",
  "order.reserved",
]);

/**
 * @param {unknown} body
 * @returns {{ kind: 'wrapped', orderId: string, customerId: string, event: string | null }
 *   | { kind: 'native', orderId: string, customerId: string | null, event: string }
 *   | { kind: 'jsonapi_order', orderId: string, customerId: string, event: string | null }
 *   | null}
 */
export function parseBooqableOrderWebhook(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const wrapped = body.order;
  if (wrapped?.id && wrapped?.customer_id) {
    return {
      kind: "wrapped",
      orderId: String(wrapped.id),
      customerId: String(wrapped.customer_id),
      event: null,
    };
  }

  const eventRaw = typeof body.event === "string" ? body.event.trim() : "";
  const event = eventRaw ? eventRaw.toLowerCase() : null;
  const data = body.data;

  if (
    event &&
    event.startsWith("order.") &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.id
  ) {
    const relId = data.relationships?.customer?.data?.id;
    const customerId =
      data.customer_id != null && String(data.customer_id).trim() !== ""
        ? String(data.customer_id).trim()
        : data.customer &&
            typeof data.customer === "object" &&
            data.customer.id != null &&
            String(data.customer.id).trim() !== ""
          ? String(data.customer.id).trim()
          : relId != null && String(relId).trim() !== ""
            ? String(relId).trim()
            : null;

    return {
      kind: "native",
      event,
      orderId: String(data.id),
      customerId,
    };
  }

  const doc = body.data;
  if (
    doc &&
    typeof doc === "object" &&
    doc.type === "orders" &&
    doc.id &&
    doc.relationships?.customer?.data?.id
  ) {
    return {
      kind: "jsonapi_order",
      event,
      orderId: String(doc.id),
      customerId: String(doc.relationships.customer.data.id),
    };
  }

  return null;
}

/**
 * @param {{ kind: string, event: string | null }} parsed
 */
export function identityWebhookEventEligible(parsed) {
  if (parsed.kind === "wrapped") {
    return true;
  }
  if (parsed.kind === "jsonapi_order") {
    if (!parsed.event) {
      return true;
    }
    return IDENTITY_ORDER_WEBHOOK_EVENTS.has(parsed.event);
  }
  if (parsed.kind === "native") {
    return IDENTITY_ORDER_WEBHOOK_EVENTS.has(parsed.event);
  }
  return false;
}

/**
 * Resolve customer id when the webhook `data` omits customer (common for drafts).
 *
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {string} orderId
 * @returns {Promise<{ ok: true, customerId: string | null } | { ok: false, status: number }>}
 */
export async function fetchCustomerIdForOrder(baseUrl, apiKey, orderId) {
  const root = String(baseUrl).replace(/\/$/, "");
  const url = `${root}/api/4/orders/${encodeURIComponent(orderId)}?include=customer`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  const json = await res.json();
  const d = json.data;
  const rel = d?.relationships?.customer?.data?.id;
  if (rel != null && String(rel).trim() !== "") {
    return { ok: true, customerId: String(rel).trim() };
  }
  const inc = json.included;
  if (Array.isArray(inc)) {
    const row = inc.find((x) => x && x.type === "customers" && x.id);
    if (row?.id != null && String(row.id).trim() !== "") {
      return { ok: true, customerId: String(row.id).trim() };
    }
  }
  return { ok: true, customerId: null };
}
