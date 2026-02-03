import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RentalItem } from '@/types/rental';

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

async function fetchProjectConsumables(projectSlug: string): Promise<RentalItem[]> {
  // Fetch sections with their items for the given project
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
        default_quantity
      )
    `)
    .eq('section_type', 'consumable')
    .eq('is_visible', true)
    .order('display_order');

  if (error) {
    console.error('[useProjectItems] Error fetching consumables:', error);
    throw error;
  }

  // Flatten all items from consumable sections
  const items: RentalItem[] = [];
  
  for (const section of (sections as SectionRow[]) || []) {
    const visibleItems = section.section_items
      .filter(item => item.is_visible)
      .sort((a, b) => a.display_order - b.display_order);
    
    for (const item of visibleItems) {
      items.push({
        id: item.booqable_product_id || item.id,
        name: item.name,
        retailPrice: Number(item.retail_price) || 0,
        dailyRate: Number(item.daily_rate) || 0,
        quantity: item.default_quantity || 0,
        isConsumable: true,
        imageUrl: item.image_url || undefined,
        description: item.description || undefined,
        selectionGuidance: item.selection_guidance || undefined,
        booqableId: item.booqable_product_id || undefined,
      });
    }
  }

  return items;
}

export function useProjectConsumables(projectSlug: string = 'tile-flooring') {
  return useQuery({
    queryKey: ['project-consumables', projectSlug],
    queryFn: () => fetchProjectConsumables(projectSlug),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export default useProjectConsumables;
