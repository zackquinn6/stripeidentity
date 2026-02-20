export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { order_id, customer_id, customer_email } = req.body;

  if (!order_id || !customer_id || !customer_email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // TEMP: return success so you can test
  return res.status(200).json({
    ok: true,
    received: { order_id, customer_id, customer_email }
  });
}
