export interface RentalItem {
  id: string;
  name: string;
  retailPrice: number;
  dailyRate: number;
  firstDayRate?: number; // Day 1 price (includes delivery/setup)
  quantity: number;
  isConsumable?: boolean;
  isSalesItem?: boolean; // True if one-time purchase, false if rental
  imageUrl?: string;
  booqableId?: string;
  selectionGuidance?: string;
  // Scaling configuration for consumables
  scalingTileSize?: string; // 'small' | 'medium' | 'large' | 'all'
  scalingPer100Sqft?: number; // Units needed per 100 sq ft
  scalingGuidance?: string; // User-facing explanation (e.g., "1 bag per 20 sq ft")
  // Extended details for modal
  description?: string;
  usage?: string;
  images?: string[];
  specifications?: { label: string; value: string }[];
}

export interface EquipmentCategory {
  id: string;
  name: string;
  items: RentalItem[];
}

export interface AddOnCategory {
  id: string;
  name: string;
  description?: string;
  selectionGuidance?: string;
  items: RentalItem[];
}

export interface TileProjectData {
  squareFootage: number;
  tileSize: string;
  equipment: Record<string, number>;
  addOns: Record<string, number>;
  consumables: Record<string, number>;
}

export interface ProjectType {
  id: string;
  name: string;
  description: string;
  icon: string;
  available: boolean;
}
