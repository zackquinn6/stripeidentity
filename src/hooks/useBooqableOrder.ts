import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem } from '@/types/rental';
import { createBooqableOrder } from '@/lib/booqable/orderFlow';

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
      const { orderId, orderNumber, checkoutUrl } = await createBooqableOrder({
        invoke: supabase.functions.invoke,
        items,
        startDate,
        endDate,
      });

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
