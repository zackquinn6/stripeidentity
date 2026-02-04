import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem } from '@/types/rental';

const RUSH_ORDER_SLUG = 'rush-order-processing';

interface BooqableProduct {
  booqableId: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  firstDayRate: number;
  dailyRate: number;
  isSalesItem: boolean;
  productType: string;
}

/**
 * Fetches the Rush Order Processing product from Booqable.
 * This is a service/consumable that should be auto-added when
 * the rental start date is within 48 hours.
 */
export function useRushOrderItem() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['rush-order-item'],
    queryFn: async (): Promise<RentalItem | null> => {
      const { data, error } = await supabase.functions.invoke('booqable', {
        body: { action: 'get-products' },
      });

      if (error) {
        console.error('[useRushOrderItem] Error fetching products:', error);
        throw error;
      }

      const products: BooqableProduct[] = data?.products ?? [];
      const rushProduct = products.find(p => p.slug === RUSH_ORDER_SLUG);

      if (!rushProduct) {
        console.warn('[useRushOrderItem] Rush order product not found');
        return null;
      }

      console.log('[useRushOrderItem] Found rush order product:', rushProduct);

      return {
        id: RUSH_ORDER_SLUG,
        name: rushProduct.name,
        retailPrice: rushProduct.firstDayRate,
        dailyRate: rushProduct.firstDayRate, // Flat fee
        firstDayRate: rushProduct.firstDayRate,
        quantity: 0,
        isConsumable: true,
        isSalesItem: true,
        imageUrl: rushProduct.imageUrl,
        description: 'Rush order processing fee for orders within 48 hours',
        booqableId: rushProduct.booqableId,
      };
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    rushOrderItem: data ?? null,
    isLoading,
    error,
  };
}

export default useRushOrderItem;
