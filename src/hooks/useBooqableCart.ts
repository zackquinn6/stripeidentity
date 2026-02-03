import { useCallback, useState } from 'react';
import { RentalItem } from '@/types/rental';
import { format } from 'date-fns';

// Booqable global is already declared in use-booqable.ts

interface UseBooqableCartState {
  isLoading: boolean;
  error: string | null;
  itemsAdded: number;
}

/**
 * Hook to programmatically populate the Booqable cart widget.
 * 
 * The Booqable embedded widget uses `booqable-product-button` elements.
 * Clicking them opens a date-picker modal; once dates are set the item is added.
 * 
 * We set rental dates via URL query params that Booqable reads on init,
 * then programmatically click each product button.
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

      // Build the cart URL with dates and products
      // Booqable's hosted shop accepts query params: starts_at, stops_at, product_ids (comma-separated slugs)
      const shopId = 'feeebb8b-2583-4689-b2f6-d488f8220b65';
      const baseUrl = `https://${shopId}.booqableshop.com`;

      // Build product_ids param (format: slug:qty,slug:qty)
      const productParams = validItems
        .map((item) => `${item.booqableId}:${item.quantity}`)
        .join(',');

      const checkoutUrl = `${baseUrl}/cart?starts_at=${encodeURIComponent(
        startsAt
      )}&stops_at=${encodeURIComponent(stopsAt)}&products=${encodeURIComponent(
        productParams
      )}`;

      console.log(`[useBooqableCart] Opening checkout: ${checkoutUrl}`);

      // Open in new tab
      window.open(checkoutUrl, '_blank');

      setState({
        isLoading: false,
        error: null,
        itemsAdded: validItems.length,
      });

      return { success: true, itemsAdded: validItems.length, checkoutUrl };
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
