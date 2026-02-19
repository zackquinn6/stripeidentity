import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const order = req.body.order;

  // 1. Create Stripe Identity session
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    verification_flow: process.env.STRIPE_FLOW_ID,
    metadata: {
      booqable_order_id: order.id,
      booqable_customer_id: order.customer_id
    }
  });

  // 2. Save verification URL to Booqable
  await fetch(`https://api.booqable.com/api/1/orders/${order.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BOOQABLE_API_KEY}`
    },
    body: JSON.stringify({
      order: {
        custom_fields: {
          identity_verification_url: session.url,
          identity_verified: false
        }
      }
    })
  });

  return res.status(200).json({ status: 'verification_session_created' });
}
