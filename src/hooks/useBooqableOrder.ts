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

      // Step 1: Create the order with all items included
      // Per Booqable guidance: Create order with all items and dates in one call
      const lines = booqableItems.map(item => ({
        product_id: item.booqableId!,
        quantity: item.quantity,
      }));

      console.log(`[useBooqableOrder] Creating order with ${lines.length} items...`);
      const { data: orderData, error: orderError } = await supabase.functions.invoke('booqable', {
        body: {
          action: 'create-order',
          starts_at: format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          stops_at: format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          lines: lines,
        }
      });

      if (orderError) {
        throw new Error(orderError.message || 'Failed to create order');
      }

      const orderId = orderData.order?.id;
      if (!orderId) {
        throw new Error('Order created but no ID returned');
      }

      console.log(`[useBooqableOrder] Order created: ${orderId} with ${lines.length} items`);

      // Step 2: Book/reserve the order and get checkout URL
      // Per Booqable guidance: Order must be booked before checkout is available
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('booqable', {
        body: {
          action: 'get-checkout-url',
          order_id: orderId,
          book_order: true, // Reserve stock and enable checkout
        }
      });

      if (checkoutError) {
        throw new Error(checkoutError.message || 'Failed to get checkout URL');
      }

      const checkoutUrl = checkoutData?.checkoutUrl;
      const orderNumber = checkoutData?.orderNumber;

      if (!checkoutUrl) {
        throw new Error('No checkout URL returned');
      }

      console.log(
        `[useBooqableOrder] Checkout URL (${checkoutData?.checkoutUrlSource ?? 'unknown'}): ${checkoutUrl}, Order #${orderNumber}`
      );

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
