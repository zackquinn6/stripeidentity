import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem, EquipmentCategory, AddOnCategory } from '@/types/rental';

interface BooqableProduct {
  booqableId: string;
  slug: string;
  imageUrl: string;
  firstDayRate: number;
  dailyRate: number;
  isSalesItem: boolean;
}

interface SectionItemRow {
  id: string;
  name: string;
  description: string | null;
  selection_guidance: string | null;
  booqable_product_id: string;
  daily_rate: number;
  retail_price: number;
  image_url: string | null;
  display_order: number;
  is_visible: boolean;
  default_quantity: number;
  default_quantity_essentials: number;
  default_quantity_comprehensive: number;
  scaling_tile_size: string | null;
  scaling_per_100_sqft: number | null;
  scaling_guidance: string | null;
  is_sales_item: boolean;
}

interface SectionRow {
  id: string;
  name: string;
  slug: string;
  section_type: string;
  description: string | null;
  selection_guidance: string | null;
  display_order: number;
  section_items: SectionItemRow[];
}

// Fetch Booqable products for image and pricing data
async function fetchBooqableProducts(): Promise<Map<string, BooqableProduct>> {
  try {
    const { data, error } = await supabase.functions.invoke('booqable', {
      body: { action: 'get-products' },
    });

    if (error) {
      console.error('[useProjectItems] Error fetching Booqable products:', error);
      return new Map();
    }

    const products: BooqableProduct[] = (data?.products ?? []).map((p: any) => ({
      booqableId: p.booqableId,
      slug: p.slug,
      imageUrl: p.imageUrl,
      firstDayRate: p.firstDayRate,
      dailyRate: p.dailyRate,
      isSalesItem: p.isSalesItem ?? false,
    }));
    const productMap = new Map<string, BooqableProduct>();

    for (const p of products) {
      if (p.slug) {
        productMap.set(p.slug, p);
      }
    }

    console.log(`[useProjectItems] Fetched ${productMap.size} Booqable products for image/pricing merge`);
    return productMap;
  } catch (err) {
    console.error('[useProjectItems] Failed to fetch Booqable products:', err);
    return new Map();
  }
}

function mapItemToRentalItem(
  item: SectionItemRow, 
  isConsumable: boolean = false,
  booqableProducts?: Map<string, BooqableProduct>
): RentalItem {
  // Try to find matching Booqable product by slug for image and pricing
  const booqableProduct = booqableProducts?.get(item.booqable_product_id);
  
  // Use Booqable image if available, otherwise fall back to DB image
  const imageUrl = booqableProduct?.imageUrl || item.image_url || undefined;
  
  // IMPORTANT: Use database is_sales_item as source of truth, NOT Booqable's product_type
  // This ensures admin-configured items maintain their correct classification
  const isSalesItem = item.is_sales_item;
  
  // Use Booqable pricing if available - respects tiered pricing (day 1 vs day 2+)
  // For sales items, firstDayRate and dailyRate are the same (sale price)
  // For rentals, firstDayRate = day 1 rate, dailyRate = day 2+ rate
  let firstDayRate: number;
  let dailyRate: number;
  
  if (booqableProduct) {
    firstDayRate = booqableProduct.firstDayRate;
    dailyRate = booqableProduct.dailyRate;
  } else {
    // Fall back to DB values
    dailyRate = Number(item.daily_rate) ?? 0;
    firstDayRate = dailyRate;
  }

  return {
    id: item.id,
    name: item.name,
    retailPrice: Number(item.retail_price) || 0,
    dailyRate,
    firstDayRate,
    quantity: item.default_quantity || 0,
    defaultQuantityEssentials: item.default_quantity_essentials || 0,
    defaultQuantityComprehensive: item.default_quantity_comprehensive || 0,
    isConsumable,
    isSalesItem,
    imageUrl,
    description: item.description || undefined,
    selectionGuidance: item.selection_guidance || undefined,
    booqableId: item.booqable_product_id || undefined,
    scalingTileSize: item.scaling_tile_size || undefined,
    scalingPer100Sqft: item.scaling_per_100_sqft ? Number(item.scaling_per_100_sqft) : undefined,
    scalingGuidance: item.scaling_guidance || undefined,
  };
}

interface ProjectSectionsData {
  equipment: EquipmentCategory[];
  addOns: AddOnCategory[];
  consumables: RentalItem[];
}

async function fetchProjectSections(projectSlug: string): Promise<ProjectSectionsData> {
  // Fetch Booqable products in parallel with DB sections
  const [booqableProducts, sectionsResult] = await Promise.all([
    fetchBooqableProducts(),
    supabase
      .from('ordering_sections')
      .select(`
        id,
        name,
        slug,
        section_type,
        description,
        selection_guidance,
        display_order,
        section_items (
          id,
          name,
          description,
          selection_guidance,
          booqable_product_id,
          daily_rate,
          retail_price,
          image_url,
          display_order,
          is_visible,
          default_quantity,
          default_quantity_essentials,
          default_quantity_comprehensive,
          scaling_tile_size,
          scaling_per_100_sqft,
          scaling_guidance,
          is_sales_item
        )
      `)
      .eq('is_visible', true)
      .order('display_order'),
  ]);

  const { data: sections, error } = sectionsResult;

  if (error) {
    console.error('[useProjectItems] Error fetching sections:', error);
    throw error;
  }

  const equipment: EquipmentCategory[] = [];
  const addOns: AddOnCategory[] = [];
  const consumables: RentalItem[] = [];

  for (const section of (sections as SectionRow[]) || []) {
    const visibleItems = section.section_items
      .filter(item => item.is_visible)
      .sort((a, b) => a.display_order - b.display_order);

    if (section.section_type === 'equipment') {
      equipment.push({
        id: section.slug,
        name: section.name,
        items: visibleItems.map(item => mapItemToRentalItem(item, false, booqableProducts)),
      });
    } else if (section.section_type === 'addon') {
      addOns.push({
        id: section.slug,
        name: section.name,
        description: section.description || undefined,
        selectionGuidance: section.selection_guidance || undefined,
        items: visibleItems.map(item => mapItemToRentalItem(item, false, booqableProducts)),
      });
    } else if (section.section_type === 'consumable') {
      for (const item of visibleItems) {
        consumables.push(mapItemToRentalItem(item, true, booqableProducts));
      }
    }
  }

  return { equipment, addOns, consumables };
}

export function useProjectSections(projectSlug: string = 'tile-flooring') {
  return useQuery({
    queryKey: ['project-sections', projectSlug],
    queryFn: () => fetchProjectSections(projectSlug),
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });
}

// Legacy hook for backwards compatibility
async function fetchProjectConsumables(projectSlug: string): Promise<RentalItem[]> {
  const data = await fetchProjectSections(projectSlug);
  return data.consumables;
}

export function useProjectConsumables(projectSlug: string = 'tile-flooring') {
  return useQuery({
    queryKey: ['project-consumables', projectSlug],
    queryFn: () => fetchProjectConsumables(projectSlug),
    staleTime: 2 * 60 * 1000,
  });
}

export default useProjectConsumables;
