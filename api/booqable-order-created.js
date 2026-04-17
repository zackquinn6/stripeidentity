import {
  coerceBooqableWebhookBody,
  fetchCustomerIdForOrder,
  fetchOrderStatusFromBooqable,
  identityWebhookEventEligible,
  parseBooqableOrderWebhook,
} from "../lib/booqableOrderWebhook.js";
import { runIdentityFlowForOrder } from "../lib/runIdentityFlowForOrder.js";
import {
  assertToolioBooqableBaseUrl,
  TOOLIO_BOOQABLE_BASE_URL,
} from "../lib/toolioBooqableOrigin.js";

export default async function handler(req, res) {
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  if (req.method === "GET") {
    const urlStatus = assertToolioBooqableBaseUrl(process.env.BOOQABLE_BASE_URL);
    const vercelUrlRaw = process.env.VERCEL_URL;
    const vercelOrigin =
      vercelUrlRaw && typeof vercelUrlRaw === "string"
        ? /^https?:\/\//i.test(vercelUrlRaw.trim())
          ? vercelUrlRaw.trim().replace(/\/$/, "")
          : `https://${vercelUrlRaw.trim().replace(/\/$/, "")}`
        : null;
    res.status(200).json({
      ok: true,
      route: "booqable-order-created",
      booqableBaseUrlRequired: TOOLIO_BOOQABLE_BASE_URL,
      booqableBaseUrlOk: urlStatus.ok,
      ...(urlStatus.ok ? {} : { booqableBaseUrlError: urlStatus.error }),
      note: "This URL path runs on your Vercel deployment, not on Booqable. https://toolio-inc.booqable.com/api/... is Booqable's API (e.g. /api/4/orders) and has no booqable-order-created route — opening it there returns Not found from Booqable.",
      booqableRestApiExample: `${TOOLIO_BOOQABLE_BASE_URL}/orders`,
      configureBooqableWebhookToPostTo:
        vercelOrigin != null
          ? `${vercelOrigin}/api/booqable-order-created`
          : "https://<your-vercel-host>/api/booqable-order-created (replace with your project URL; Vercel sets VERCEL_URL on deployments)",
      usage:
        "POST Booqable v4 webhooks (data.type webhooks per developers.booqable.com #webhooks-fields), order.* payloads, or wrapped { order: { id, customer_id } }. Aliases: /api/webhook, /api/webhooks/booqable, /webhook/booqable.",
      ifNoPostAppearsInVercelLogs: [
        "Creating an order in the dashboard does not by itself send HTTP to Vercel — only a configured webhook (or Zapier/Make) does.",
        "The webhook target URL must be your Vercel host + /api/booqable-order-created (or an alias path), not toolio-inc.booqable.com.",
        "The Booqable endpoint must subscribe to order-related events (e.g. order.updated, order.reserved); see BOOQABLE_WEBHOOK_SUBSCRIBE_ORDER_EVENTS in lib/booqableOrderWebhook.js.",
        "Turn off Vercel Deployment Protection for the deployment that receives webhooks, or Booqable's POST may never reach the function.",
        "Reserve the order if you expect identity: this app skips until Booqable reports status reserved (draft-only webhooks return 200 skipped).",
      ],
    });
    return;
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.info("booqable-order-created: POST ingress", {
    contentType: req.headers["content-type"] ?? null,
    contentLength: req.headers["content-length"] ?? null,
    userAgent:
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 160)
        : null,
  });

  const urlStatus = assertToolioBooqableBaseUrl(process.env.BOOQABLE_BASE_URL);
  if (!urlStatus.ok) {
    console.error("booqable-order-created: BOOQABLE_BASE_URL rejected", urlStatus.error);
    return res.status(500).json({ error: urlStatus.error });
  }
  const booqableBaseUrl = urlStatus.normalized;

  try {
    const rawBody = coerceBooqableWebhookBody(req);
    let webhookEvent = null;
    if (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)) {
      if (typeof rawBody.event === "string") {
        webhookEvent = rawBody.event;
      } else if (
        rawBody.data &&
        typeof rawBody.data === "object" &&
        rawBody.data.attributes &&
        typeof rawBody.data.attributes.event === "string"
      ) {
        webhookEvent = rawBody.data.attributes.event;
      }
    }
    console.info("booqable-order-created: body parsed", {
      webhookEvent: typeof webhookEvent === "string" ? webhookEvent : null,
      bodyKeys:
        rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
          ? Object.keys(rawBody).slice(0, 20)
          : null,
    });

    const parsed = parseBooqableOrderWebhook(rawBody);
    if (!parsed) {
      console.warn("booqable-order-created: unrecognized payload shape");
      return res.status(400).json({
        error:
          "Unrecognized payload: expected Booqable v4 order webhook (version 4 JSON) or { order: { id, customer_id } }.",
        hint: "Expected Booqable v4 payload: data.type webhooks (attributes.event + attributes.data), event order.* + data, or { order: { id, customer_id } }. See https://developers.booqable.com/#webhooks-fields and docs/zapier-booqable-identity.md.",
      });
    }

    if (!identityWebhookEventEligible(parsed, rawBody)) {
      console.info("booqable-order-created: skipped (event not used)", {
        event: parsed.event,
        orderId: parsed.orderId,
      });
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
        booqableBaseUrl,
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
        console.info("booqable-order-created: skipped (order not reserved)", {
          orderId,
          booqableStatus: stRes.status,
        });
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
        booqableBaseUrl,
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
