import { EquipmentCategory, AddOnCategory, RentalItem } from '@/types/rental';

export const equipmentCategories: EquipmentCategory[] = [
  {
    id: 'safety',
    name: 'Safety Gear',
    items: [
      { id: 'glasses', name: 'Safety Glasses', retailPrice: 15, dailyRate: 0.75, quantity: 0 },
      { id: 'knee-pads', name: 'Knee Pads', retailPrice: 35, dailyRate: 1.75, quantity: 0 },
      { id: 'respirator', name: 'Respirator', retailPrice: 30, dailyRate: 1.50, quantity: 0 },
    ],
  },
  {
    id: 'layout',
    name: 'Tile Layout',
    items: [
      { id: 'chalk-line', name: 'Chalk Line', retailPrice: 12, dailyRate: 0.60, quantity: 0 },
      { id: 'laser-line', name: 'Laser Line', retailPrice: 120, dailyRate: 6.00, quantity: 0 },
    ],
  },
  {
    id: 'mixing',
    name: 'Thinset Mixing',
    items: [
      { id: 'mixer', name: 'Mixer Drill', retailPrice: 180, dailyRate: 9.00, quantity: 0 },
      { id: 'bucket-liners', name: 'Bucket Liners (5-pack)', retailPrice: 10, dailyRate: 0.50, quantity: 0, isConsumable: true },
    ],
  },
  {
    id: 'cutting',
    name: 'Cutting Tools',
    items: [
      { id: 'wet-saw-large', name: 'Wet Saw (Large)', retailPrice: 600, dailyRate: 30.00, quantity: 0 },
      { id: 'wet-saw-small', name: 'Wet Saw (Small)', retailPrice: 300, dailyRate: 15.00, quantity: 0 },
      { id: 'manual-cutter', name: 'Manual Tile Cutter', retailPrice: 80, dailyRate: 4.00, quantity: 0 },
      { id: 'angle-grinder', name: 'Angle Grinder', retailPrice: 120, dailyRate: 6.00, quantity: 0 },
      { id: 'drilling-kit', name: 'Diamond Drilling Kit', retailPrice: 150, dailyRate: 7.50, quantity: 0 },
    ],
  },
  {
    id: 'installation',
    name: 'Installation Tools',
    items: [
      { id: 'trowel', name: 'Notched Trowel', retailPrice: 25, dailyRate: 1.25, quantity: 0 },
      { id: 'margin-trowel', name: 'Margin Trowel', retailPrice: 15, dailyRate: 0.75, quantity: 0 },
      { id: 'sponges', name: 'Sponge 3-Pack', retailPrice: 12, dailyRate: 0.60, quantity: 0, isConsumable: true },
    ],
  },
];

export const addOnCategories: AddOnCategory[] = [
  {
    id: 'demo',
    name: 'Tile Flooring Demo',
    items: [
      { id: 'pry-bar', name: 'Pry Bar', retailPrice: 25, dailyRate: 1.25, quantity: 0 },
      { id: 'jackhammer', name: 'Electric Jackhammer', retailPrice: 400, dailyRate: 20.00, quantity: 0 },
    ],
  },
  {
    id: 'leveler',
    name: 'Self-Leveler Application',
    items: [
      { id: 'gauge-rake', name: 'Gauge Rake', retailPrice: 60, dailyRate: 3.00, quantity: 0 },
      { id: 'spiked-shoes', name: 'Spiked Shoes', retailPrice: 40, dailyRate: 2.00, quantity: 0 },
    ],
  },
  {
    id: 'baseboard',
    name: 'Wood Baseboard Install',
    items: [
      { id: 'miter-saw', name: 'Miter Saw', retailPrice: 350, dailyRate: 17.50, quantity: 0 },
      { id: 'nail-gun', name: 'Brad Nail Gun', retailPrice: 200, dailyRate: 10.00, quantity: 0 },
      { id: 'angle-finder', name: 'Digital Angle Finder', retailPrice: 45, dailyRate: 2.25, quantity: 0 },
    ],
  },
  {
    id: 'toilet',
    name: 'Toilet Install',
    items: [
      { id: 'adjustable-wrench', name: 'Adjustable Wrench Set', retailPrice: 35, dailyRate: 1.75, quantity: 0 },
      { id: 'wax-ring', name: 'Wax Ring', retailPrice: 8, dailyRate: 0.40, quantity: 0, isConsumable: true },
    ],
  },
  {
    id: 'dishwasher',
    name: 'Dishwasher Removal / Install',
    items: [
      { id: 'appliance-dolly', name: 'Appliance Dolly', retailPrice: 150, dailyRate: 7.50, quantity: 0 },
      { id: 'pliers-set', name: 'Pliers Set', retailPrice: 40, dailyRate: 2.00, quantity: 0 },
    ],
  },
];

export const consumables: RentalItem[] = [
  { id: 'thinset', name: 'Thinset Mortar (50lb bag)', retailPrice: 25, dailyRate: 25, quantity: 0, isConsumable: true },
  { id: 'caulk', name: 'Silicone Caulk', retailPrice: 12, dailyRate: 12, quantity: 0, isConsumable: true },
];

export const tileSizes = [
  { value: '12x12', label: '12" x 12"' },
  { value: '12x24', label: '12" x 24"' },
  { value: '18x18', label: '18" x 18"' },
  { value: '24x24', label: '24" x 24"' },
  { value: '6x24', label: '6" x 24" (Plank)' },
  { value: '8x48', label: '8" x 48" (Large Plank)' },
];
