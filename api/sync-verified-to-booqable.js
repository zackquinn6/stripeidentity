import Stripe from "stripe";

/**
 * Sync Stripe Identity verified sessions → Booqable.
 *
 * How customer_id gets into Stripe: when we create a verification session in
 * booqable-order-created.js we pass metadata: { customer_id, order_id }. Stripe
 * stores that and includes it in the session (and in webhook events). So only
 * sessions created by our order-created flow have metadata.customer_id; we skip
 * the rest.
 *
 * POST /api/sync-verified-to-booqable
 * Lists sessions with status=verified, PATCHes each with metadata.customer_id
 * to Booqable (Verified + clear URL). Returns { patched: number, errors: [] }.
 */
const BOOQABLE_BASE_URL = process.env.BOOQABLE_BASE_URL;

async function patchBooqableCustomer(baseUrl, customerId) {
  const updateRes = await fetch(`${baseUrl}/api/4/customers/${customerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BOOQABLE_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "customers",
        id: customerId,
        attributes: {
          properties_attributes: [
            { identifier: "identity_verified", value: "Verified" },
            { identifier: "identity_verification_url", value: "" },
          ],
        },
      },
    }),
  });
  if (!updateRes.ok) {
    const text = await updateRes.text();
    return { ok: false, status: updateRes.status, details: text };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!BOOQABLE_BASE_URL) {
    return res.status(500).json({ error: "BOOQABLE_BASE_URL not configured" });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const results = { patched: 0, errors: [] };

    await stripe.identity.verificationSessions
      .list({ status: "verified", limit: 100 })
      .autoPagingEach(async (session) => {
        const customerId = session.metadata?.customer_id;
        if (!customerId) return;

        const result = await patchBooqableCustomer(BOOQABLE_BASE_URL, customerId);
        if (result.ok) {
          results.patched += 1;
        } else {
          results.errors.push({
            customer_id: customerId,
            session_id: session.id,
            status: result.status,
            details: result.details,
          });
        }
      });

    return res.status(200).json(results);
  } catch (error) {
    console.error("Error in sync-verified-to-booqable:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
