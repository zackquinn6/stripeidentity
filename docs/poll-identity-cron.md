# Polling reserved orders (no “Webhooks by Zapier”)

Booqable does not let you register an arbitrary public URL. **Zapier’s “Webhooks by Zapier” action is a paid add-on**; the free path is either:

- **Zapier “Webhooks” action** — often not the same product; check your plan, **or**
- **This cron route** — Vercel (or any monitor) calls your deployment on a schedule; the handler reads **recent reserved orders** from the Booqable API and runs the same Stripe + Resend + Booqable logic as `POST /api/booqable-order-created`.

There is **no separate Booqable → Vercel “push”** unless you use an automation app or Booqable exposes a hook you can afford.

---

## Endpoint

`GET` or `POST` **`/api/cron/poll-orders-identity`**

**Auth (required):** header exactly:

`Authorization: Bearer <CRON_SECRET>`

Set **`CRON_SECRET`** in Vercel project env. [Vercel Cron](https://vercel.com/docs/cron-jobs) automatically sends this header when it invokes the job. Cron scheduling may require a **paid Vercel** plan on some accounts; if `vercel.json` crons are not available, rely entirely on an external scheduler calling the same URL.

**Also required:**

| Env | Meaning |
|-----|---------|
| `ORDER_POLL_LOOKBACK_MINUTES` | Positive number. Only orders with `updated_at` (or `created_at`) **within this many minutes** and status **`reserved`** are considered. Example: `15` |

Same Booqable/Stripe/Resend vars as `.env.example` for the main app.

---

## Schedule and the “≤ 30 seconds” email goal

- **Built-in Vercel Cron** (this repo’s `vercel.json`) runs at most **once per minute** (`* * * * *`). Average delay to email is on the order of **half a minute**; worst case near **one minute**.
- For **~30 second** worst-case, call the **same URL** twice per minute from an external scheduler (offset by 30s), e.g. [cron-job.org](https://cron-job.org), GitHub Actions, UptimeRobot, etc., each request using the same `Authorization: Bearer <CRON_SECRET>` header. **Disable the duplicate Vercel cron** in `vercel.json` if you do that, so you do not double-run every minute.

Example (run every 30s from your own runner):

```bash
curl -sS -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://<project>.vercel.app/api/cron/poll-orders-identity"
```

---

## Behaviour

1. `GET /api/4/orders?sort=-updated_at&include=customer` (page size 50).
2. Keep orders whose `attributes.status` is **`reserved`** and whose timestamp is inside the lookback window.
3. For each `(orderId, customerId)`, run the shared identity pipeline.
4. **Idempotency:** if a Stripe Identity session already exists for this `order_id` in metadata (non-`canceled`), the order is skipped so cron + Zapier do not create duplicates.

---

## Stripe “verified” → Booqable `Verified`

Unchanged: configure Stripe webhooks to **`/api/stripe-webhook`** as before.
