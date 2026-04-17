import {
  coerceBooqableWebhookBody,
  fetchCustomerIdForOrder,
  fetchOrderStatusFromBooqable,
  identityWebhookEventEligible,
  parseBooqableOrderWebhook,
} from "../lib/booqableOrderWebhook.js";
import { runIdentityFlowForOrder } from "../lib/runIdentityFlowForOrder.js";

const BOOQABLE_BASE_URL = process.env.BOOQABLE_BASE_URL;

export default async function handler(req, res) {
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      route: "booqable-order-created",
      booqableBaseUrlConfigured: Boolean(BOOQABLE_BASE_URL),
      usage:
        "POST Booqable v4 webhooks (data.type webhooks per developers.booqable.com #webhooks-fields), order.* payloads, or wrapped { order: { id, customer_id } }. Aliases: /api/webhook, /api/webhooks/booqable, /webhook/booqable.",
    });
    return;
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!BOOQABLE_BASE_URL) {
    return res.status(500).json({ error: "BOOQABLE_BASE_URL not configured" });
  }

  try {
    const rawBody = coerceBooqableWebhookBody(req);
    const webhookEvent =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? rawBody.event ?? null
        : null;
    console.info("booqable-order-created POST", {
      contentType: req.headers["content-type"] ?? null,
      webhookEvent: typeof webhookEvent === "string" ? webhookEvent : null,
    });

    const parsed = parseBooqableOrderWebhook(rawBody);
    if (!parsed) {
      return res.status(400).json({
        error:
          "Unrecognized payload: expected Booqable v4 order webhook (version 4 JSON) or { order: { id, customer_id } }.",
        hint: "Expected Booqable v4 payload: data.type webhooks (attributes.event + attributes.data), event order.* + data, or { order: { id, customer_id } }. See https://developers.booqable.com/#webhooks-fields and docs/zapier-booqable-identity.md.",
      });
    }

    if (!identityWebhookEventEligible(parsed, rawBody)) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "webhook_event_not_used_for_identity",
        event: parsed.event,
        orderId: parsed.orderId,
      });
    }

    const orderId = parsed.orderId;

    if (parsed.kind !== "wrapped") {
      const apiKey = process.env.BOOQABLE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "BOOQABLE_API_KEY not configured" });
      }
      const stRes = await fetchOrderStatusFromBooqable(
        BOOQABLE_BASE_URL,
        apiKey,
        orderId
      );
      if (!stRes.ok) {
        return res.status(502).json({
          error: "Failed to fetch order status from Booqable",
          status: stRes.httpStatus,
          orderId,
        });
      }
      if (stRes.status !== "reserved") {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason: "order_not_reserved",
          orderId,
          booqableStatus: stRes.status,
        });
      }
    }

    let customerId = parsed.customerId;
    if (!customerId) {
      const apiKey = process.env.BOOQABLE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "BOOQABLE_API_KEY not configured" });
      }
      const resolved = await fetchCustomerIdForOrder(
        BOOQABLE_BASE_URL,
        apiKey,
        orderId
      );
      if (!resolved.ok) {
        return res.status(502).json({
          error: "Failed to load order from Booqable to resolve customer",
          status: resolved.status,
          orderId,
        });
      }
      customerId = resolved.customerId;
    }

    if (!customerId) {
      return res.status(400).json({
        error:
          "Order has no customer in Booqable; assign a customer on the order before identity can start.",
        orderId,
      });
    }

    const result = await runIdentityFlowForOrder({
      orderId,
      customerId,
      sourceEvent: parsed.event,
    });
    return res.status(result.httpStatus).json(result.body);
  } catch (error) {
    console.error("Error in booqable-order-created:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
