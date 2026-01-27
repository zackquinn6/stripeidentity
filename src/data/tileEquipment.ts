import { EquipmentCategory, AddOnCategory, RentalItem } from '@/types/rental';

export const equipmentCategories: EquipmentCategory[] = [
  {
    id: 'safety',
    name: 'Safety Gear',
    items: [
      { id: 'glasses', name: 'Safety Glasses', retailPrice: 15, dailyRate: 0.75, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=100&h=100&fit=crop' },
      { id: 'knee-pads', name: 'Knee Pads', retailPrice: 35, dailyRate: 1.75, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
      { id: 'respirator', name: 'Respirator', retailPrice: 30, dailyRate: 1.50, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'layout',
    name: 'Tile Layout',
    items: [
      { id: 'chalk-line', name: 'Chalk Line', retailPrice: 12, dailyRate: 0.60, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'laser-line', name: 'Laser Line', retailPrice: 120, dailyRate: 6.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'mixing',
    name: 'Thinset Mixing',
    items: [
      { id: 'mixer', name: 'Mixer Drill', retailPrice: 180, dailyRate: 9.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'bucket-liners', name: 'Bucket Liners (5-pack)', retailPrice: 10, dailyRate: 10, quantity: 0, isConsumable: true, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'cutting',
    name: 'Cutting Tools',
    items: [
      { id: 'wet-saw-large', name: 'Wet Saw (Large)', retailPrice: 600, dailyRate: 30.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'wet-saw-small', name: 'Wet Saw (Small)', retailPrice: 300, dailyRate: 15.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'manual-cutter', name: 'Manual Tile Cutter', retailPrice: 80, dailyRate: 4.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=100&h=100&fit=crop' },
      { id: 'angle-grinder', name: 'Angle Grinder', retailPrice: 120, dailyRate: 6.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'drilling-kit', name: 'Diamond Drilling Kit', retailPrice: 150, dailyRate: 7.50, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'installation',
    name: 'Installation Tools',
    items: [
      { id: 'trowel', name: 'Notched Trowel', retailPrice: 25, dailyRate: 1.25, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
      { id: 'margin-trowel', name: 'Margin Trowel', retailPrice: 15, dailyRate: 0.75, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
      { id: 'sponges', name: 'Sponge 3-Pack', retailPrice: 12, dailyRate: 12, quantity: 0, isConsumable: true, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
    ],
  },
];

export const addOnCategories: AddOnCategory[] = [
  {
    id: 'demo',
    name: 'Tile Flooring Demo',
    items: [
      { id: 'pry-bar', name: 'Pry Bar', retailPrice: 25, dailyRate: 1.25, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'jackhammer', name: 'Electric Jackhammer', retailPrice: 400, dailyRate: 20.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'leveler',
    name: 'Self-Leveler Application',
    items: [
      { id: 'gauge-rake', name: 'Gauge Rake', retailPrice: 60, dailyRate: 3.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
      { id: 'spiked-shoes', name: 'Spiked Shoes', retailPrice: 40, dailyRate: 2.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'baseboard',
    name: 'Wood Baseboard Install',
    items: [
      { id: 'miter-saw', name: 'Miter Saw', retailPrice: 350, dailyRate: 17.50, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'nail-gun', name: 'Brad Nail Gun', retailPrice: 200, dailyRate: 10.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'angle-finder', name: 'Digital Angle Finder', retailPrice: 45, dailyRate: 2.25, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'toilet',
    name: 'Toilet Install',
    items: [
      { id: 'adjustable-wrench', name: 'Adjustable Wrench Set', retailPrice: 35, dailyRate: 1.75, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
      { id: 'wax-ring', name: 'Wax Ring', retailPrice: 8, dailyRate: 8, quantity: 0, isConsumable: true, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
    ],
  },
  {
    id: 'dishwasher',
    name: 'Dishwasher Removal / Install',
    items: [
      { id: 'appliance-dolly', name: 'Appliance Dolly', retailPrice: 150, dailyRate: 7.50, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
      { id: 'pliers-set', name: 'Pliers Set', retailPrice: 40, dailyRate: 2.00, quantity: 0, imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop' },
    ],
  },
];

export const consumables: RentalItem[] = [
  { id: 'thinset', name: 'Thinset Mortar (50lb bag)', retailPrice: 25, dailyRate: 25, quantity: 0, isConsumable: true, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
  { id: 'caulk', name: 'Silicone Caulk', retailPrice: 12, dailyRate: 12, quantity: 0, isConsumable: true, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
  { id: 'grout', name: 'Grout (10lb bag)', retailPrice: 18, dailyRate: 18, quantity: 0, isConsumable: true, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
  { id: 'spacers', name: 'Tile Spacers (100-pack)', retailPrice: 8, dailyRate: 8, quantity: 0, isConsumable: true, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop' },
];

export const tileSizes = [
  { value: '12x12', label: '12" x 12"' },
  { value: '12x24', label: '12" x 24"' },
  { value: '18x18', label: '18" x 18"' },
  { value: '24x24', label: '24" x 24"' },
  { value: '6x24', label: '6" x 24" (Plank)' },
  { value: '8x48', label: '8" x 48" (Large Plank)' },
];
