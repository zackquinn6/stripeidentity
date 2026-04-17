/**
 * Booqable order signals → this repo’s POST /api/booqable-order-created handler.
 *
 * Per https://developers.booqable.com/ — API base is `https://{company_slug}.booqable.com/api/4/`.
 * Webhook **endpoints** support **Version 1 (default)** and **Version 4 (opt-in)**; payloads
 * differ by version. This app normalizes inbound POST bodies (JSON and common
 * `application/x-www-form-urlencoded` shapes), parses `order.*` events, then uses GET
 * `/api/4/orders/:id` to run identity only when Booqable reports `status: reserved`.
 *
 * **Webhook resource (v4):** `GET /api/4/webhooks/:id` returns `data.type: "webhooks"` with
 * `attributes.event`, `attributes.resource_type`, and flat `attributes.data` — the same
 * shape is used for deliveries to your endpoint ([webhooks fields](https://developers.booqable.com/#webhooks-fields)).
 *
 * **Wrapped body** (Zapier/Make): `{ "order": { "id", "customer_id" } }` — unchanged.
 *
 * @see https://developers.booqable.com/#webhook-endpoints-subscribe-to-webhook-events
 * @see https://developers.booqable.com/#webhook-endpoints-version-1-default
 * @see https://developers.booqable.com/#webhook-endpoints-version-4-opt-in
 * @see https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow
 * @see scripts/register-booqable-webhook-endpoint.mjs
 */

/**
 * Turn Vercel `req.body` + `Content-Type` into a single JSON object for {@link parseBooqableOrderWebhook}.
 * Handles `application/json`, raw JSON strings, and Booqable v1-style form bodies.
 *
 * @param {{ body?: unknown, headers?: Record<string, string | string[] | undefined> }} req
 * @returns {Record<string, unknown> | null}
 */
export function coerceBooqableWebhookBody(req) {
  const headers = req.headers || {};
  const ctRaw = headers["content-type"];
  const ct = Array.isArray(ctRaw) ? ctRaw[0] : ctRaw;
  const ctLower = String(ct || "").toLowerCase();

  let body = req.body;
  if (body == null || body === "") {
    return null;
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(body)) {
    body = body.toString("utf8");
  }

  if (typeof body === "string") {
    if (ctLower.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(body);
      for (const key of ["payload", "body", "json"]) {
        const raw = params.get(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              return parsed;
            }
          } catch {
            try {
              const parsed = JSON.parse(decodeURIComponent(raw.replace(/\+/g, " ")));
              if (parsed && typeof parsed === "object") {
                return parsed;
              }
            } catch {
              /* continue */
            }
          }
        }
      }
      const flat = Object.fromEntries(params.entries());
      if (typeof flat.data === "string") {
        try {
          flat.data = JSON.parse(flat.data);
        } catch {
          /* leave string */
        }
      }
      if (flat.event != null || flat.id != null || flat.data != null) {
        return /** @type {Record<string, unknown>} */ (flat);
      }
      return null;
    }
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (body && typeof body === "object" && !Array.isArray(body)) {
    if (typeof body.payload === "string") {
      try {
        const parsed = JSON.parse(body.payload);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        return /** @type {Record<string, unknown>} */ (body);
      }
    }
    return /** @type {Record<string, unknown>} */ (body);
  }

  return null;
}

/**
 * Events for optional `POST /api/4/webhook_endpoints` (only if your token can manage
 * Booqable webhooks). Broad list so deliveries reach Vercel; the handler still
 * requires `reserved` via GET order for identity.
 */
export const BOOQABLE_WEBHOOK_SUBSCRIBE_ORDER_EVENTS = [
  "cart.completed_checkout",
  "order.saved_as_draft",
  "order.saved_as_concept",
  "order.reserved",
  "order.updated",
  "order.started",
  "order.stopped",
  "order.canceled",
  "order.archived",
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
 *   | { kind: 'jsonapi_order', orderId: string, customerId: string | null, event: string | null }
 *   | null}
 */
function customerIdFromOrderResource(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const relId = data.relationships?.customer?.data?.id;
  if (data.customer_id != null && String(data.customer_id).trim() !== "") {
    return String(data.customer_id).trim();
  }
  if (
    data.customer &&
    typeof data.customer === "object" &&
    data.customer.id != null &&
    String(data.customer.id).trim() !== ""
  ) {
    return String(data.customer.id).trim();
  }
  if (relId != null && String(relId).trim() !== "") {
    return String(relId).trim();
  }
  return null;
}

/**
 * Version 4 webhooks may side-load a single customer in `included` (see API “Included Resources”).
 *
 * @param {unknown} body
 * @param {string | null} customerId
 * @returns {string | null}
 */
function mergeCustomerFromIncluded(body, customerId) {
  if (customerId != null && String(customerId).trim() !== "") {
    return String(customerId).trim();
  }
  const inc =
    body && typeof body === "object" && !Array.isArray(body) ? body.included : null;
  if (!Array.isArray(inc)) {
    return null;
  }
  const customers = inc.filter((x) => x && x.type === "customers" && x.id);
  if (customers.length !== 1) {
    return null;
  }
  return String(customers[0].id).trim();
}

/**
 * @param {unknown} inner attributes.data for resource_type carts (cart.completed_checkout).
 * @returns {string | null}
 */
function orderIdFromCartWebhookInner(inner) {
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) {
    return null;
  }
  const o = inner.order;
  if (o && typeof o === "object" && !Array.isArray(o) && o.id != null && String(o.id).trim() !== "") {
    return String(o.id).trim();
  }
  if (inner.order_id != null && String(inner.order_id).trim() !== "") {
    return String(inner.order_id).trim();
  }
  return null;
}

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

  const hookDoc = body.data;
  if (
    hookDoc &&
    typeof hookDoc === "object" &&
    hookDoc.type === "webhooks" &&
    hookDoc.attributes &&
    typeof hookDoc.attributes === "object"
  ) {
    const attrs = hookDoc.attributes;
    const ev = typeof attrs.event === "string" ? attrs.event.trim().toLowerCase() : null;
    const rt =
      typeof attrs.resource_type === "string"
        ? attrs.resource_type.trim().toLowerCase()
        : "";
    const inner = attrs.data;
    if (
      ev &&
      ev.startsWith("order.") &&
      rt === "orders" &&
      inner &&
      typeof inner === "object" &&
      !Array.isArray(inner) &&
      inner.id != null &&
      String(inner.id).trim() !== ""
    ) {
      return {
        kind: "native",
        event: ev,
        orderId: String(inner.id).trim(),
        customerId: mergeCustomerFromIncluded(body, customerIdFromOrderResource(inner)),
      };
    }
    if (
      ev === "cart.completed_checkout" &&
      rt === "carts" &&
      inner &&
      typeof inner === "object" &&
      !Array.isArray(inner)
    ) {
      const oid = orderIdFromCartWebhookInner(inner);
      if (oid) {
        return {
          kind: "native",
          event: ev,
          orderId: oid,
          customerId: mergeCustomerFromIncluded(body, customerIdFromOrderResource(inner)),
        };
      }
    }
  }

  const eventRaw = typeof body.event === "string" ? body.event.trim() : "";
  const event = eventRaw ? eventRaw.toLowerCase() : null;
  const data = body.data;

  if (event && event.startsWith("order.") && Array.isArray(data)) {
    const orderDoc = data.find(
      (x) => x && typeof x === "object" && !Array.isArray(x) && x.type === "orders" && x.id
    );
    if (orderDoc) {
      const cid = mergeCustomerFromIncluded(
        body,
        customerIdFromOrderResource(orderDoc)
      );
      return {
        kind: "native",
        event,
        orderId: String(orderDoc.id),
        customerId: cid,
      };
    }
  }

  if (!event && Array.isArray(data)) {
    const orderDoc = data.find(
      (x) => x && typeof x === "object" && !Array.isArray(x) && x.type === "orders" && x.id
    );
    if (orderDoc) {
      const cid = mergeCustomerFromIncluded(
        body,
        customerIdFromOrderResource(orderDoc)
      );
      return {
        kind: "jsonapi_order",
        event: null,
        orderId: String(orderDoc.id),
        customerId: cid,
      };
    }
  }

  if (
    event &&
    event.startsWith("order.") &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.id
  ) {
    const cid = mergeCustomerFromIncluded(body, customerIdFromOrderResource(data));
    return {
      kind: "native",
      event,
      orderId: String(data.id),
      customerId: cid,
    };
  }

  const doc = body.data;
  if (doc && typeof doc === "object" && !Array.isArray(doc) && doc.type === "orders" && doc.id) {
    const cid = mergeCustomerFromIncluded(body, customerIdFromOrderResource(doc));
    return {
      kind: "jsonapi_order",
      event,
      orderId: String(doc.id),
      customerId: cid,
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
    if (parsed.event == null || parsed.event === "") {
      return true;
    }
    return parsed.event.startsWith("order.");
  }

  if (parsed.kind === "native") {
    if (!parsed.event) {
      return false;
    }
    if (parsed.event.startsWith("order.")) {
      return true;
    }
    return parsed.event === "cart.completed_checkout";
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
