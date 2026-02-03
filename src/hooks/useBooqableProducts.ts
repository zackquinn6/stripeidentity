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
  firstDayRate: number;
  dailyRate: number;
  depositAmount: number;
  stockCount: number;
  trackable: boolean;
  hasVariations?: boolean;
  productType: string;
  isSalesItem: boolean;
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
        // If Booqable marks this as a sales item (consumable/service),
        // set isConsumable to true so pricing displays correctly
        const isConsumable = booqableProduct.isSalesItem || item.isConsumable;
        
        return {
          ...item,
          booqableId: booqableProduct.booqableId,
          firstDayRate: booqableProduct.firstDayRate || item.firstDayRate || item.dailyRate,
          dailyRate: booqableProduct.dailyRate || item.dailyRate,
          imageUrl: booqableProduct.imageUrl || item.imageUrl,
          description: booqableProduct.description || item.description,
          isConsumable,
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

// Merge consumables with Booqable sales items
export function useMergedConsumables() {
  const { data: booqableProducts, isLoading, error } = useBooqableProducts();

  const mergedConsumables: RentalItem[] = staticConsumables.map(item => {
    if (!booqableProducts) return item;

    const booqableProduct = booqableProducts.find(p =>
      p.slug === item.id ||
      p.name.toLowerCase() === item.name.toLowerCase() ||
      p.name.toLowerCase().includes(item.name.toLowerCase().split(' ')[0])
    );

    if (booqableProduct) {
      return {
        ...item,
        booqableId: booqableProduct.booqableId,
        // For sales items, firstDayRate and dailyRate are the same (sale price)
        firstDayRate: booqableProduct.firstDayRate || item.dailyRate,
        dailyRate: booqableProduct.dailyRate || item.dailyRate,
        imageUrl: booqableProduct.imageUrl || item.imageUrl,
        description: booqableProduct.description || item.description,
        isConsumable: true, // Always true for consumables
      };
    }

    return item;
  });

  // Also add any Booqable sales items not in static consumables
  if (booqableProducts) {
    const salesItems = booqableProducts.filter(p => p.isSalesItem);
    for (const product of salesItems) {
      const existsInMerged = mergedConsumables.some(c =>
        c.booqableId === product.booqableId ||
        c.id === product.slug ||
        c.name.toLowerCase() === product.name.toLowerCase()
      );
      
      if (!existsInMerged) {
        mergedConsumables.push({
          id: product.slug,
          name: product.name,
          retailPrice: product.firstDayRate, // For sales items, use firstDayRate as the price
          firstDayRate: product.firstDayRate,
          dailyRate: product.dailyRate,
          quantity: 0,
          isConsumable: true,
          imageUrl: product.imageUrl,
          description: product.description,
          booqableId: product.booqableId,
        });
      }
    }
  }

  return {
    consumables: mergedConsumables,
    isLoading,
    error,
    isLiveData: !!booqableProducts && booqableProducts.length > 0,
  };
}

export default useBooqableProducts;
