/**
 * Booqable order signals → this repo’s POST /api/booqable-order-created handler.
 *
 * **Admin workflow** (dashboard): New → save as Draft → Reserve. Identity runs when
 * the order is **reserved** (`order.reserved`), or when Booqable sends `order.updated`
 * and GET /api/4/orders/:id reports `status: reserved` (some flows emit updated
 * instead of or in addition to reserved).
 *
 * **Native push:** `webhook_endpoints` with `version: 4` → your Vercel URL.
 * @see https://developers.booqable.com/#webhook-endpoints-subscribe-to-webhook-events
 * @see https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow
 * @see scripts/register-booqable-webhook-endpoint.mjs
 *
 * **Wrapped body** (Zapier/Make): `{ "order": { "id", "customer_id" } }`
 *
 * @see https://developers.booqable.com/
 */

/**
 * Order webhook events that mean “committed reservation” for identity (no extra
 * order GET for gating). Draft/concept saves are excluded so admin draft edits and
 * unfinished webshop carts do not start Stripe Identity.
 */
export const IDENTITY_ORDER_WEBHOOK_EVENTS = new Set(["order.reserved"]);

/**
 * Events to subscribe on `POST /api/4/webhook_endpoints`. `order.updated` is included
 * so transitions to reserved still reach Vercel when Booqable does not emit
 * `order.reserved`; the handler confirms `status: reserved` via GET /api/4/orders/:id.
 */
export const BOOQABLE_WEBHOOK_SUBSCRIBE_ORDER_EVENTS = [
  "order.reserved",
  "order.updated",
];

/**
 * Order `status` on v4 webhook `data` (nested or flat).
 * @param {unknown} data
 * @returns {string | null} lowercased status or null
 */
export function webhookPayloadOrderStatus(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const raw =
    data.status ??
    (data.attributes && typeof data.attributes === "object"
      ? data.attributes.status
      : undefined);
  if (raw == null) {
    return null;
  }
  const t = String(raw).trim().toLowerCase();
  return t.length > 0 ? t : null;
}

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
 * @param {unknown} rawBody original POST body (for status on jsonapi without event name)
 */
export function identityWebhookEventEligible(parsed, rawBody) {
  if (parsed.kind === "wrapped") {
    return true;
  }

  const data = rawBody && typeof rawBody === "object" ? rawBody.data : null;

  if (parsed.kind === "jsonapi_order") {
    if (!parsed.event) {
      return webhookPayloadOrderStatus(data) === "reserved";
    }
    if (IDENTITY_ORDER_WEBHOOK_EVENTS.has(parsed.event)) {
      return true;
    }
    if (parsed.event === "order.updated") {
      return true;
    }
    return false;
  }

  if (parsed.kind === "native") {
    if (IDENTITY_ORDER_WEBHOOK_EVENTS.has(parsed.event)) {
      return true;
    }
    if (parsed.event === "order.updated") {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * GET /api/4/orders/:id — canonical status for gating `order.updated` webhooks.
 *
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {string} orderId
 * @returns {Promise<{ ok: true, status: string | null } | { ok: false, httpStatus: number }>}
 */
export async function fetchOrderStatusFromBooqable(baseUrl, apiKey, orderId) {
  const root = String(baseUrl).replace(/\/$/, "");
  const url = `${root}/api/4/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return { ok: false, httpStatus: res.status };
  }
  const json = await res.json();
  const attrs = json.data?.attributes;
  const raw = attrs?.status;
  if (raw == null) {
    return { ok: true, status: null };
  }
  const t = String(raw).trim().toLowerCase();
  return { ok: true, status: t.length > 0 ? t : null };
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
