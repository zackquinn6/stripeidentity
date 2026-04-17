import Stripe from "stripe";
import { sendVerificationEmail } from "../lib/sendVerificationEmail.js";

const BOOQABLE_BASE_URL = process.env.BOOQABLE_BASE_URL;

function trimEmail(value) {
  if (typeof value !== "string") {
    return null;
  }
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * Booqable may POST either:
 * - Test / Zapier shape: { order: { id, customer_id, customer?: { email } } }
 * - Native v4 webhooks: { event: "order.created" | …, data: { id, customer: { id, email? } } }
 * - JSON:API document: { data: { type: "orders", id, relationships… }, included?: [{ type: "customers", attributes.email }] }
 */
function extractOrderContext(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const wrapped = body.order;
  if (wrapped?.id && wrapped?.customer_id) {
    const emailFromPayload =
      wrapped.customer != null && typeof wrapped.customer === "object"
        ? trimEmail(wrapped.customer.email)
        : null;
    return {
      orderId: String(wrapped.id),
      customerId: String(wrapped.customer_id),
      emailFromPayload
    };
  }

  const event = body.event;
  const data = body.data;
  if (
    typeof event === "string" &&
    event.startsWith("order.") &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.id
  ) {
    const customerId =
      data.customer_id != null && data.customer_id !== ""
        ? String(data.customer_id)
        : data.customer != null && typeof data.customer === "object" && data.customer.id
          ? String(data.customer.id)
          : null;
    if (customerId) {
      const emailFromPayload =
        data.customer != null && typeof data.customer === "object"
          ? trimEmail(data.customer.email)
          : null;
      return { orderId: String(data.id), customerId, emailFromPayload };
    }
  }

  const doc = body.data;
  if (
    doc &&
    typeof doc === "object" &&
    doc.type === "orders" &&
    doc.id &&
    doc.relationships?.customer?.data?.id
  ) {
    const customerId = String(doc.relationships.customer.data.id);
    let emailFromPayload = null;
    const included = body.included;
    if (Array.isArray(included)) {
      const row = included.find(
        (item) =>
          item &&
          item.type === "customers" &&
          String(item.id) === customerId &&
          item.attributes
      );
      emailFromPayload = trimEmail(row?.attributes?.email);
    }
    return { orderId: String(doc.id), customerId, emailFromPayload };
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!BOOQABLE_BASE_URL) {
    return res.status(500).json({ error: "BOOQABLE_BASE_URL not configured" });
  }

  try {
    const ctx = extractOrderContext(req.body);
    if (!ctx) {
      return res.status(400).json({
        error:
          "Unrecognized payload: expected Booqable v4 webhook (event order.* + data.id + data.customer.id) or { order: { id, customer_id } }",
        hint: "Register webhook URL pointing to this route; use webhook version 4 (application/json)."
      });
    }
    const { orderId, customerId, emailFromPayload } = ctx;

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

    const emailFromApi = trimEmail(customer.email);
    let customerEmail = emailFromApi;
    if (!customerEmail && emailFromPayload) {
      console.warn(
        "booqable-order-created: Booqable customer record has no email; using email from webhook payload for Resend."
      );
      customerEmail = emailFromPayload;
    }
    if (!customerEmail) {
      return res.status(400).json({
        error:
          "No customer email: missing on Booqable customer and not present on webhook payload (data.customer.email or order.customer.email).",
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
