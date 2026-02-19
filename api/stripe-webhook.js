import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false
  }
};

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const rawBody = await buffer(req);
  const signature = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle verification completion
  if (event.type === 'identity.verification_session.verified') {
    const session = event.data.object;

    await fetch(`https://api.booqable.com/api/1/orders/${session.metadata.booqable_order_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BOOQABLE_API_KEY}`
      },
      body: JSON.stringify({
        order: {
          custom_fields: {
            identity_verified: true,
            identity_session_id: session.id
          }
        }
      })
    });
  }

  return res.json({ received: true });
}
