import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BooqableProduct {
  booqableId: string;
  slug: string;
  imageUrl: string;
}

/**
 * Fetches all Booqable products and builds a map from slug → imageUrl.
 * This is used to display Booqable images instead of stock images.
 */
export function useBooqableImages() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['booqable-images'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.functions.invoke('booqable', {
        body: { action: 'get-products' },
      });

      if (error) {
        console.error('[useBooqableImages] Error fetching products:', error);
        throw error;
      }

      const products: BooqableProduct[] = data?.products ?? [];
      const map: Record<string, string> = {};

      for (const p of products) {
        if (p.slug && p.imageUrl) {
          map[p.slug] = p.imageUrl;
        }
        // Also map by booqableId for direct lookups
        if (p.booqableId && p.imageUrl) {
          map[p.booqableId] = p.imageUrl;
        }
      }

      console.log(`[useBooqableImages] Built map with ${Object.keys(map).length} entries`);
      return map;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    imageMap: data ?? {},
    isLoading,
    error,
  };
}

export default useBooqableImages;
