
## Goal (what will be true when we’re done)
On the guided ordering page (`/projects`), when the user clicks **Proceed to Checkout**, the app will:
1) set the rental start/stop dates for the embedded Booqable cart module, and  
2) add the selected items + quantities into the **on-page Booqable cart widget**,  
with **no redirects**, **no separate pages**, and **no toast notifications**.  
The only “success UI” will be that the widget’s cart contents + dates actually change.

---

## What’s happening now (root-cause findings from your code + docs)
### 1) The current “click hidden `.booqable-product-button` placeholders” approach can’t work reliably yet
Your `useBooqableCart` tries to:
- add `starts_at/stops_at` to the URL,
- refresh Booqable,
- click `.booqable-product-button[data-id="..."]` elements.

However, your database-driven items (`section_items.booqable_product_id`) are **slugs** like `angle-grinder-4-1-2`, not UUIDs:
- Confirmed via query: `section_items.booqable_product_id` values are slugs.

Booqable embed buttons (per Booqable help docs) are meant to be copied as “Embed details” HTML from Booqable admin. Those embeds often rely on **exact IDs/attributes** (commonly a product group UUID / internal id), not necessarily your slug. If `data-id` is wrong, Booqable may still “render something” or your code may “think it clicked”, but the actual cart won’t change.

### 2) False-positive “success”
`CheckoutSummary.tsx` still displays success states and toasts based on our own bookkeeping (`itemsAdded`) rather than a definitive Booqable source-of-truth (cart contents).

### 3) “Buttons are not showing and should not be”
Currently `EquipmentItem.tsx` renders visible placeholders right next to quantity controls:
```tsx
{item.booqableId && (
  <div className="booqable-product-button" data-id={item.booqableId}></div>
)}
```
That directly conflicts with your UX requirement. We need to keep embeds available to Booqable, but not visible in the guided UI.

---

## Documentation we will follow (key takeaways)
From Booqable Help Center (“How to embed products on an existing website” / Shopify embed articles):
- Booqable expects you to use the **exact embed HTML** (“Embed details”) for the “product button”.
- That embed includes the correct internal references for the product and is what the Booqable script scans for.

From Booqable checkout scripts framework docs:
- `Booqable._defer(...)` exists and is a safe way to wait up to 10 seconds for conditions before executing.
- `Booqable.on('page-change', ...)` and `Booqable.trigger('page-change')` patterns are consistent with our current “refresh” approach.

Net: We should stop guessing and instead (a) resolve the correct product identifier and (b) verify success against Booqable’s cart data/state, not DOM text.

---

## Implementation approach (high-level)
### A) Make cart sync deterministic by resolving *correct Booqable IDs* before clicking
We’ll add a “Booqable ID resolution” layer:
1) Fetch product groups from our existing backend function `booqable` (`action: 'get-products'`) which returns:
   - `booqableId` (UUID) and `slug`
2) Build a map: `slug -> booqableId(UUID)`
3) When building the hidden embed placeholders used for cart sync, use:
   - `data-id={resolvedUUID}` (preferred)
   - If we can’t resolve, optionally fall back to slug (but we’ll treat it as “not eligible for online checkout”)

This aligns your DB (slugs) with what Booqable embed likely needs (UUIDs).

### B) Stop relying on “clicking a placeholder div”; ensure Booqable has converted the embed into a real clickable element first
We’ll tighten the click strategy:
- Render hidden placeholders in a dedicated container (not `sr-only`, which can cause odd layout/visibility side-effects). Instead we’ll use a “visually hidden but measurable” style:
  - position off-screen, 1px size, opacity 0, pointer-events enabled (or disable pointer-events but click programmatically on the injected child).
- Wait until each placeholder contains an injected interactive element (button/link) or until `window.Booqable` signals ready via `_defer`.

If the embed never transforms, we will fail with a clear inline error (no toast) indicating “Booqable embed did not initialize product buttons”.

### C) Verify success using Booqable’s cart data (source of truth), not our own counters
Instead of “cart empty text” heuristics, we’ll use:
- `window.Booqable?.cartData?.items` (documented as available in checkout scripts context; it’s also commonly present in shop embeds)
- Before clicks: capture `prevCount` / `prevSignature`
- After clicks + refresh: wait until cartData changes (items length or item quantities)

If cartData is not available in the embed context, we’ll fall back to a stronger DOM-based check:
- look for item rows/count inside the widget container (not global page text search)

### D) No toasts, no redirects; inline state only
We will remove `useToast()` usage in `CheckoutSummary.tsx` for the checkout button.
Instead:
- show inline “Syncing cart…” state while running
- show inline error with a Retry button if sync fails
- show inline success only when the widget cart truly changed

### E) Ensure product buttons are never shown in the guided ordering UI
We’ll remove (or hide) the inline button in `EquipmentItem.tsx` entirely.
Instead we’ll render a single hidden “Booqable embeds staging area” at the bottom of the page that includes only the items we might need for syncing.

That preserves your guided UI while still giving Booqable DOM anchors to bind to.

---

## Concrete file-level plan (what will change)
### 1) `src/hooks/useBooqableCart.ts` (refactor into a reliable cart sync engine)
- Add:
  - `useBooqableIdMap()` or internal resolver that fetches product groups and maps slug -> UUID.
  - `waitForBooqableReady()` that uses:
    - `window.Booqable` + optional `Booqable._defer`
    - or detection that embeds have been transformed (child button exists)
  - `getCartSnapshot()`:
    - Prefer `window.Booqable.cartData` if present.
    - Else query widget DOM for item count rows.
- Change `addToCart(...)` flow to:
  1) resolve IDs for all selected items
  2) set dates in URL (as now)
  3) refresh/trigger page-change
  4) wait until each embed is transformed into a clickable element
  5) click the real injected button(s) with correct quantities
  6) refresh
  7) wait until cart snapshot changes
  8) return success only if changed

### 2) `src/components/CheckoutSummary.tsx` (remove toast usage; provide inline status)
- Remove `useToast` and all `toast(...)` calls.
- Replace with:
  - inline validation messages (“Start date required”, “No online-bookable items”)
  - inline cart-sync status + retry button
- Ensure the button label reflects on-page behavior (“Syncing cart…” not “Opening Cart…”).

### 3) `src/components/EquipmentItem.tsx` (remove visible Booqable embed)
- Remove the on-row `booqable-product-button` element so nothing “Booqable-ish” appears in the guided UI.

### 4) `src/components/TileOrderingFlow.tsx` or a dedicated component (add hidden embed staging area)
- Create a single hidden container that renders required Booqable product-button placeholders for:
  - all currently selected rental items (or potentially all rentals to avoid rerender timing issues)
- These placeholders will use **resolved UUID ids**, not slugs.

This ensures the placeholders exist even when the user navigates to the checkout summary view (and avoids the “buttons not present” / timing race).

---

## Debug/verification steps (built into the plan)
We will add a temporary “debug mode” (disabled by default) that logs:
- whether `window.Booqable` exists
- whether `cartData` exists
- for each selected item:
  - slug
  - resolved UUID
  - whether the placeholder was transformed (child button found)
- cart snapshot before/after

This will be console-only (no toasts, no UI clutter) and removable once stable.

---

## Acceptance criteria (how you’ll confirm it works)
1) Go through guided ordering, select 2–3 rental items with quantities > 1, select dates.
2) Click **Proceed to Checkout**.
3) The embedded Booqable cart widget (visible on-page) updates:
   - items appear with correct quantities
   - rental dates match the chosen range
4) No toast notifications appear.
5) No navigation occurs and no new tabs/windows open.

---

## Risks & mitigations
- **Risk:** Booqable embed requires the exact embed HTML (not just `.booqable-product-button` + `data-id`).  
  **Mitigation:** If our minimal markup still doesn’t transform, we’ll switch to rendering the exact embed snippet format Booqable expects. That may require one-time capture of the embed HTML pattern from Booqable (for a single product) so we can replicate it programmatically for all items.

- **Risk:** `Booqable.cartData` may not be present in this embed context.  
  **Mitigation:** Implement a robust widget DOM-based “cart changed” detector.

---

## Sequencing
1) Implement ID resolution (slug -> UUID) + staging container rendering using UUIDs
2) Remove visible embeds from item rows
3) Refactor `useBooqableCart` to wait for embed transform + verify via cart snapshot
4) Remove all toast notifications and replace with inline status/errors
5) End-to-end test on `/projects` with multiple items and quantities

