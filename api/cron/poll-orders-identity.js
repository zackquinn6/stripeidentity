import { listRecentReservedOrdersForPoll } from "../../lib/pollBooqableReservedOrders.js";
import { runIdentityFlowForOrder } from "../../lib/runIdentityFlowForOrder.js";

/**
 * Secured poll: lists recent reserved orders from Booqable and runs the same identity
 * pipeline as POST /api/booqable-order-created (Stripe + Resend + Booqable PATCH).
 *
 * Invoke on a schedule (Vercel Cron or any external scheduler). No Zapier Webhooks plan required.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (match env CRON_SECRET). Vercel Cron sends this automatically when CRON_SECRET is set in the project.
 *
 * @see https://vercel.com/docs/cron-jobs
 */

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = req.headers?.authorization || req.headers?.Authorization;
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const baseUrl = process.env.BOOQABLE_BASE_URL;
  const apiKey = process.env.BOOQABLE_API_KEY;
  if (!baseUrl || !apiKey) {
    return res.status(500).json({
      error: "BOOQABLE_BASE_URL and BOOQABLE_API_KEY are required",
    });
  }

  const raw = process.env.ORDER_POLL_LOOKBACK_MINUTES;
  const lookbackMinutes =
    raw != null && String(raw).trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(lookbackMinutes) || lookbackMinutes <= 0) {
    return res.status(500).json({
      error:
        "Set ORDER_POLL_LOOKBACK_MINUTES to a positive number (minutes of order updated_at to scan, e.g. 15).",
    });
  }

  try {
    const listed = await listRecentReservedOrdersForPoll(
      baseUrl,
      apiKey,
      lookbackMinutes
    );
    if (!listed.ok) {
      return res.status(502).json({
        error: "Failed to list orders from Booqable",
        status: listed.status,
      });
    }

    const results = [];
    for (const { orderId, customerId } of listed.orders) {
      try {
        const r = await runIdentityFlowForOrder({
          orderId,
          customerId,
          sourceEvent: "poll.reserved_order",
        });
        results.push({
          orderId,
          customerId,
          outcome: r.outcome,
          ...(r.body?.skipped !== undefined && { skipped: r.body.skipped }),
          ...(r.body?.reason && { reason: r.body.reason }),
          ...(r.body?.createdVerificationSession !== undefined && {
            createdVerificationSession: r.body.createdVerificationSession,
          }),
          ...(r.body?.error && { error: r.body.error }),
        });
      } catch (e) {
        results.push({
          orderId,
          customerId,
          outcome: "threw",
          error: e.message,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      lookbackMinutes,
      ordersConsidered: listed.orders.length,
      results,
    });
  } catch (e) {
    console.error("poll-orders-identity:", e);
    return res.status(500).json({ error: "Internal server error", message: e.message });
  }
}
