
# Booqable API Integration Plan

## Overview
This plan integrates your Lovable app with Booqable's REST API to:
1. **Fetch products from Booqable inventory** to populate equipment/materials lists dynamically
2. **Manage cart/order state locally** in the Lovable ordering flow
3. **Create and submit orders to Booqable** for checkout when users are ready

---

## Architecture

```text
+------------------+     +---------------------+     +------------------+
|   Lovable App    | --> | Supabase Edge       | --> |  Booqable API    |
|   (React/UI)     |     | Functions (Proxy)   |     |  (v1 REST)       |
+------------------+     +---------------------+     +------------------+
        |                         |
        |  1. Fetch products      |
        |  2. Create order        |
        |  3. Add lines to order  |
        |  4. Reserve order       |
        +-------------------------+
```

**Why an Edge Function?**
- Booqable API requires an API key that must stay secret
- Edge functions keep credentials server-side, not exposed in browser code
- Handles CORS and error normalization

---

## Implementation Steps

### Step 1: Store Booqable API Key as Secret
Add the Booqable API key to Lovable Cloud secrets so the edge function can access it securely.

**What you'll need:**
- Your Booqable API key (found in Booqable → Account Settings → API Keys)
- Your Booqable company slug (the `xxxxx` in `xxxxx.booqable.com`)

---

### Step 2: Create Booqable Edge Function

Create a new Supabase edge function at `supabase/functions/booqable/index.ts` that:

**Endpoints it will handle:**
| Action | Booqable API Call |
|--------|------------------|
| `GET /products` | `GET /api/1/product_groups` |
| `POST /orders` | `POST /api/1/orders` (create) |
| `POST /orders/:id/lines` | `POST /api/1/orders/:id/lines` |
| `POST /orders/:id/book` | `POST /api/1/orders/:id/book` |
| `POST /orders/:id/reserve` | `POST /api/1/orders/:id/reserve` |

**Key Features:**
- Proxies requests to Booqable with authentication
- Maps product data to your `RentalItem` type
- Returns normalized error messages

---

### Step 3: Create React Hook for Booqable Data

Create `src/hooks/useBooqableProducts.ts`:
- Fetches product groups from the edge function
- Maps Booqable products to your `RentalItem` interface
- Caches data with React Query for performance
- Falls back to static data if API fails

**Mapping Booqable fields to RentalItem:**
```text
Booqable Product Group → RentalItem
-----------------------------------------
id                     → booqableId
name                   → name  
base_price_in_cents    → dailyRate (÷100)
description            → description
photo_url              → imageUrl
stock_count            → (availability info)
```

---

### Step 4: Update TileOrderingFlow to Use Live Data

Modify `TileOrderingFlow.tsx`:
- Replace static `equipmentCategories` import with `useBooqableProducts()` hook
- Add loading states while fetching products
- Show error state with retry option if fetch fails
- Keep static data as fallback

---

### Step 5: Create Order Submission Logic

Create `src/hooks/useBooqableOrder.ts`:
- Manages local cart state (selected items + quantities)
- On checkout:
  1. Creates a new order in Booqable with dates
  2. Adds each selected product as a line item
  3. Books the items to reserve inventory
  4. Reserves the order
  5. Redirects to Booqable checkout or returns order number

---

### Step 6: Update CheckoutSummary Component

Modify `CheckoutSummary.tsx`:
- Add "Proceed to Checkout" button that triggers order submission
- Show loading state during order creation
- On success: redirect to Booqable checkout page or show confirmation
- Handle errors gracefully with user-friendly messages

---

## Data Flow Summary

1. **Page Load**: `useBooqableProducts` fetches products from edge function
2. **User Selects Items**: Local state tracks quantities
3. **User Clicks Checkout**: 
   - Edge function creates Booqable order
   - Adds line items for each selected product
   - Reserves the order
4. **Redirect to Booqable**: User completes payment on Booqable's hosted checkout

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/booqable/index.ts` | API proxy edge function |
| `supabase/config.toml` | Edge function configuration |
| `src/hooks/useBooqableProducts.ts` | Fetch and cache products |
| `src/hooks/useBooqableOrder.ts` | Order creation logic |
| `src/lib/booqable.ts` | Type definitions and API helpers |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/TileOrderingFlow.tsx` | Use live product data, pass cart to checkout |
| `src/components/CheckoutSummary.tsx` | Add order submission, redirect to Booqable |
| `src/types/rental.ts` | Add Booqable-specific fields |

---

## Technical Details

### Edge Function Structure
```text
supabase/functions/booqable/index.ts
├── Handle CORS preflight
├── Parse action from request body
├── Switch on action type:
│   ├── get-products → GET /product_groups
│   ├── create-order → POST /orders
│   ├── add-line → POST /orders/:id/lines
│   ├── book-order → POST /orders/:id/book
│   └── reserve-order → POST /orders/:id/reserve
└── Return normalized response
```

### Booqable Order Workflow
1. **Create Order**: `POST /orders` with `starts_at`, `stops_at`, `customer_id` (optional)
2. **Add Lines**: `POST /orders/:id/lines` with product ID and quantity for each item
3. **Book Items**: `POST /orders/:id/book` to reserve inventory
4. **Reserve Order**: `POST /orders/:id/reserve` to finalize reservation

### Error Handling
- Network errors: Show retry button
- API errors: Display Booqable's error message
- Validation errors: Highlight problematic fields
- Availability errors: Show which items are unavailable

---

## Required Secrets

Before implementation, you'll need to add:
1. **BOOQABLE_API_KEY**: Your Booqable API key
2. **BOOQABLE_COMPANY_SLUG**: Your company slug (e.g., `feeebb8b-2583-4689-b2f6-d488f8220b65`)

---

## Fallback Strategy

If the Booqable API is unavailable:
- Show cached/static product data
- Display message: "Live inventory temporarily unavailable"
- Allow users to submit inquiry form instead of direct checkout
