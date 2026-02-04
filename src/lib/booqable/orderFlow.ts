import { format } from 'date-fns';
import type { RentalItem } from '@/types/rental';

type InvokeFn = (
  functionName: string,
  args: { body: Record<string, unknown> }
) => Promise<{ data: any; error: any }>;

export interface CreateBooqableOrderParams {
  invoke: InvokeFn;
  items: RentalItem[];
  startDate: Date;
  endDate: Date;
}

/**
 * Prime-path checkout creation:
 * 1) Create an order for the selected rental period
 * 2) Add each mapped item as a line
 * 3) Fetch the hosted checkout URL
 */
export async function createBooqableOrder({
  invoke,
  items,
  startDate,
  endDate,
}: CreateBooqableOrderParams): Promise<{ orderId: string; orderNumber: number | null; checkoutUrl: string }> {
  // Filter items that have an EXPLICIT booqableId set (not just using item.id as fallback)
  const booqableItems = items.filter((item) => {
    const hasExplicitBooqableId = item.booqableId && item.booqableId !== item.id;
    const hasQuantity = item.quantity > 0;
    return Boolean(hasExplicitBooqableId && hasQuantity);
  });

  const { data: orderData, error: orderError } = await invoke('booqable', {
    body: {
      action: 'create-order',
      starts_at: format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      stops_at: format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
    },
  });

  if (orderError) {
    throw new Error(orderError.message || 'Failed to create order');
  }

  const orderId = orderData?.order?.id as string | undefined;
  if (!orderId) throw new Error('Order created but no ID returned');

  for (const item of booqableItems) {
    const { data: lineData, error: lineError } = await invoke('booqable', {
      body: {
        action: 'add-line',
        order_id: orderId,
        product_id: item.booqableId,
        quantity: item.quantity,
      },
    });

    if (lineError || lineData?.error) {
      throw new Error(lineError?.message || lineData?.error || `Failed to add line for ${item.name}`);
    }
  }

  const { data: checkoutData, error: checkoutError } = await invoke('booqable', {
    body: {
      action: 'get-checkout-url',
      order_id: orderId,
    },
  });

  if (checkoutError) {
    throw new Error(checkoutError.message || 'Failed to get checkout URL');
  }

  const checkoutUrl = checkoutData?.checkoutUrl as string | undefined;
  if (!checkoutUrl) throw new Error('No checkout URL returned');

  return {
    orderId,
    orderNumber: (checkoutData?.orderNumber as number | null) ?? null,
    checkoutUrl,
  };
}
