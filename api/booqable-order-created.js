import {
  fetchCustomerIdForOrder,
  identityWebhookEventEligible,
  parseBooqableOrderWebhook,
} from "../lib/booqableOrderWebhook.js";
import { runIdentityFlowForOrder } from "../lib/runIdentityFlowForOrder.js";

const BOOQABLE_BASE_URL = process.env.BOOQABLE_BASE_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!BOOQABLE_BASE_URL) {
    return res.status(500).json({ error: "BOOQABLE_BASE_URL not configured" });
  }

  try {
    const parsed = parseBooqableOrderWebhook(req.body);
    if (!parsed) {
      return res.status(400).json({
        error:
          "Unrecognized payload: expected Booqable v4 order webhook (version 4 JSON) or { order: { id, customer_id } }.",
        hint: "Use Zapier/Make with an HTTP POST (not Webhooks by Zapier), or run Vercel Cron on GET /api/cron/poll-orders-identity. See docs/zapier-booqable-identity.md and docs/poll-identity-cron.md.",
      });
    }

    if (!identityWebhookEventEligible(parsed)) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "webhook_event_not_used_for_identity",
        event: parsed.event,
        orderId: parsed.orderId,
      });
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
        parsed.orderId
      );
      if (!resolved.ok) {
        return res.status(502).json({
          error: "Failed to load order from Booqable to resolve customer",
          status: resolved.status,
          orderId: parsed.orderId,
        });
      }
      customerId = resolved.customerId;
    }

    if (!customerId) {
      return res.status(400).json({
        error:
          "Order has no customer in Booqable; assign a customer on the order before identity can start.",
        orderId: parsed.orderId,
      });
    }

    const orderId = parsed.orderId;

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
