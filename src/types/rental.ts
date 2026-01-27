export interface RentalItem {
  id: string;
  name: string;
  retailPrice: number;
  dailyRate: number;
  quantity: number;
  isConsumable?: boolean;
}

export interface EquipmentCategory {
  id: string;
  name: string;
  items: RentalItem[];
}

export interface AddOnCategory {
  id: string;
  name: string;
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
