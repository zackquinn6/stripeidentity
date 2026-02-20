import Stripe from "stripe";

const BOOQABLE_BASE_URL = process.env.BOOQABLE_BASE_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!BOOQABLE_BASE_URL) {
    return res.status(500).json({ error: "BOOQABLE_BASE_URL not configured" });
  }

  try {
    const order = req.body.order;
    if (!order?.id || !order?.customer_id) {
      return res.status(400).json({
        error: "Missing required fields: order.id, order.customer_id",
        received: req.body
      });
    }
    const orderId = order.id;
    const customerId = order.customer_id;
    const customerEmail = order.customer?.email;
    if (!customerEmail) {
      return res.status(400).json({
        error: "Missing order.customer.email",
        received: req.body
      });
    }

    const customerRes = await fetch(
      `${BOOQABLE_BASE_URL}/api/4/customers/${customerId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BOOQABLE_API_KEY}`
        }
      }
    );

    if (!customerRes.ok) {
      return res.status(customerRes.status).json({
        error: "Failed to fetch customer from Booqable",
        status: customerRes.status,
        customerId
      });
    }

    const customerData = await customerRes.json();
    const customer = customerData.data?.attributes;
    if (!customer) {
      return res.status(500).json({
        error: "Invalid customer data: expected JSON:API data.attributes",
        customerData
      });
    }

    if (customer.properties?.identity_verified === "Verified") {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Customer already verified",
        customerId,
        orderId
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const flowId = process.env.STRIPE_IDENTITY_FLOW_ID;
    const session = await stripe.identity.verificationSessions.create(
      flowId
        ? {
            verification_flow: flowId,
            metadata: {
              customer_id: customerId,
              order_id: orderId
            }
          }
        : {
            type: "document",
            metadata: {
              customer_id: customerId,
              order_id: orderId
            },
            options: {
              document: {
                require_id_number: true,
                require_live_capture: true
              }
            }
          }
    );

    const updateRes = await fetch(
      `${BOOQABLE_BASE_URL}/api/4/customers/${customerId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BOOQABLE_API_KEY}`
        },
        body: JSON.stringify({
          data: {
            type: "customers",
            id: customerId,
            attributes: {
              properties_attributes: [
                { identifier: "identity_verification_url", value: session.url },
                { identifier: "identity_verified", value: "Unverified" }
              ]
            }
          }
        })
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error("Failed to update customer in Booqable:", text);
      return res.status(502).json({
        error: "Booqable customer update failed",
        status: updateRes.status,
        customerId,
        details: text
      });
    }

    return res.status(200).json({
      ok: true,
      createdVerificationSession: true,
      customerId,
      orderId,
      verificationUrl: session.url
    });
  } catch (error) {
    console.error("Error in booqable-order-created:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
}
