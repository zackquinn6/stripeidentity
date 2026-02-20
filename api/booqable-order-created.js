import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Extract payload (supports both flat + nested formats)
    const orderId =
      req.body.order_id ||
      req.body.order?.id;

    const customerId =
      req.body.customer_id ||
      req.body.order?.customer_id;

    const customerEmail =
      req.body.customer_email ||
      req.body.order?.customer?.email;

    if (!orderId || !customerId || !customerEmail) {
      return res.status(400).json({
        error: "Missing required fields",
        received: req.body
      });
    }

    // 2. Fetch the customer from Booqable (using tenant-specific subdomain)
    const customerRes = await fetch(
      `https://toolio-inc.booqable.com/api/4/customers/${customerId}`,
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
    // Handle JSON:API format: data.attributes or direct customer object
    const customer = customerData.data?.attributes || customerData.customer || customerData;

    if (!customer) {
      return res.status(500).json({
        error: "Invalid customer data structure",
        customerData
      });
    }

    // 3. Skip verification if already verified
    if (customer.custom_fields?.identity_verified) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Customer already verified",
        customerId,
        orderId
      });
    }

    // 4. Create Stripe Identity session
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.identity.verificationSessions.create({
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
    });

    const verificationUrl = session.url;

    // 5. PATCH the customer with the verification URL (using tenant-specific subdomain)
    const updateRes = await fetch(
      `https://toolio-inc.booqable.com/api/4/customers/${customerId}`,
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
              custom_fields: {
                identity_verification_url: verificationUrl
              }
            }
          }
        })
      }
    );

    if (!updateRes.ok) {
      console.error("Failed to update customer in Booqable:", await updateRes.text());
      // Continue anyway - we still created the session
    }

    // 6. Return clean debugging output
    return res.status(200).json({
      ok: true,
      createdVerificationSession: true,
      customerId,
      orderId,
      verificationUrl
    });
  } catch (error) {
    console.error('Error in booqable-order-created:', error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
}
