import { Resend } from "resend";

export async function sendVerificationEmail({ to, verificationUrl }) {
  if (!to || !verificationUrl) {
    throw new Error("Missing required fields: to, verificationUrl");
  }
  if (!process.env.RESEND_FROM) {
    throw new Error("RESEND_FROM is not set");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const TEMPLATE_ID = "verification-email";

  return resend.emails.send({
    from: process.env.RESEND_FROM,
    to,
    subject: "Complete Your Toolio Identity Verification",
    template: {
      id: TEMPLATE_ID,
      variables: {
        verification_url: verificationUrl,
        customer_email: to
      }
    }
  });
}
