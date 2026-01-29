import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem } from '@/types/rental';
import { format } from 'date-fns';

interface OrderState {
  isCreating: boolean;
  error: string | null;
  orderId: string | null;
  checkoutUrl: string | null;
}

interface CreateOrderParams {
  items: RentalItem[];
  startDate: Date;
  endDate: Date;
}

export function useBooqableOrder() {
  const [state, setState] = useState<OrderState>({
    isCreating: false,
    error: null,
    orderId: null,
    checkoutUrl: null,
  });

  const createOrder = async ({ items, startDate, endDate }: CreateOrderParams) => {
    setState(prev => ({ ...prev, isCreating: true, error: null }));

    try {
      // Filter items that have a booqableId (can be added to Booqable order)
      const booqableItems = items.filter(item => item.booqableId && item.quantity > 0);

      if (booqableItems.length === 0) {
        throw new Error('No items with Booqable IDs selected');
      }

      // Step 1: Create the order
      console.log('[useBooqableOrder] Creating order...');
      const { data: orderData, error: orderError } = await supabase.functions.invoke('booqable', {
        body: {
          action: 'create-order',
          starts_at: format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          stops_at: format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        }
      });

      if (orderError) {
        throw new Error(orderError.message || 'Failed to create order');
      }

      const orderId = orderData.order?.id;
      if (!orderId) {
        throw new Error('Order created but no ID returned');
      }

      console.log(`[useBooqableOrder] Order created: ${orderId}`);

      // Step 2: Add line items
      for (const item of booqableItems) {
        console.log(`[useBooqableOrder] Adding line: ${item.name} x${item.quantity}`);
        const { error: lineError } = await supabase.functions.invoke('booqable', {
          body: {
            action: 'add-line',
            order_id: orderId,
            product_id: item.booqableId,
            quantity: item.quantity,
          }
        });

        if (lineError) {
          console.error(`[useBooqableOrder] Error adding ${item.name}:`, lineError);
          // Continue with other items even if one fails
        }
      }

      // Step 3: Get checkout URL
      const { data: checkoutData } = await supabase.functions.invoke('booqable', {
        body: {
          action: 'get-checkout-url',
          order_id: orderId,
        }
      });

      const checkoutUrl = checkoutData?.checkoutUrl;
      console.log(`[useBooqableOrder] Checkout URL: ${checkoutUrl}`);

      setState({
        isCreating: false,
        error: null,
        orderId,
        checkoutUrl,
      });

      return { orderId, checkoutUrl };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create order';
      console.error('[useBooqableOrder] Error:', message);
      setState(prev => ({
        ...prev,
        isCreating: false,
        error: message,
      }));
      throw error;
    }
  };

  const redirectToCheckout = () => {
    if (state.checkoutUrl) {
      window.open(state.checkoutUrl, '_blank');
    }
  };

  const reset = () => {
    setState({
      isCreating: false,
      error: null,
      orderId: null,
      checkoutUrl: null,
    });
  };

  return {
    ...state,
    createOrder,
    redirectToCheckout,
    reset,
  };
}

export default useBooqableOrder;
