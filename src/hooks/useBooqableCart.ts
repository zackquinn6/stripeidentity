import { useCallback, useState } from 'react';
import { RentalItem } from '@/types/rental';
import { format } from 'date-fns';

// Booqable global is already declared in use-booqable.ts

interface UseBooqableCartState {
  isLoading: boolean;
  error: string | null;
  itemsAdded: number;
}

function getBooqableApi(): any {
  return (window as any).Booqable || (window as any).booqable;
}

async function waitFor(condition: () => boolean, timeoutMs = 4000, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timed out waiting for Booqable to be ready');
}

function hasBooqableButtons() {
  return !!document.querySelector('.booqable-product-button');
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

function findProductButton(productId: string): HTMLElement | null {
  // Buttons are rendered by our app: <div class="booqable-product-button" data-id="..." />
  return document.querySelector(`.booqable-product-button[data-id="${CSS.escape(productId)}"]`);
}

/**
 * Hook to programmatically populate the embedded Booqable cart widget.
 *
 * Strategy:
 * 1) Set starts_at/stops_at on the current page URL (what Booqable reads for the widget)
 * 2) Refresh Booqable so it re-reads the params / rescans DOM
 * 3) Click each rendered .booqable-product-button and pass quantity via data-quantity
 */
export function useBooqableCart() {
  const [state, setState] = useState<UseBooqableCartState>({
    isLoading: false,
    error: null,
    itemsAdded: 0,
  });

  /**
   * Add items to the cart widget.
   * 
   * @param items - Items with booqableId and quantity > 0
   * @param startDate - Rental start
   * @param endDate - Rental end
   */
  const addToCart = useCallback(
    async (items: RentalItem[], startDate: Date, endDate: Date) => {
      setState({ isLoading: true, error: null, itemsAdded: 0 });

      // Filter to items that have a booqableId and quantity > 0
      const validItems = items.filter(
        (item) => item.booqableId && item.quantity > 0
      );

      if (validItems.length === 0) {
        setState({
          isLoading: false,
          error: 'No items with Booqable IDs selected',
          itemsAdded: 0,
        });
        return { success: false, itemsAdded: 0 };
      }

      // Format dates as ISO strings (Booqable expects ISO 8601)
      const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
      const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");

      console.log(`[useBooqableCart] Adding ${validItems.length} items to cart`);
      console.log(`[useBooqableCart] Dates: ${startsAt} → ${stopsAt}`);

      try {
        // Some embeds don't expose window.Booqable immediately (or at all), but the
        // rendered product buttons can still work. Proceed when either the API OR the
        // button placeholders are present.
        await waitFor(() => !!getBooqableApi() || hasBooqableButtons(), 12000);

        // Ensure our button placeholders are present in the DOM
        await waitFor(
          () => validItems.every((i) => !!i.booqableId && !!findProductButton(i.booqableId)),
          12000
        );

        // Set the rental period on the *current page* so the embedded widget uses it.
        setBooqableDatesOnPage(startsAt, stopsAt);
        // Best-effort refresh (only works when API is available)
        booqableRefresh();

        let addedCount = 0;

        for (const item of validItems) {
          const btn = findProductButton(item.booqableId!);
          if (!btn) continue;

          // Try to let Booqable handle quantity in one click.
          // If Booqable ignores data-quantity, we fall back to repeated clicks below.
          btn.setAttribute('data-quantity', String(item.quantity));

          // Click once first.
          (btn as HTMLDivElement).click();
          addedCount += 1;

          // If quantity > 1, do best-effort repeated clicks (some shops require it)
          if (item.quantity > 1) {
            for (let i = 1; i < item.quantity; i++) {
              await new Promise((r) => setTimeout(r, 120));
              (btn as HTMLDivElement).click();
              addedCount += 1;
            }
          }

          // Small delay so the widget can process.
          await new Promise((r) => setTimeout(r, 150));
        }

        // Nudge the widget one more time after all clicks.
        booqableRefresh();

        setState({
          isLoading: false,
          error: null,
          itemsAdded: validItems.length,
        });

        return { success: true, itemsAdded: validItems.length };
      } catch (e: any) {
        const message = e?.message || 'Failed to add items to cart widget';
        console.warn('[useBooqableCart] Failed to add items to widget cart:', e);
        setState({ isLoading: false, error: message, itemsAdded: 0 });
        return { success: false, itemsAdded: 0 };
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
