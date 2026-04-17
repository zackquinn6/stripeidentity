import Stripe from "stripe";
import { sendVerificationEmail } from "../lib/sendVerificationEmail.js";
import {
  fetchCustomerIdForOrder,
  identityWebhookEventEligible,
  parseBooqableOrderWebhook,
} from "../lib/booqableOrderWebhook.js";

const BOOQABLE_BASE_URL = process.env.BOOQABLE_BASE_URL;

function trimEmail(value) {
  if (typeof value !== "string") {
    return null;
  }
  const t = value.trim();
  return t.length > 0 ? t : null;
}

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
        hint: "Register a v4 webhook endpoint (POST /api/4/webhook_endpoints) with events such as order.saved_as_draft and order.reserved; URL must be this route. See lib/booqableOrderWebhook.js and scripts/register-booqable-webhook.mjs."
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

    const customerEmail = trimEmail(customer.email);
    if (!customerEmail) {
      return res.status(400).json({
        error: "Customer has no email in Booqable (required for Resend).",
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
              order_id: orderId,
              customer_email: customerEmail
            }
          }
        : {
            type: "document",
            metadata: {
              customer_id: customerId,
              order_id: orderId,
              customer_email: customerEmail
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
      booqableWebhookEvent: parsed.event,
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
