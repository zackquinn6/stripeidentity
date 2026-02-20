import Stripe from "stripe";

export const config = {
  api: {
    bodyParser: false, // Required for Stripe signature verification
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. Read raw body for signature verification
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({
      error: `Webhook signature verification failed: ${err.message}`,
    });
  }

  // 2. Handle verification completed
  if (event.type === "identity.verification_session.verified") {
    const session = event.data.object;

    const customerId = session.metadata?.customer_id;

    if (!customerId) {
      return res.status(400).json({
        error: "Missing customer_id in Stripe session metadata",
      });
    }

    const baseUrl = process.env.BOOQABLE_BASE_URL;
    if (!baseUrl) {
      return res.status(500).json({
        error: "BOOQABLE_BASE_URL not configured",
      });
    }

    const updateRes = await fetch(
      `${baseUrl}/api/4/customers/${customerId}`,
      {
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
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("Failed to update Booqable customer:", text);
      return res.status(502).json({
        error: "Booqable customer update failed",
        status: updateRes.status,
        customerId,
        details: text,
      });
    }

    return res.status(200).json({
      ok: true,
      event: "identity.verification_session.verified",
      customerId,
    });
  }

  // 4. Ignore other events
  return res.status(200).json({
    ok: true,
    ignored: true,
    event: event.type,
  });
}

// Helper: read raw body for Stripe signature verification
function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
