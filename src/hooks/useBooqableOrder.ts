import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem } from '@/types/rental';
import { format } from 'date-fns';

interface OrderState {
  isCreating: boolean;
  error: string | null;
  orderId: string | null;
  orderNumber: number | null;
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
    orderNumber: null,
    checkoutUrl: null,
  });

  const createOrder = async ({ items, startDate, endDate }: CreateOrderParams) => {
    setState(prev => ({ ...prev, isCreating: true, error: null }));

    try {
      // Filter items that have an EXPLICIT booqableId set (not just using item.id as fallback)
      // Items without booqableId are local-only and can't be synced to Booqable
      const booqableItems = items.filter(item => {
        const hasExplicitBooqableId = item.booqableId && item.booqableId !== item.id;
        const hasQuantity = item.quantity > 0;
        
        if (hasQuantity && !hasExplicitBooqableId) {
          console.log(`[useBooqableOrder] Skipping ${item.name} - no Booqable mapping configured`);
        }
        
        return hasExplicitBooqableId && hasQuantity;
      });

      // Step 1: Create the order (even if no Booqable items - user may want to track dates)
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

      // Step 2: Add line items (only items with explicit Booqable mappings)
      let successCount = 0;
      let failCount = 0;
      
      for (const item of booqableItems) {
        console.log(`[useBooqableOrder] Adding line: ${item.name} (${item.booqableId}) x${item.quantity}`);
        const { data: lineData, error: lineError } = await supabase.functions.invoke('booqable', {
          body: {
            action: 'add-line',
            order_id: orderId,
            product_id: item.booqableId,
            quantity: item.quantity,
          }
        });

        if (lineError || lineData?.error) {
          console.warn(`[useBooqableOrder] Could not add ${item.name}:`, lineError || lineData?.error);
          failCount++;
        } else {
          successCount++;
        }
      }
      
      console.log(`[useBooqableOrder] Added ${successCount} items, ${failCount} failed`);
      
      if (booqableItems.length > 0 && successCount === 0) {
        console.warn('[useBooqableOrder] No items could be added to order - check Booqable product mappings');
      }

      // Step 3: Get checkout URL
      const { data: checkoutData } = await supabase.functions.invoke('booqable', {
        body: {
          action: 'get-checkout-url',
          order_id: orderId,
        }
      });

      const checkoutUrl = checkoutData?.checkoutUrl;
      const orderNumber = checkoutData?.orderNumber;
      console.log(`[useBooqableOrder] Checkout URL: ${checkoutUrl}, Order #${orderNumber}`);

      setState({
        isCreating: false,
        error: null,
        orderId,
        orderNumber,
        checkoutUrl,
      });

      return { orderId, orderNumber, checkoutUrl };

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
      orderNumber: null,
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
