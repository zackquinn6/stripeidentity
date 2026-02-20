import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

  // 2. Fetch the customer from Booqable
  const customerRes = await fetch(
    `https://api.booqable.com/api/4/customers/${customerId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.BOOQABLE_API_KEY}`
      }
    }
  );

  const customerData = await customerRes.json();
  const customer = customerData.customer;

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

  // 5. PATCH the customer with the verification URL
  await fetch(
    `https://api.booqable.com/api/4/customers/${customerId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BOOQABLE_API_KEY}`
      },
      body: JSON.stringify({
        customer: {
          custom_fields: {
            identity_verification_url: verificationUrl
          }
        }
      })
    }
  );

  // 6. Return clean debugging output
  return res.status(200).json({
    ok: true,
    createdVerificationSession: true,
    customerId,
    orderId,
    verificationUrl
  });
}
