import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BooqableProduct {
  booqableId: string; // UUID
  slug: string;
}

/**
 * Fetches all Booqable products and builds a map from slug → UUID.
 * This is needed because our DB stores slugs, but Booqable embeds need UUIDs.
 */
export function useBooqableIdMap() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['booqable-id-map'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.functions.invoke('booqable', {
        body: { action: 'get-products' },
      });

      if (error) {
        console.error('[useBooqableIdMap] Error fetching products:', error);
        throw error;
      }

      const products: BooqableProduct[] = data?.products ?? [];
      const map: Record<string, string> = {};

      for (const p of products) {
        if (p.slug && p.booqableId) {
          map[p.slug] = p.booqableId;
        }
      }

      console.log(`[useBooqableIdMap] Built map with ${Object.keys(map).length} entries`);
      return map;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    slugToUuid: data ?? {},
    isLoading,
    error,
  };
}
