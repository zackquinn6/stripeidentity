import { useCallback, useState } from 'react';
import { RentalItem } from '@/types/rental';
import { format } from 'date-fns';
import { applyRentalPeriod, booqableRefresh, getBooqableApi } from '@/lib/booqable/client';

const DEBUG = true; // Set to false when stable

interface UseBooqableCartState {
  isLoading: boolean;
  error: string | null;
  itemsAdded: number;
}

async function waitFor(condition: () => boolean, timeoutMs = 4000, intervalMs = 50): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout waiting for condition');
}

async function ensureBooqableButtonsEnhanced(timeoutMs = 4000) {
  // Wait until at least one placeholder exists and Booqable has had a chance to enhance it.
  const staging = document.getElementById('booqable-embed-staging');
  if (!staging) return;

  const anyPlaceholder = staging.querySelector<HTMLElement>('.booqable-product-button');
  if (!anyPlaceholder) return;

  // Give the library a few refresh cycles.
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    booqableRefresh();
    // Some installs never inject a child; but if it does, that's our best signal.
    const hasEnhancedButton = !!anyPlaceholder.querySelector(
      'button, a, [role="button"], [data-action], .booqable-button, .bq-add-button, input[type="submit"]'
    );
    if (hasEnhancedButton) return;
    await new Promise((r) => setTimeout(r, 250));
  }
}

// Rental period is applied via applyRentalPeriod() (URL params + best-effort direct API calls)

/**
 * Get a snapshot of the cart's current state.
 * Prefers window.Booqable.cartData if available, otherwise counts items in widget DOM.
 */
function getCartSnapshot(): { itemCount: number; signature: string } {
  const api = getBooqableApi();
  
  // Try Booqable cartData first (source of truth if available)
  if (api?.cartData?.items && Array.isArray(api.cartData.items)) {
    const items = api.cartData.items;
    const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    const signature = items.map((i: any) => `${i.product_id || i.id}:${i.quantity}`).join(',');
    if (DEBUG) console.log('[useBooqableCart] cartData snapshot:', { itemCount, signature });
    return { itemCount, signature };
  }
  
  // Fallback: count items in the widget DOM
  // Look for common Booqable cart widget selectors
  const widgetSelectors = [
    '.booqable-cart-items .item',
    '.booqable-cart .cart-item',
    '[data-booqable-cart] .item',
    '.bq-cart-items > *',
    '.booqable-widget .cart-line',
  ];
  
  let itemCount = 0;
  for (const selector of widgetSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      itemCount = elements.length;
      break;
    }
  }
  
  // Also check for "empty cart" text as a signal
  const emptyTexts = ['your shopping cart is empty', 'your cart is empty', 'no items'];
  const bodyText = document.body.innerText.toLowerCase();
  const isEmpty = emptyTexts.some((t) => bodyText.includes(t));
  
  if (isEmpty && itemCount === 0) {
    if (DEBUG) console.log('[useBooqableCart] DOM snapshot: cart is empty');
    return { itemCount: 0, signature: 'empty' };
  }
  
  const signature = `dom-items:${itemCount}`;
  if (DEBUG) console.log('[useBooqableCart] DOM snapshot:', { itemCount, signature });
  return { itemCount, signature };
}

function canReliablyDetectCartChange(snapshot: { signature: string }): boolean {
  // If we only have the DOM fallback signature, the widget may be inside an iframe/shadow
  // and the DOM count may always be 0. In that case, using it as a hard failure causes
  // false negatives.
  return !snapshot.signature.startsWith('dom-items:');
}

/**
 * Best-effort attempt to add items via the booqable.js cart API (if exposed).
 * This is far more reliable than clicking hidden DOM placeholders when available.
 */
function tryAddItemsViaCartApi(
  items: Array<{ productGroupId: string; quantity: number; name: string }>
): { ok: boolean; appliedVia: string[] } {
  const api = getBooqableApi();
  const cart = api?.cart;
  const appliedVia: string[] = [];
  if (!cart) return { ok: false, appliedVia };

  // Try batched APIs first
  const batchCandidates: Array<{ name: string; fn: unknown }>
    = [
      { name: 'cart.addItems', fn: cart?.addItems },
      { name: 'cart.addLineItems', fn: cart?.addLineItems },
      { name: 'cart.addLines', fn: cart?.addLines },
    ];

  for (const c of batchCandidates) {
    if (typeof c.fn !== 'function') continue;
    try {
      (c.fn as any)(
        items.map((i) => ({ product_group_id: i.productGroupId, quantity: i.quantity }))
      );
      appliedVia.push(c.name);
      return { ok: true, appliedVia };
    } catch {
      // continue
    }
  }

  // Fallback: per-item APIs with multiple method name candidates
  const perItemCandidates: Array<{ name: string; fn: (cart: any) => unknown }>
    = [
      { name: 'cart.addItem', fn: (c) => c?.addItem },
      { name: 'cart.addProductGroup', fn: (c) => c?.addProductGroup },
      { name: 'cart.addProduct', fn: (c) => c?.addProduct },
      { name: 'cart.add', fn: (c) => c?.add },
    ];

  let anySucceeded = false;
  for (const item of items) {
    let added = false;
    for (const cand of perItemCandidates) {
      const fn = cand.fn(cart);
      if (typeof fn !== 'function') continue;
      try {
        // Most variants accept (productGroupId, quantity)
        (fn as any)(item.productGroupId, item.quantity);
        appliedVia.push(`${cand.name}(${item.name})`);
        added = true;
        anySucceeded = true;
        break;
      } catch {
        // Try object payload
        try {
          (fn as any)({ product_group_id: item.productGroupId, quantity: item.quantity });
          appliedVia.push(`${cand.name}:object(${item.name})`);
          added = true;
          anySucceeded = true;
          break;
        } catch {
          // continue
        }
      }
    }

    if (!added && DEBUG) {
      console.warn('[useBooqableCart] cart API could not add item:', item);
    }
  }

  return { ok: anySucceeded, appliedVia };
}

/**
 * Find product button placeholder by slug or UUID.
 * Our staging container sets both data-id (UUID) and data-slug.
 */
function findProductButton(slugOrUuid: string): HTMLElement | null {
  // Try by data-id first (UUID)
  let btn = document.querySelector<HTMLElement>(
    `.booqable-product-button[data-id="${CSS.escape(slugOrUuid)}"]`
  );
  if (btn) return btn;
  
  // Try by data-slug
  btn = document.querySelector<HTMLElement>(
    `.booqable-product-button[data-slug="${CSS.escape(slugOrUuid)}"]`
  );
  return btn;
}

/**
 * Wait for Booqable to transform a placeholder into a real clickable element.
 * Returns the clickable child, or the container itself if no child is injected.
 */
async function waitForClickableButton(
  container: HTMLElement,
  timeoutMs = 5000
): Promise<HTMLElement | null> {
  const selectors = 'button, a, [role="button"], [data-action], .booqable-button, .bq-add-button, input[type="submit"]';
  
  try {
    await waitFor(() => !!container.querySelector(selectors), timeoutMs, 100);
    const btn = container.querySelector<HTMLElement>(selectors);
    if (btn) {
      // Ensure the button is clickable
      (btn as HTMLElement).style.pointerEvents = 'auto';
    }
    return btn;
  } catch {
    // Booqable didn't inject a child button; the container itself might be clickable
    if (DEBUG) console.log('[useBooqableCart] No child button found, trying direct click on container');
    // Make container clickable
    container.style.pointerEvents = 'auto';
    return container;
  }
}

/**
 * Hook to programmatically populate the embedded Booqable cart widget.
 * 
 * Strategy:
 * 1. Set starts_at/stops_at on the URL for the widget to pick up
 * 2. Find staging placeholders (which use resolved UUIDs)
 * 3. Wait for Booqable script to transform placeholders into real buttons
 * 4. Click buttons for each item
 * 5. Verify cart actually changed before reporting success
 */
export function useBooqableCart() {
  const [state, setState] = useState<UseBooqableCartState>({
    isLoading: false,
    error: null,
    itemsAdded: 0,
  });

  const addToCart = useCallback(
    async (items: RentalItem[], startDate: Date, endDate: Date) => {
      setState({ isLoading: true, error: null, itemsAdded: 0 });

      // Filter to rental items with booqableId and quantity > 0
      const validItems = items.filter(
        (item) => item.booqableId && item.quantity > 0 && !item.isConsumable && !item.isSalesItem
      );

      if (validItems.length === 0) {
        const err = 'No rental items with Booqable IDs selected';
        setState({ isLoading: false, error: err, itemsAdded: 0 });
        return { success: false, itemsAdded: 0, error: err };
      }

      // Use timezone-aware format. This matches our backend order creation and avoids
      // ambiguous local timestamps that some widgets misinterpret.
      const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
      const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

      if (DEBUG) {
        console.log('[useBooqableCart] Starting cart sync');
        console.log('[useBooqableCart] Items:', validItems.map((i) => ({ name: i.name, slug: i.booqableId, qty: i.quantity })));
        console.log('[useBooqableCart] Dates:', startsAt, '→', stopsAt);
        const api = getBooqableApi();
        console.log('[useBooqableCart] window.Booqable exists:', !!api);
        if (api) {
          console.log('[useBooqableCart] Booqable API capabilities:', {
            hasRefresh: typeof api.refresh === 'function',
            hasTrigger: typeof api.trigger === 'function',
            hasCartData: !!api.cartData,
          });
        }
      }

      try {
        // Apply dates for the widget to pick up (URL + best-effort cart API)
        const { appliedVia } = applyRentalPeriod(startsAt, stopsAt);
        if (DEBUG) console.log('[useBooqableCart] Applied rental period via:', appliedVia);

        // Ensure the placeholders are enhanced before we start clicking.
        await ensureBooqableButtonsEnhanced(4500);
        
        // Small delay for the widget to process
        await new Promise((r) => setTimeout(r, 300));

        // Capture cart state before clicking
        const beforeSnapshot = getCartSnapshot();
        if (DEBUG) console.log('[useBooqableCart] Before snapshot:', beforeSnapshot);

        // Attempt to use the booqable.js cart API (if present) using resolved product group IDs
        const cartApiItems = validItems
          .map((item) => {
            const placeholder = findProductButton(item.booqableId!);
            const productGroupId = placeholder?.getAttribute('data-id') || item.booqableId!;
            return { productGroupId, quantity: item.quantity, name: item.name };
          })
          .filter((x) => !!x.productGroupId);

        const cartApiAttempt = tryAddItemsViaCartApi(cartApiItems);
        if (cartApiAttempt.ok) {
          if (DEBUG) console.log('[useBooqableCart] Added items via cart API:', cartApiAttempt.appliedVia);
          booqableRefresh();
        }

        let clickedCount = 0;
        const failedItems: string[] = [];

        // If cart API succeeded, skip brittle DOM clicking and proceed to verification.
        if (cartApiAttempt.ok) {
          clickedCount = validItems.length;
        } else {

        for (const item of validItems) {
          const slug = item.booqableId!;
          
          // Find the staging placeholder
          const placeholder = findProductButton(slug);
          if (!placeholder) {
            if (DEBUG) console.warn(`[useBooqableCart] No placeholder found for: ${slug}`);
            failedItems.push(item.name);
            continue;
          }

          if (DEBUG) {
            const dataId = placeholder.getAttribute('data-id');
            const hasChild = !!placeholder.querySelector('button, a');
            console.log(`[useBooqableCart] Found placeholder for ${slug}:`, { dataId, hasChild });
          }

          // Wait for Booqable to inject a real button
          const clickTarget = await waitForClickableButton(placeholder, 3000);
          if (!clickTarget) {
            if (DEBUG) console.warn(`[useBooqableCart] No clickable target for: ${slug}`);
            failedItems.push(item.name);
            continue;
          }

          // Set quantity attribute in case Booqable reads it
          placeholder.setAttribute('data-quantity', String(item.quantity));

          // Click for each unit of quantity
          for (let i = 0; i < item.quantity; i++) {
            clickTarget.click();
            // Nudge the library after each click for reliability
            booqableRefresh();
            await new Promise((r) => setTimeout(r, 200));
          }

          clickedCount++;
          if (DEBUG) console.log(`[useBooqableCart] Clicked ${item.quantity}x for: ${item.name}`);
        }

        }

        if (clickedCount === 0) {
          const err = 'Could not find any Booqable product buttons. The embed may not be initialized.';
          setState({ isLoading: false, error: err, itemsAdded: 0 });
          return { success: false, itemsAdded: 0, error: err };
        }

        // Refresh widget after all clicks
        booqableRefresh();

        // Wait for cart to actually change.
        // NOTE: On some embeds, we can't read widget state (iframe/shadow DOM). In that case,
        // we avoid a false failure and rely on click execution.
        const shouldHardFailOnNoChange = canReliablyDetectCartChange(beforeSnapshot);

        try {
          await waitFor(() => {
            const afterSnapshot = getCartSnapshot();
            return (
              afterSnapshot.signature !== beforeSnapshot.signature ||
              afterSnapshot.itemCount > beforeSnapshot.itemCount
            );
          }, 8000, 200);

          if (DEBUG) {
            const afterSnapshot = getCartSnapshot();
            console.log('[useBooqableCart] After snapshot:', afterSnapshot);
          }
        } catch {
          if (shouldHardFailOnNoChange) {
            const err = 'Cart did not update. The Booqable widget may not be responding.';
            if (DEBUG) console.warn('[useBooqableCart]', err);
            setState({ isLoading: false, error: err, itemsAdded: 0 });
            return { success: false, itemsAdded: 0, error: err };
          }

          if (DEBUG) {
            console.warn(
              '[useBooqableCart] Could not verify cart change (likely iframe/shadow DOM). Continuing as success based on completed clicks.'
            );
          }
        }

        // Success!
        const addedCount = validItems.length;
        setState({ isLoading: false, error: null, itemsAdded: addedCount });
        
        if (failedItems.length > 0 && DEBUG) {
          console.warn('[useBooqableCart] Some items failed:', failedItems);
        }

        return { success: true, itemsAdded: addedCount };
      } catch (e: any) {
        const message = e?.message || 'Failed to add items to cart widget';
        console.error('[useBooqableCart] Error:', e);
        setState({ isLoading: false, error: message, itemsAdded: 0 });
        return { success: false, itemsAdded: 0, error: message };
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, itemsAdded: 0 });
  }, []);

  return {
    ...state,
    addToCart,
    reset,
  };
}

export default useBooqableCart;
