# Zapier → Vercel (Stripe Identity + Resend + Booqable status)

Your Vercel route **`POST /api/booqable-order-created`** already does the full chain in one request:

1. Loads the customer from Booqable (needs email for Resend).
2. Creates a **Stripe Identity** verification session.
3. PATCHes Booqable `identity_verified` → `Unverified` (until Stripe completes).
4. Sends the verification link email via **Resend** (if `RESEND_API_KEY` and `RESEND_FROM` are set on Vercel).

You do **not** add separate Zapier steps for Stripe, Resend, or Booqable edits—only **one HTTP POST** to Vercel.

**Stripe completion → “Verified”** still comes from Booqable/Stripe via your existing **`/api/stripe-webhook`** (Stripe sends `identity.verification_session.verified`). That is unrelated to this Zap.

### Avoiding “Webhooks by Zapier” (premium)

1. **Best:** Booqable **[webhook_endpoints](https://developers.booqable.com/#webhook-endpoints-subscribe-to-webhook-events)** API — Booqable POSTs directly to Vercel when orders hit subscribed events (no Zapier). Run `node scripts/register-booqable-webhook-endpoint.mjs` from this repo if your token can create endpoints.
2. **Otherwise:** any Zapier/Make action that can **HTTP POST JSON** to Vercel (same body as below)—without using the paid “Webhooks by Zapier” app if your plan charges for it.

### Booqable native webhooks — any `order.*` delivery

Vercel accepts **any** Booqable v4 payload whose `event` starts with **`order.`** (plus JSON:API `data` of type `orders` without an `event` line). That covers draft saves, updates, reserve, started, etc. The handler always **GETs** `/api/4/orders/:id` and runs Stripe Identity **only** when Booqable reports **`status: reserved`**, so routine order edits do not create verification sessions.

**URLs that hit the same handler** (configure whichever Booqable exposes in your UI):

- `POST /api/booqable-order-created` (primary)
- `POST /api/webhook`, `POST /api/webhooks/booqable`, `POST /webhook/booqable` (rewrites in `vercel.json`)

If your Booqable token can manage `webhook_endpoints`, `scripts/register-booqable-webhook-endpoint.mjs` uses `BOOQABLE_WEBHOOK_SUBSCRIBE_ORDER_EVENTS` in `lib/booqableOrderWebhook.js` as a broad default list; you do not need to match it exactly if Booqable is already sending order webhooks elsewhere.

---

## Prerequisites (Vercel)

On the Vercel project that hosts this repo, set environment variables (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `BOOQABLE_BASE_URL` | `https://<your-company>.booqable.com` |
| `BOOQABLE_API_KEY` | Booqable API token |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_IDENTITY_FLOW_ID` | Optional; Stripe Identity flow `vf_…` |
| `RESEND_API_KEY`, `RESEND_FROM` | For verification email |
| `STRIPE_WEBHOOK_SECRET` | For `/api/stripe-webhook` only (not this Zap) |

Deploy so `https://<project>.vercel.app/api/booqable-order-created` is live.

---

## Zap overview

| Step | App | What to choose |
|------|-----|----------------|
| 1 | **Booqable** | Trigger (see below) |
| 2 | HTTP POST to Vercel | Any Zapier action that can **POST JSON** to a URL on your plan (e.g. **Webhooks by Zapier** if included, or another HTTP integration). Target: `POST /api/booqable-order-created` with the body below. |

Zapier’s Booqable app exposes triggers such as **Reserved Order**, **Updated Order**, **Started Order**, etc. It does **not** list a separate “order created” trigger in the same way Booqable’s internal lifecycle does.

- **Recommended (one clear moment):** **Reserved Order** — fires when the order is reserved (matches “order is ready to commit” and lines up with real-world checkout / admin reserve).
- **If you insist on the earliest “new order” moment:** use **Updated Order** only with a **Zapier Filter** (e.g. only when status becomes draft / new) so you do not run identity on every line-item edit. That is more brittle; **Reserved Order** is simpler.

This guide assumes **Reserved Order**.

Starter template on Zapier: [Booqable + Webhooks by Zapier](https://zapier.com/apps/booqable/integrations/webhook) — look for **“Create Webhooks by Zapier posts for new reserved orders in Booqable”** and then change the target URL and JSON to match below.

---

## Step 1 — Trigger: Booqable

1. Create a new Zap.
2. **Trigger** → search **Booqable** → connect your Booqable account (API key from Booqable).
3. Choose **Reserved Order** (or your chosen trigger).
4. Run **Test trigger** and pick a sample order so Zapier shows available fields.

Confirm the sample includes **order id** and **customer id** (names may be like `Id`, `Order ID`, `Customer Id`, etc.—use whatever Zapier shows for your account).

---

## Step 2 — Action: POST JSON to Vercel

1. **Action** → choose an HTTP POST action available on your Zapier plan → **POST** (JSON body).
2. **URL**  
   `https://<your-vercel-project>.vercel.app/api/booqable-order-created`
3. **Payload type** → **Json**.
4. **Data** — build this exact JSON shape (use Zapier’s **Insert Data** icons to map fields, do not type UUIDs by hand):

```json
{
  "order": {
    "id": "<Booqable order UUID from trigger>",
    "customer_id": "<Booqable customer UUID from trigger>"
  }
}
```

In the Zap editor, that usually means two keys under `order`:

- `id` ← map from the trigger’s order identifier field.
- `customer_id` ← map from the trigger’s customer identifier field.

If the trigger nests customer (e.g. under a `customer` object), pick the **customer’s id** field, not the email string.

5. Leave default headers unless your team requires extra auth (this endpoint is unauthenticated by design; protect the URL as a secret if needed).

6. **Test action**. You should get **HTTP 200** from Vercel with JSON containing `createdVerificationSession: true` (or `skipped: true` if the customer is already `Verified` in Booqable).

---

## Step 3 — Turn the Zap on

Publish the Zap. Each time Booqable fires the trigger, Zapier POSTs once → Vercel runs Stripe + Resend + Booqable PATCH.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| **Nothing hits Vercel** when you reserve in Booqable | Booqable only POSTs after you create a **`webhook_endpoints`** row on the **same** account (`BOOQABLE_BASE_URL`). Run `node scripts/list-booqable-webhook-endpoints.mjs` — if the list is empty or no row has your exact Vercel URL, run `node scripts/register-booqable-webhook-endpoint.mjs` with `BOOQABLE_WEBHOOK_TARGET_URL` set. The register script updates an existing endpoint URL match or creates one. |
| Vercel **Logs** show no `booqable-order-created POST` lines | Booqable is not calling your URL (wrong company subdomain, typo in URL, or **Vercel Deployment Protection** blocking Booqable’s servers). Open `GET https://<project>.vercel.app/api/booqable-order-created` in a browser — you should see JSON `ok: true`. |
| Zapier test **400** from Vercel | Body must be `{ "order": { "id", "customer_id" } }` with real Booqable UUIDs. |
| **Customer has no email** | Customer record in Booqable must have an email. |
| **Skipped: already verified** | Customer `identity_verified` is already `Verified` in Booqable. |
| Email not sent | `RESEND_API_KEY` / `RESEND_FROM` on Vercel; Resend domain verification. |
| Identity never completes to Verified | Stripe Dashboard webhook to `/api/stripe-webhook` and `STRIPE_WEBHOOK_SECRET` on Vercel. |

Local simulation without Zapier: `node scripts/trigger-booqable-webhook.mjs` (same JSON body as the Zap POST step).
