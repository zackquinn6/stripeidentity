export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse body if it's a string or ensure it's an object
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { order_id, customer_id, customer_email } = body;

    if (!order_id || !customer_id || !customer_email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // TEMP: return success so you can test
    return res.status(200).json({
      ok: true,
      received: { order_id, customer_id, customer_email }
    });
  } catch (error) {
    console.error('Error in booqable-order-created:', error);
    return res.status(500).json({ error: "Internal server error", message: error.message });
  }
}
