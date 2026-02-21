import { Resend } from "resend";

export async function sendVerificationEmail({ to, verificationUrl }) {
  if (!to || !verificationUrl) {
    throw new Error("Missing required fields: to, verificationUrl");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Replace with your actual template ID from Resend
  const TEMPLATE_ID = "your-template-id-here";

  return resend.emails.send({
    from: "Toolio Rentals <verify@yourdomain.com>",
    to,
    subject: "Complete Your Toolio Identity Verification",
    template_id: TEMPLATE_ID,
    // These variables map directly to your Resend template fields
    // Example: {{ verification_url }} inside your template
    //          {{ customer_email }} if you added that field
    // Add or remove fields based on your template structure
    variables: {
      verification_url: verificationUrl,
      customer_email: to
    }
  });
}
