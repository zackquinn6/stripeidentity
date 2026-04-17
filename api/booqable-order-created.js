import Stripe from "stripe";
import { sendVerificationEmail } from "../lib/sendVerificationEmail.js";

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

    const customerEmail = customer.email;
    if (!customerEmail) {
      return res.status(400).json({
        error: "Customer has no email in Booqable",
        customerId
      });
    }

    const identityVerifiedStatus = customer.properties?.identity_verified;
    // Booqable leaves this null for new customers; only the literal "Verified" skips the flow.
    const alreadyVerified = identityVerifiedStatus === "Verified";
    if (alreadyVerified) {
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

    const resendConfigured = Boolean(
      process.env.RESEND_API_KEY && process.env.RESEND_FROM
    );

    let emailSent = false;
    let emailError = null;
    if (resendConfigured) {
      try {
        const emailResult = await sendVerificationEmail({
          to: customerEmail,
          verificationUrl: session.url
        });
        if (emailResult.error) {
          emailError = emailResult.error.message || String(emailResult.error);
          console.error("Resend email failed:", emailError);
        } else {
          emailSent = true;
        }
      } catch (err) {
        emailError = err.message;
        console.error("Resend email error:", err);
      }
    } else {
      console.error(
        "Verification session created but email not sent: set RESEND_API_KEY and RESEND_FROM"
      );
    }

    return res.status(200).json({
      ok: true,
      createdVerificationSession: true,
      customerId,
      orderId,
      verificationUrl: session.url,
      emailSent,
      resendConfigured,
      ...(emailError && { emailError })
    });
  } catch (error) {
    console.error("Error in booqable-order-created:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
}
