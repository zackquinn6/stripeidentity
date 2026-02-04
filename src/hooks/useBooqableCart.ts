import { useCallback, useState } from 'react';
import { RentalItem } from '@/types/rental';
import { format } from 'date-fns';

const DEBUG = true; // Set to false when stable

interface UseBooqableCartState {
  isLoading: boolean;
  error: string | null;
  itemsAdded: number;
}

function getBooqableApi(): any {
  return (window as any).Booqable || (window as any).booqable;
}

async function waitFor(condition: () => boolean, timeoutMs = 4000, intervalMs = 50): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout waiting for condition');
}

function booqableRefresh() {
  const api = getBooqableApi();
  if (!api) return;
  if (typeof api.refresh === 'function') api.refresh();
  if (typeof api.trigger === 'function') api.trigger('page-change');
}

function setBooqableDatesOnPage(startsAt: string, stopsAt: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('starts_at', startsAt);
  url.searchParams.set('stops_at', stopsAt);
  window.history.replaceState({}, '', url.toString());
}

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
  const selectors = 'button, a, [role="button"], [data-action], .booqable-button, .bq-add-button';
  
  try {
    await waitFor(() => !!container.querySelector(selectors), timeoutMs, 100);
    return container.querySelector<HTMLElement>(selectors);
  } catch {
    // Booqable didn't inject a child button; the container itself might be clickable
    if (DEBUG) console.log('[useBooqableCart] No child button found, using container');
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

      const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
      const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");

      if (DEBUG) {
        console.log('[useBooqableCart] Starting cart sync');
        console.log('[useBooqableCart] Items:', validItems.map((i) => ({ name: i.name, slug: i.booqableId, qty: i.quantity })));
        console.log('[useBooqableCart] Dates:', startsAt, '→', stopsAt);
        console.log('[useBooqableCart] window.Booqable exists:', !!getBooqableApi());
      }

      try {
        // Set dates on URL for the widget
        setBooqableDatesOnPage(startsAt, stopsAt);
        
        // Refresh Booqable to pick up new dates
        booqableRefresh();
        
        // Small delay for the widget to process
        await new Promise((r) => setTimeout(r, 300));

        // Capture cart state before clicking
        const beforeSnapshot = getCartSnapshot();
        if (DEBUG) console.log('[useBooqableCart] Before snapshot:', beforeSnapshot);

        let clickedCount = 0;
        const failedItems: string[] = [];

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
            await new Promise((r) => setTimeout(r, 150));
          }

          clickedCount++;
          if (DEBUG) console.log(`[useBooqableCart] Clicked ${item.quantity}x for: ${item.name}`);
        }

        if (clickedCount === 0) {
          const err = 'Could not find any Booqable product buttons. The embed may not be initialized.';
          setState({ isLoading: false, error: err, itemsAdded: 0 });
          return { success: false, itemsAdded: 0, error: err };
        }

        // Refresh widget after all clicks
        booqableRefresh();

        // Wait for cart to actually change
        try {
          await waitFor(() => {
            const afterSnapshot = getCartSnapshot();
            // Cart changed if signature differs or item count increased
            return afterSnapshot.signature !== beforeSnapshot.signature || 
                   afterSnapshot.itemCount > beforeSnapshot.itemCount;
          }, 8000, 200);
          
          if (DEBUG) {
            const afterSnapshot = getCartSnapshot();
            console.log('[useBooqableCart] After snapshot:', afterSnapshot);
          }
        } catch {
          // Cart didn't change - this is a failure
          const err = 'Cart did not update. The Booqable widget may not be responding.';
          if (DEBUG) console.warn('[useBooqableCart]', err);
          setState({ isLoading: false, error: err, itemsAdded: 0 });
          return { success: false, itemsAdded: 0, error: err };
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
