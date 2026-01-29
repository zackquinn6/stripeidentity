import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem, EquipmentCategory } from '@/types/rental';
import { equipmentCategories as staticEquipment, consumables as staticConsumables } from '@/data/tileEquipment';

interface BooqableProduct {
  booqableId: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  dailyRate: number;
  depositAmount: number;
  stockCount: number;
  trackable: boolean;
}

interface BooqableProductsResponse {
  products: BooqableProduct[];
}

async function fetchBooqableProducts(): Promise<BooqableProduct[]> {
  const { data, error } = await supabase.functions.invoke('booqable', {
    body: { action: 'get-products' }
  });

  if (error) {
    console.error('[useBooqableProducts] Error fetching products:', error);
    throw error;
  }

  return (data as BooqableProductsResponse).products || [];
}

// Maps Booqable product slugs to local category IDs
const categoryMapping: Record<string, string> = {
  'safety-glasses': 'safety',
  'knee-pads': 'safety',
  'respirator': 'safety',
  'chalk-line': 'layout',
  'laser-line': 'layout',
  'laser-level': 'layout',
  'mixer': 'mixing',
  'mixer-drill': 'mixing',
  'mixing-drill': 'mixing',
  'bucket-liners': 'mixing',
  'tile-saw': 'cutting',
  'wet-saw': 'cutting',
  'wet-saw-large': 'cutting',
  'wet-saw-small': 'cutting',
  'manual-cutter': 'cutting',
  'tile-cutter': 'cutting',
  'angle-grinder': 'cutting',
  'drilling-kit': 'cutting',
  'diamond-drilling-kit': 'cutting',
  'trowel': 'installation',
  'notched-trowel': 'installation',
  'margin-trowel': 'installation',
  'sponges': 'installation',
  'sponge': 'installation',
};

// Find matching static item for additional details
function findStaticItem(slug: string): RentalItem | undefined {
  for (const category of staticEquipment) {
    const item = category.items.find(i => 
      i.id === slug || 
      i.booqableId === slug ||
      i.name.toLowerCase().includes(slug.replace(/-/g, ' '))
    );
    if (item) return item;
  }
  return staticConsumables.find(i => 
    i.id === slug || 
    i.name.toLowerCase().includes(slug.replace(/-/g, ' '))
  );
}

export function useBooqableProducts() {
  return useQuery({
    queryKey: ['booqable-products'],
    queryFn: fetchBooqableProducts,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
}

export function useMergedEquipment() {
  const { data: booqableProducts, isLoading, error, refetch } = useBooqableProducts();

  // If we have Booqable products, merge them with static data
  const mergedCategories: EquipmentCategory[] = staticEquipment.map(category => {
    if (!booqableProducts) return category;

    const updatedItems = category.items.map(item => {
      // Find matching Booqable product by slug or name
      const booqableProduct = booqableProducts.find(p => 
        p.slug === item.id ||
        p.slug === item.booqableId ||
        p.name.toLowerCase() === item.name.toLowerCase() ||
        categoryMapping[p.slug] === category.id && p.name.toLowerCase().includes(item.name.toLowerCase().split(' ')[0])
      );

      if (booqableProduct) {
        return {
          ...item,
          booqableId: booqableProduct.booqableId,
          dailyRate: booqableProduct.dailyRate || item.dailyRate,
          imageUrl: booqableProduct.imageUrl || item.imageUrl,
          description: booqableProduct.description || item.description,
        };
      }

      return item;
    });

    return { ...category, items: updatedItems };
  });

  return {
    categories: mergedCategories,
    isLoading,
    error,
    refetch,
    isLiveData: !!booqableProducts && booqableProducts.length > 0,
  };
}

export default useBooqableProducts;
