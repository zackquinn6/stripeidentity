import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem, EquipmentCategory, AddOnCategory } from '@/types/rental';

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
  display_order: number;
  section_items: SectionItemRow[];
}

function mapItemToRentalItem(item: SectionItemRow, isConsumable: boolean = false): RentalItem {
  return {
    id: item.id,
    name: item.name,
    retailPrice: Number(item.retail_price) || 0,
    dailyRate: Number(item.daily_rate) || 0,
    firstDayRate: Number(item.daily_rate) || 0,
    quantity: item.default_quantity || 0,
    isConsumable,
    isSalesItem: item.is_sales_item || false,
    imageUrl: item.image_url || undefined,
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
  // Fetch all visible sections with their items
  const { data: sections, error } = await supabase
    .from('ordering_sections')
    .select(`
      id,
      name,
      slug,
      section_type,
      description,
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
        scaling_tile_size,
        scaling_per_100_sqft,
        scaling_guidance,
        is_sales_item
      )
    `)
    .eq('is_visible', true)
    .order('display_order');

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
        items: visibleItems.map(item => mapItemToRentalItem(item, false)),
      });
    } else if (section.section_type === 'addon') {
      // For add-ons, use the first item's selection_guidance as the category guidance
      const categoryGuidance = visibleItems[0]?.selection_guidance || section.description;
      
      addOns.push({
        id: section.slug,
        name: section.name,
        description: section.description || undefined,
        selectionGuidance: categoryGuidance || undefined,
        items: visibleItems.map(item => mapItemToRentalItem(item, false)),
      });
    } else if (section.section_type === 'consumable') {
      for (const item of visibleItems) {
        consumables.push(mapItemToRentalItem(item, true));
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
