import { EquipmentCategory, AddOnCategory, RentalItem } from '@/types/rental';

export const equipmentCategories: EquipmentCategory[] = [
  {
    id: 'safety',
    name: 'Safety Gear',
    items: [
      { 
        id: 'glasses', 
        name: 'Safety Glasses', 
        retailPrice: 15, 
        dailyRate: 0.75, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=100&h=100&fit=crop',
        description: 'ANSI Z87.1 rated safety glasses with anti-fog coating. Essential protection when cutting tile to prevent debris from entering your eyes.',
        usage: 'Wear at all times when operating power tools, especially wet saws and angle grinders. Clean lenses regularly for clear visibility.',
        images: [
          'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&h=300&fit=crop'
        ]
      },
      { 
        id: 'knee-pads', 
        name: 'Knee Pads', 
        retailPrice: 35, 
        dailyRate: 1.75, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: 'Professional-grade gel knee pads with adjustable straps. Designed for extended kneeling on hard surfaces during tile installation.',
        usage: 'Adjust straps for a secure but comfortable fit. Position gel pad directly over kneecap. Replace if gel becomes compressed.',
        specifications: [
          { label: 'Padding Type', value: 'Gel Core' },
          { label: 'Shell', value: 'Hard Plastic' }
        ]
      },
      { 
        id: 'respirator', 
        name: 'Respirator', 
        retailPrice: 30, 
        dailyRate: 1.50, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=100&h=100&fit=crop',
        description: 'N95-rated respirator mask for protection against tile dust, thinset particles, and grout powder. Essential for cutting and mixing.',
        usage: 'Ensure a proper seal around nose and mouth. Replace filters when breathing becomes difficult or after extended dusty work.'
      },
    ],
  },
  {
    id: 'layout',
    name: 'Tile Layout',
    items: [
      { 
        id: 'chalk-line', 
        name: 'Chalk Line', 
        retailPrice: 12, 
        dailyRate: 0.60, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: 'Professional chalk line reel with 100ft line. Creates straight reference lines on your subfloor for accurate tile placement.',
        usage: 'Hook end at starting point, extend line to endpoint, hold taut, and snap against floor. Re-chalk after every few snaps.'
      },
      { 
        id: 'laser-line', 
        name: 'Laser Line', 
        retailPrice: 120, 
        dailyRate: 6.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=100&h=100&fit=crop',
        description: 'Self-leveling cross-line laser for precise 90° layout. Projects visible lines on floor and walls for perfect alignment.',
        usage: 'Place on stable surface, allow to self-level (takes 3-5 seconds), align first tile row to laser line. Works best in lower light.',
        specifications: [
          { label: 'Accuracy', value: '±1/8" at 30ft' },
          { label: 'Range', value: '65 feet' }
        ]
      },
    ],
  },
  {
    id: 'mixing',
    name: 'Thinset Mixing',
    items: [
      { 
        id: 'mixer', 
        name: 'Mixer Drill', 
        retailPrice: 180, 
        dailyRate: 9.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: 'Heavy-duty low-speed mixer drill with paddle attachment. Designed specifically for mixing thinset, grout, and self-leveler.',
        usage: 'Add dry thinset to water (not water to thinset). Mix on low speed until smooth, peanut-butter consistency. Let slake 10 minutes, remix.',
        specifications: [
          { label: 'Speed', value: '0-550 RPM' },
          { label: 'Paddle Size', value: '4" diameter' }
        ]
      },
      { 
        id: 'bucket-liners', 
        name: 'Bucket Liners (5-pack)', 
        retailPrice: 10, 
        dailyRate: 10, 
        quantity: 0, 
        isConsumable: true, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: 'Disposable 5-gallon bucket liners for easy cleanup. Simply lift out dried thinset instead of chipping it from the bucket.',
        usage: 'Line bucket before mixing. When thinset begins to set, remove liner with material inside. Use fresh liner for each batch.'
      },
    ],
  },
  {
    id: 'cutting',
    name: 'Cutting Tools',
    items: [
      { 
        id: 'wet-saw-large', 
        name: 'Wet Saw (Large)', 
        retailPrice: 600, 
        dailyRate: 30.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop', 
        booqableId: 'tile-saw',
        description: '10" professional wet saw with sliding table. Handles large format tiles up to 24" diagonal. Water reservoir minimizes dust and keeps blade cool.',
        usage: 'Fill reservoir with clean water. Score tile surface first, then make full cut. Support large tiles to prevent cracking. Clean blade after use.',
        specifications: [
          { label: 'Blade Size', value: '10 inch' },
          { label: 'Max Cut Length', value: '24 inches' },
          { label: 'Motor', value: '1.5 HP' }
        ],
        images: [
          'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop'
        ]
      },
      { 
        id: 'wet-saw-small', 
        name: 'Wet Saw (Small)', 
        retailPrice: 300, 
        dailyRate: 15.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: '7" tabletop wet saw ideal for small to medium tiles. Compact and portable, perfect for bathroom and backsplash projects.',
        usage: 'Ensure water pump is submerged. Guide tile slowly through blade—don\'t force it. Ideal for straight cuts on tiles under 12".',
        specifications: [
          { label: 'Blade Size', value: '7 inch' },
          { label: 'Max Cut Length', value: '14 inches' }
        ]
      },
      { 
        id: 'manual-cutter', 
        name: 'Manual Tile Cutter', 
        retailPrice: 80, 
        dailyRate: 4.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=100&h=100&fit=crop',
        description: '24" manual tile cutter with tungsten carbide scoring wheel. Quick, dust-free straight cuts on ceramic and porcelain tile.',
        usage: 'Score tile surface in one firm pass. Position breaker bar over score line and apply even downward pressure to snap tile cleanly.'
      },
      { 
        id: 'angle-grinder', 
        name: 'Angle Grinder', 
        retailPrice: 120, 
        dailyRate: 6.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: '4.5" angle grinder with diamond blade for curved cuts, notches, and outlets. Essential for complex cuts wet saws can\'t handle.',
        usage: 'Always use with safety glasses and respirator. Score cut line first, then make multiple shallow passes. Creates significant dust—work outside if possible.'
      },
      { 
        id: 'drilling-kit', 
        name: 'Diamond Drilling Kit', 
        retailPrice: 150, 
        dailyRate: 7.50, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: 'Diamond core bit set (1/4" to 2") for drilling holes in tile for fixtures, pipes, and outlets. Includes guide template.',
        usage: 'Use guide template for positioning. Start at 45° angle, then go vertical. Keep wet with sponge. Drill slowly with light pressure.',
        specifications: [
          { label: 'Bit Sizes', value: '1/4", 1/2", 3/4", 1", 1.5", 2"' },
          { label: 'Shank', value: '3/8" hex' }
        ]
      },
    ],
  },
  {
    id: 'installation',
    name: 'Installation Tools',
    items: [
      { 
        id: 'trowel', 
        name: 'Notched Trowel', 
        retailPrice: 25, 
        dailyRate: 1.25, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: '1/4" x 3/8" square-notch trowel for medium to large tiles. Creates consistent thinset ridges for proper tile adhesion.',
        usage: 'Apply thinset with flat edge, then comb with notched edge at 45° angle. Work in small sections—thinset skins over in 10-15 minutes.'
      },
      { 
        id: 'margin-trowel', 
        name: 'Margin Trowel', 
        retailPrice: 15, 
        dailyRate: 0.75, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: '5" margin trowel for scooping thinset, back-buttering tiles, and working in tight spaces near walls and corners.',
        usage: 'Use to scoop thinset from bucket. Back-butter large format tiles for 100% coverage. Clean frequently to prevent buildup.'
      },
      { 
        id: 'sponges', 
        name: 'Sponge 3-Pack', 
        retailPrice: 12, 
        dailyRate: 12, 
        quantity: 0, 
        isConsumable: true, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: 'Professional grouting sponges with rounded corners. High-density foam for smooth grout finishing without pulling.',
        usage: 'Wring out thoroughly—sponge should be damp, not wet. Wipe diagonally across grout lines. Rinse and wring frequently.'
      },
    ],
  },
];

export const addOnCategories: AddOnCategory[] = [
  {
    id: 'demo',
    name: 'Tile Flooring Demo',
    description: 'Tools for removing existing tile, vinyl, or other flooring materials before installing new tile.',
    selectionGuidance: 'If you have tile or mortar bed, choose the jackhammer. For vinyl or thin-set only, the pry bar alone may suffice.',
    items: [
      { 
        id: 'pry-bar', 
        name: 'Pry Bar', 
        retailPrice: 25, 
        dailyRate: 1.25, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: 'Heavy-duty 18" pry bar for removing existing tile, baseboards, and underlayment. Forged steel construction.',
        usage: 'Start at edges or damaged areas. Work pry bar under tile at low angle. Leverage against floor to pop tiles up.'
      },
      { 
        id: 'jackhammer', 
        name: 'Electric Jackhammer', 
        retailPrice: 400, 
        dailyRate: 20.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: 'Electric demolition hammer with chisel bit for stubborn tile and mortar bed removal. Much easier than manual removal.',
        usage: 'Wear hearing protection. Work at shallow angle under tiles. Let the tool do the work—don\'t force it. Take breaks to avoid fatigue.',
        specifications: [
          { label: 'Impact Energy', value: '8.5 ft-lbs' },
          { label: 'Weight', value: '22 lbs' }
        ]
      },
    ],
  },
  {
    id: 'leveler',
    name: 'Self-Leveler Application',
    description: 'Equipment for applying self-leveling compound to create a flat substrate before tile installation.',
    selectionGuidance: 'Both items are recommended if your floor has dips or unevenness greater than 1/4". The spiked shoes let you spread to all edges.',
    items: [
      { 
        id: 'gauge-rake', 
        name: 'Gauge Rake', 
        retailPrice: 60, 
        dailyRate: 3.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: 'Adjustable gauge rake for spreading self-leveling compound to consistent depth. Settings from 1/8" to 2".',
        usage: 'Set pins to desired depth. Pour leveler and immediately spread with rake. Work quickly—leveler sets fast.'
      },
      { 
        id: 'spiked-shoes', 
        name: 'Spiked Shoes', 
        retailPrice: 40, 
        dailyRate: 2.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: 'Strap-on spiked shoes for walking on wet self-leveler without leaving marks. Allows you to spread to edges.',
        usage: 'Strap securely over work boots. Lift feet straight up when walking—don\'t drag. Clean spikes before leveler hardens.'
      },
    ],
  },
  {
    id: 'baseboard',
    name: 'Wood Baseboard Install',
    description: 'Professional tools for cutting and installing wood baseboards after tile installation is complete.',
    selectionGuidance: 'The miter saw and nail gun are essential. Add the angle finder only if your home has non-standard (non-90°) corners.',
    items: [
      { 
        id: 'miter-saw', 
        name: 'Miter Saw', 
        retailPrice: 350, 
        dailyRate: 17.50, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: '10" compound miter saw for precise baseboard angle cuts. Essential for professional-looking inside and outside corners.',
        usage: 'For inside corners: cut at 45° with baseboard against fence. For outside corners: opposite 45°. Always cut longer first, then trim to fit.',
        specifications: [
          { label: 'Blade Size', value: '10 inch' },
          { label: 'Miter Range', value: '0-52° L/R' }
        ]
      },
      { 
        id: 'nail-gun', 
        name: 'Brad Nail Gun', 
        retailPrice: 200, 
        dailyRate: 10.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: '18-gauge brad nailer for attaching baseboards. Uses 3/4" to 2" brads. Cordless battery-powered for easy mobility.',
        usage: 'Nail into studs when possible (every 16"). Angle slightly downward. Set nails just below surface, then fill holes with wood putty.'
      },
      { 
        id: 'angle-finder', 
        name: 'Digital Angle Finder', 
        retailPrice: 45, 
        dailyRate: 2.25, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=100&h=100&fit=crop',
        description: 'Digital angle finder for measuring non-90° corners. Displays the exact miter saw setting needed for perfect fits.',
        usage: 'Place legs against both walls of corner. Read display for total angle, divide by 2 for miter saw setting.'
      },
    ],
  },
  {
    id: 'toilet',
    name: 'Toilet Install',
    description: 'Tools and supplies for removing and reinstalling a toilet when tiling a bathroom floor.',
    selectionGuidance: 'You\'ll need both items—the wax ring creates the seal and the wrenches tighten the mounting bolts.',
    items: [
      { 
        id: 'adjustable-wrench', 
        name: 'Adjustable Wrench Set', 
        retailPrice: 35, 
        dailyRate: 1.75, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: 'Set of 3 adjustable wrenches (8", 10", 12") for toilet supply lines and mounting bolts.',
        usage: 'Hand-tighten toilet bolts first, then snug with wrench—don\'t overtighten or you\'ll crack the porcelain.'
      },
      { 
        id: 'wax-ring', 
        name: 'Wax Ring', 
        retailPrice: 8, 
        dailyRate: 8, 
        quantity: 0, 
        isConsumable: true, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: 'Standard wax ring with integrated flange for sealing toilet to floor drain. Creates watertight seal.',
        usage: 'Place wax ring on flange (wax side up). Lower toilet straight down—no twisting. Press down firmly to seat.'
      },
    ],
  },
  {
    id: 'dishwasher',
    name: 'Dishwasher Removal / Install',
    description: 'Equipment for safely disconnecting, moving, and reinstalling a dishwasher during kitchen floor tiling.',
    selectionGuidance: 'The dolly is essential for moving the appliance safely. Pliers are needed for water line connections.',
    items: [
      { 
        id: 'appliance-dolly', 
        name: 'Appliance Dolly', 
        retailPrice: 150, 
        dailyRate: 7.50, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
        description: 'Appliance dolly with straps for safely moving dishwashers, refrigerators, and other heavy appliances.',
        usage: 'Tilt appliance forward, slide dolly underneath, secure straps. Tilt back onto wheels. Use two people for heavy items.'
      },
      { 
        id: 'pliers-set', 
        name: 'Pliers Set', 
        retailPrice: 40, 
        dailyRate: 2.00, 
        quantity: 0, 
        imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=100&h=100&fit=crop',
        description: 'Pliers set including channel locks and needle nose for water supply line connections and hose clamps.',
        usage: 'Use channel locks for supply line compression fittings. Needle nose for hose clamps. Don\'t use pliers on chrome fittings.'
      },
    ],
  },
];

export const consumables: RentalItem[] = [
  { 
    id: 'thinset', 
    name: 'Thinset Mortar (50lb bag)', 
    retailPrice: 25, 
    dailyRate: 25, 
    quantity: 0, 
    isConsumable: true, 
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
    description: 'Professional-grade modified thinset mortar. Polymer-enhanced for improved bond strength and flexibility.',
    usage: 'Mix with clean water to peanut butter consistency. Let slake 10 minutes, remix. Apply within 2-3 hours of mixing.'
  },
  { 
    id: 'caulk', 
    name: 'Silicone Caulk', 
    retailPrice: 12, 
    dailyRate: 12, 
    quantity: 0, 
    isConsumable: true, 
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
    description: 'Color-matched silicone caulk for perimeter joints, corners, and transitions. Flexible and waterproof.',
    usage: 'Apply after grout has cured 24+ hours. Cut tip at 45°. Apply steady bead, smooth with wet finger. Remove tape immediately.'
  },
  { 
    id: 'grout', 
    name: 'Grout (10lb bag)', 
    retailPrice: 18, 
    dailyRate: 18, 
    quantity: 0, 
    isConsumable: true, 
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
    description: 'Sanded grout for joints 1/8" and larger. Stain-resistant formula. Available in multiple colors.',
    usage: 'Wait 24 hours after tiling. Work grout diagonally into joints. Clean excess after 15-20 minutes. Cure 24 hours before sealing.'
  },
  { 
    id: 'spacers', 
    name: 'Tile Spacers (100-pack)', 
    retailPrice: 8, 
    dailyRate: 8, 
    quantity: 0, 
    isConsumable: true, 
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop',
    description: '1/8" tile spacers for consistent grout line width. T-shape design works at corners and edges.',
    usage: 'Insert at each tile corner. Can stand upright or lay flat. Remove before grouting—don\'t grout over spacers.'
  },
];

import tileSmallImg from '@/assets/tile-small.png';
import tileMediumImg from '@/assets/tile-medium.png';
import tileLowLargeImg from '@/assets/tile-low-large.png';
import tileLargeFormatImg from '@/assets/tile-large-format.png';
import underlaymentMembraneImg from '@/assets/underlayment-membrane.jpg';
import underlaymentConcreteBoardImg from '@/assets/underlayment-concrete-board.jpg';

export const tileSizes = [
  { 
    value: 'small', 
    label: 'Small (<6")', 
    imageUrl: tileSmallImg,
    description: 'Mosaic & small format tiles'
  },
  { 
    value: 'medium', 
    label: 'Medium (6–12")', 
    imageUrl: tileMediumImg,
    description: 'Standard bathroom & kitchen tiles'
  },
  { 
    value: 'low-large', 
    label: 'Low-Large (12–18")', 
    imageUrl: tileLowLargeImg,
    description: 'Floor tiles & accent walls'
  },
  { 
    value: 'large-format', 
    label: 'Large Format (18"+)', 
    imageUrl: tileLargeFormatImg,
    description: 'Modern floor & wall panels'
  },
];

export const underlaymentOptions = [
  { 
    value: 'membrane', 
    label: 'Membrane', 
    imageUrl: underlaymentMembraneImg,
    description: 'Waterproof & crack isolation'
  },
  { 
    value: 'concrete-board', 
    label: 'Concrete Board', 
    imageUrl: underlaymentConcreteBoardImg,
    description: 'Cement backer board substrate'
  },
];

export const squareFootageBuckets = [
  { value: '10-50', label: '10–50 sq ft', min: 10, max: 50 },
  { value: '50-100', label: '50–100 sq ft', min: 50, max: 100 },
  { value: '100+', label: '100+ sq ft', min: 100, max: 500 },
];
