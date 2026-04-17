import Stripe from "stripe";
import { sendVerificationEmail } from "./sendVerificationEmail.js";

function trimEmail(value) {
  if (typeof value !== "string") {
    return null;
  }
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * Avoid duplicate sessions when Zapier double-fires or cron overlaps webhooks.
 * Stripe metadata.order_id is set on every session this app creates.
 */
export async function orderHasNonCanceledIdentitySession(stripe, orderId) {
  const since = Math.floor(Date.now() / 1000) - 48 * 60 * 60;
  const list = await stripe.identity.verificationSessions.list({
    limit: 100,
    created: { gte: since },
  });
  for (const s of list.data) {
    if (s.metadata?.order_id === orderId && s.status !== "canceled") {
      return true;
    }
  }
  return false;
}

/**
 * @param {{ orderId: string, customerId: string, sourceEvent: string | null }} args
 * @returns {Promise<object>} outcome for HTTP mapping or batch logs
 */
export async function runIdentityFlowForOrder({
  orderId,
  customerId,
  sourceEvent,
}) {
  const BOOQABLE_BASE_URL = process.env.BOOQABLE_BASE_URL;
  const apiKey = process.env.BOOQABLE_API_KEY;
  if (!BOOQABLE_BASE_URL || !apiKey) {
    return {
      outcome: "error",
      httpStatus: 500,
      body: {
        error: "BOOQABLE_BASE_URL or BOOQABLE_API_KEY not configured",
      },
    };
  }

  const customerRes = await fetch(
    `${BOOQABLE_BASE_URL.replace(/\/$/, "")}/api/4/customers/${customerId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!customerRes.ok) {
    return {
      outcome: "error",
      httpStatus: customerRes.status,
      body: {
        error: "Failed to fetch customer from Booqable",
        status: customerRes.status,
        customerId,
      },
    };
  }

  const customerData = await customerRes.json();
  const customer = customerData.data?.attributes;
  if (!customer) {
    return {
      outcome: "error",
      httpStatus: 500,
      body: {
        error: "Invalid customer data: expected JSON:API data.attributes",
        customerData,
      },
    };
  }

  const customerEmail = trimEmail(customer.email);
  if (!customerEmail) {
    return {
      outcome: "error",
      httpStatus: 400,
      body: {
        error: "Customer has no email in Booqable (required for Resend).",
        customerId,
      },
    };
  }

  const identityVerifiedStatus = customer.properties?.identity_verified;
  if (identityVerifiedStatus === "Verified") {
    return {
      outcome: "skipped",
      httpStatus: 200,
      body: {
        ok: true,
        skipped: true,
        reason: "Customer already verified",
        customerId,
        orderId,
      },
    };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return {
      outcome: "error",
      httpStatus: 500,
      body: { error: "STRIPE_SECRET_KEY not configured" },
    };
  }

  const stripe = new Stripe(stripeKey);

  if (await orderHasNonCanceledIdentitySession(stripe, orderId)) {
    return {
      outcome: "skipped",
      httpStatus: 200,
      body: {
        ok: true,
        skipped: true,
        reason: "identity_session_already_exists_for_order",
        customerId,
        orderId,
      },
    };
  }

  const flowId = process.env.STRIPE_IDENTITY_FLOW_ID;
  const session = await stripe.identity.verificationSessions.create(
    flowId
      ? {
          verification_flow: flowId,
          metadata: {
            customer_id: customerId,
            order_id: orderId,
            customer_email: customerEmail,
          },
        }
      : {
          type: "document",
          metadata: {
            customer_id: customerId,
            order_id: orderId,
            customer_email: customerEmail,
          },
          options: {
            document: {
              require_id_number: true,
              require_live_capture: true,
            },
          },
        }
  );

  const updateRes = await fetch(
    `${BOOQABLE_BASE_URL.replace(/\/$/, "")}/api/4/customers/${customerId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "customers",
          id: customerId,
          attributes: {
            properties_attributes: [
              { identifier: "identity_verified", value: "Unverified" },
            ],
          },
        },
      }),
    }
  );

  if (!updateRes.ok) {
    const text = await updateRes.text();
    console.error("Failed to update customer in Booqable:", text);
    return {
      outcome: "error",
      httpStatus: 502,
      body: {
        error: "Booqable customer update failed",
        status: updateRes.status,
        customerId,
        details: text,
      },
    };
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
        verificationUrl: session.url,
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

  return {
    outcome: "success",
    httpStatus: 200,
    body: {
      ok: true,
      createdVerificationSession: true,
      customerId,
      orderId,
      booqableWebhookEvent: sourceEvent,
      verificationUrl: session.url,
      emailSent,
      resendConfigured,
      ...(emailError && { emailError }),
    },
  };
}
