import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Check, Package, Plus, Sparkles, ArrowLeft, ArrowRight, CalendarDays, Trash2, Calculator, HelpCircle, Loader2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { tileSizes, underlaymentOptions } from '@/data/tileEquipment';
import { EquipmentCategory, AddOnCategory, RentalItem } from '@/types/rental';
import EquipmentItem from './EquipmentItem';
import AddOnModal from './AddOnModal';
import CheckoutSummary from './CheckoutSummary';
import QuantitySelector from './QuantitySelector';
import RentalDatePicker, { RentalDuration, durationOptions } from './RentalDatePicker';
import PackageValueCard from './PackageValueCard';
import ItemDetailsModal from './ItemDetailsModal';
import { format, nextFriday, isFriday, startOfDay, addDays } from 'date-fns';
import { useProjectSections } from '@/hooks/useProjectItems';
import { useRushOrderItem } from '@/hooks/useRushOrderItem';

interface TileOrderingFlowProps {
  onBack: () => void;
}
interface TileArea {
  id: string;
  squareFootage: string;
  tileSize: string;
}
const TileOrderingFlow = ({
  onBack
}: TileOrderingFlowProps) => {
  // Fetch all sections from database (admin-configured)
  const { data: projectData, isLoading: sectionsLoading } = useProjectSections('tile-flooring');
  
  // Fetch rush order item from Booqable
  const { rushOrderItem } = useRushOrderItem();

  // Step 1: Multi-select for tile sizes and underlayment
  const [selectedTileSizes, setSelectedTileSizes] = useState<string[]>([]);
  const [selectedUnderlayment, setSelectedUnderlayment] = useState<string[]>([]);

  // Materials auto-calculator state (moved from step 1)
  const [tileAreas, setTileAreas] = useState<TileArea[]>([{
    id: '1',
    squareFootage: '',
    tileSize: ''
  }]);
  const [exactSquareFootage, setExactSquareFootage] = useState<string>('');
  const [equipment, setEquipment] = useState<EquipmentCategory[]>([]);
  const [addOns, setAddOns] = useState<AddOnCategory[]>([]);
  const [materials, setMaterials] = useState<RentalItem[]>([]);
  const [rushOrderAdded, setRushOrderAdded] = useState<RentalItem | null>(null);
  const [activeAddOn, setActiveAddOn] = useState<AddOnCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<RentalItem | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>('step-1');

  // Update state when database data loads
  useEffect(() => {
    if (projectData) {
      // Update equipment from database, preserving user quantities
      if (projectData.equipment.length > 0) {
        setEquipment(prev => {
          if (prev.length === 0) return projectData.equipment;
          return projectData.equipment.map(cat => {
            const prevCat = prev.find(p => p.id === cat.id);
            return {
              ...cat,
              items: cat.items.map(item => {
                const prevItem = prevCat?.items.find(i => i.id === item.id);
                return { ...item, quantity: prevItem?.quantity ?? item.quantity };
              })
            };
          });
        });
      }

      // Update add-ons from database, preserving user quantities
      if (projectData.addOns.length > 0) {
        setAddOns(prev => {
          if (prev.length === 0) return projectData.addOns;
          return projectData.addOns.map(cat => {
            const prevCat = prev.find(p => p.id === cat.id);
            return {
              ...cat,
              items: cat.items.map(item => {
                const prevItem = prevCat?.items.find(i => i.id === item.id);
                return { ...item, quantity: prevItem?.quantity ?? item.quantity };
              })
            };
          });
        });
      }

      // Update consumables from database, preserving user quantities
      if (projectData.consumables.length > 0) {
        setMaterials(prev => {
          if (prev.length === 0) return projectData.consumables;
          return projectData.consumables.map(item => {
            const prevItem = prev.find(p => p.id === item.id);
            return { ...item, quantity: prevItem?.quantity ?? item.quantity };
          });
        });
      }
    }
  }, [projectData]);
  // Rental date state
  const [rentalDuration, setRentalDuration] = useState<RentalDuration>('daily');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const exactSqft = parseFloat(exactSquareFootage) || 0;
  const thinsetBags = Math.ceil(exactSqft / 10);

  // Helper to check if a date is a rush order (within 48 hours)
  const isRushDate = (date: Date | undefined): boolean => {
    if (!date) return false;
    const today = startOfDay(new Date());
    const rushEnd = addDays(today, 2); // Within 48 hours
    const dateStart = startOfDay(date);
    return dateStart > today && dateStart <= rushEnd;
  };

  // Auto-add/remove rush order based on start date
  useEffect(() => {
    if (!rushOrderItem) return;
    
    const shouldAddRush = isRushDate(startDate);
    
    if (shouldAddRush && !rushOrderAdded) {
      // Add rush order item with quantity 1
      setRushOrderAdded({ ...rushOrderItem, quantity: 1 });
      console.log('[TileOrderingFlow] Auto-added rush order processing fee');
    } else if (!shouldAddRush && rushOrderAdded) {
      // Remove rush order item
      setRushOrderAdded(null);
      console.log('[TileOrderingFlow] Removed rush order processing fee');
    }
  }, [startDate, rushOrderItem, rushOrderAdded]);

  // Calculate suggested quantity for a material based on scaling config and tile areas
  const calculateSuggestedQuantity = (item: RentalItem): number | null => {
    if (!item.scalingPer100Sqft || !item.scalingTileSize) return null;
    
    // Map our tile size values to scaling config values
    const tileSizeMapping: Record<string, string> = {
      'small': 'small',
      'medium': 'medium', 
      'large': 'large',
      'extra-large': 'large' // extra-large uses large format scaling
    };
    
    let applicableSqft = 0;
    
    for (const area of tileAreas) {
      const sqft = parseFloat(area.squareFootage) || 0;
      if (sqft <= 0) continue;
      
      const mappedSize = tileSizeMapping[area.tileSize] || area.tileSize;
      
      // Check if this material applies to this tile size
      if (item.scalingTileSize === 'all' || item.scalingTileSize === mappedSize) {
        applicableSqft += sqft;
      }
    }
    
    if (applicableSqft <= 0) return null;
    
    // Calculate quantity: (sqft / 100) * unitsPerHundred, rounded up
    const rawQuantity = (applicableSqft / 100) * item.scalingPer100Sqft;
    return Math.ceil(rawQuantity);
  };

  // Get total square footage from tile areas
  const getTotalSqftForSize = (scalingTileSize: string): number => {
    const tileSizeMapping: Record<string, string> = {
      'small': 'small',
      'medium': 'medium',
      'large': 'large', 
      'extra-large': 'large'
    };
    
    let total = 0;
    for (const area of tileAreas) {
      const sqft = parseFloat(area.squareFootage) || 0;
      const mappedSize = tileSizeMapping[area.tileSize] || area.tileSize;
      if (scalingTileSize === 'all' || scalingTileSize === mappedSize) {
        total += sqft;
      }
    }
    return total;
  };

  // Booqable script is now loaded globally in App via useBooqable().

  // Step 1 is complete when at least one tile size is selected
  const step1Complete = selectedTileSizes.length > 0;

  // Toggle functions for multi-select
  const toggleTileSize = (value: string) => {
    setSelectedTileSizes(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };
  const toggleUnderlayment = (value: string) => {
    setSelectedUnderlayment(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };
  const step2Complete = equipment.some(cat => cat.items.some(item => item.quantity > 0));
  const [step3Visited, setStep3Visited] = useState(false);
  const step3Complete = step3Visited && openAccordion !== 'step-3';
  const step4Complete = !!startDate && (rentalDuration !== 'daily' || !!endDate);
  const [step5Visited, setStep5Visited] = useState(false);
  const step5Complete = step5Visited && openAccordion !== 'step-5';

  // Track which steps have already auto-advanced (only advance once)
  const [advancedSteps, setAdvancedSteps] = useState<Set<string>>(new Set());

  // Note: Project sizing (step-1) does not auto-advance - users should manually proceed

  // Note: Equipment selection (step-2) does not auto-advance - only via comprehensive button

  // Note: Add-ons step does not auto-advance - users should manually proceed

  useEffect(() => {
    if (step4Complete && openAccordion === 'step-4' && !advancedSteps.has('step-4')) {
      setAdvancedSteps(prev => new Set(prev).add('step-4'));
      setOpenAccordion('step-5');
    }
  }, [step4Complete, openAccordion, advancedSteps]);
  const getRentalDays = () => {
    if (rentalDuration === 'daily' && startDate && endDate) {
      return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    return durationOptions.find(o => o.value === rentalDuration)?.days || 3;
  };
  const rentalDays = getRentalDays();
  const handleEquipmentQuantityChange = (categoryId: string, itemId: string, quantity: number) => {
    setEquipment(prev => prev.map(cat => cat.id === categoryId ? {
      ...cat,
      items: cat.items.map(item => item.id === itemId ? {
        ...item,
        quantity
      } : item)
    } : cat));
  };
  const handleAddOnQuantityChange = (categoryId: string, itemId: string, quantity: number) => {
    setAddOns(prev => prev.map(cat => cat.id === categoryId ? {
      ...cat,
      items: cat.items.map(item => item.id === itemId ? {
        ...item,
        quantity
      } : item)
    } : cat));
  };
  const handleMaterialQuantityChange = (itemId: string, quantity: number) => {
    setMaterials(prev => prev.map(item => item.id === itemId ? {
      ...item,
      quantity
    } : item));
  };
  const handleItemClick = (item: RentalItem) => {
    setSelectedItem(item);
  };
  const handleItemQuantityChangeFromModal = (itemId: string, quantity: number) => {
    // Check if item is in equipment
    for (const cat of equipment) {
      if (cat.items.some(i => i.id === itemId)) {
        handleEquipmentQuantityChange(cat.id, itemId, quantity);
        // Update selectedItem to reflect new quantity
        setSelectedItem(prev => prev?.id === itemId ? {
          ...prev,
          quantity
        } : prev);
        return;
      }
    }
    // Check if item is in addOns
    for (const cat of addOns) {
      if (cat.items.some(i => i.id === itemId)) {
        handleAddOnQuantityChange(cat.id, itemId, quantity);
        setSelectedItem(prev => prev?.id === itemId ? {
          ...prev,
          quantity
        } : prev);
        return;
      }
    }
    // Check materials
    if (materials.some(i => i.id === itemId)) {
      handleMaterialQuantityChange(itemId, quantity);
      setSelectedItem(prev => prev?.id === itemId ? {
        ...prev,
        quantity
      } : prev);
    }
  };
  const handleSelectEssentials = () => {
    // Default all items with valid Booqable links to quantity 1
    setEquipment(prev => prev.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({
        ...item,
        quantity: (item.imageUrl && !item.imageUrl.includes('unsplash')) ? 1 : 0
      }))
    })));
    setOpenAccordion('step-3');
  };

  const handleSelectComprehensive = () => {
    // Default all items with valid Booqable links to quantity 1
    setEquipment(prev => prev.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({
        ...item,
        quantity: (item.imageUrl && !item.imageUrl.includes('unsplash')) ? 1 : 0
      }))
    })));
    setOpenAccordion('step-3');
  };
  const getAllSelectedItems = useMemo((): RentalItem[] => {
    const equipmentItems = equipment.flatMap(cat => cat.items).filter(item => item.quantity > 0);
    const addOnItems = addOns.flatMap(cat => cat.items).filter(item => item.quantity > 0);
    const materialItems = materials.filter(item => item.quantity > 0);
    const allItems = [...equipmentItems, ...addOnItems, ...materialItems];
    
    // Add rush order fee if applicable
    if (rushOrderAdded && rushOrderAdded.quantity > 0) {
      allItems.push(rushOrderAdded);
    }
    
    return allItems;
  }, [equipment, addOns, materials, rushOrderAdded]);
  const getAddOnSummary = (category: AddOnCategory) => {
    const selected = category.items.filter(item => item.quantity > 0);
    if (selected.length === 0) {
      // Use category's selection guidance, or first item's guidance, or default
      const guidance = category.selectionGuidance 
        || category.items[0]?.selectionGuidance 
        || 'Click to customize';
      // Truncate to 50 characters for the front-facing card display
      return guidance.length > 50 ? `${guidance.slice(0, 50)}...` : guidance;
    }
    return `${selected.length} items selected`;
  };
  if (showCheckout) {
    return <div className="py-12 px-6">
        <CheckoutSummary items={getAllSelectedItems} rentalDays={rentalDays} startDate={startDate} onBack={() => setShowCheckout(false)} />
      </div>;
  }

  // Loading state while fetching from database
  if (sectionsLoading) {
    return (
      <div className="py-12 px-6 bg-background min-h-screen">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={onBack} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your package...</p>
          </div>
        </div>
      </div>
    );
  }
  return <div className="py-12 px-6 bg-background min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>

        <div className="mb-8">
          <PackageValueCard retailValue={900} packagePrice={495} />
          <p className="text-muted-foreground text-center mt-4">
            Configure your rental package in a few simple steps below.
          </p>
        </div>

        <Accordion type="single" collapsible value={openAccordion} onValueChange={value => {
        if (value === 'step-3') setStep3Visited(true);
        if (value === 'step-5') setStep5Visited(true);
        setOpenAccordion(value || '');
      }} className="space-y-4">
          {/* Step 1: Tile Sizing */}
          <AccordionItem value="step-1" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step1Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step1Complete ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Project Sizing</span>
                  {step1Complete && <span className="text-sm text-muted-foreground ml-3">
                      {selectedTileSizes.length} tile size{selectedTileSizes.length > 1 ? 's' : ''} selected
                    </span>}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-6 pt-2">
                {/* Tile Size Multi-Select */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Tile Size (select all that apply)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[280px] bg-popover text-popover-foreground">
                          <p className="font-semibold mb-1">Why tile size matters</p>
                          <p className="text-sm">Larger tiles require specialized equipment like lippage leveling systems and larger trowels. Select all sizes you'll be working with to ensure the right tools are recommended.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {tileSizes.map(size => {
                    const isSelected = selectedTileSizes.includes(size.value);
                    return <Card key={size.value} className={`cursor-pointer transition-all hover:shadow-md overflow-hidden ${isSelected ? 'ring-2 ring-primary border-primary' : 'border-border'}`} onClick={() => toggleTileSize(size.value)}>
                          <div className="relative">
                            <img src={size.imageUrl} alt={size.label} className="w-full h-20 object-cover" />
                            {isSelected && <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-4 h-4 text-primary-foreground" />
                              </div>}
                          </div>
                          <CardContent className="p-3">
                            <p className="font-medium text-sm">{size.label}</p>
                            <p className="text-xs text-muted-foreground">{size.description}</p>
                          </CardContent>
                        </Card>;
                  })}
                  </div>
                </div>

                {/* Underlayment Options Multi-Select */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Underlayment Options (optional)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[280px] bg-popover text-popover-foreground">
                          <p className="font-semibold mb-1">Why underlayment matters</p>
                          <p className="text-sm">Different underlayment types require specific cutting and installation tools. Membrane needs rollers and seam tape tools, while concrete board requires scoring tools and special screws.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {underlaymentOptions.map(option => {
                    const isSelected = selectedUnderlayment.includes(option.value);
                    return <Card key={option.value} className={`cursor-pointer transition-all hover:shadow-md overflow-hidden ${isSelected ? 'ring-2 ring-primary border-primary' : 'border-border'}`} onClick={() => toggleUnderlayment(option.value)}>
                          <div className="relative">
                            <img src={option.imageUrl} alt={option.label} className="w-full h-20 object-cover" />
                            {isSelected && <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-4 h-4 text-primary-foreground" />
                              </div>}
                          </div>
                          <CardContent className="p-3">
                            <p className="font-medium text-sm">{option.label}</p>
                            <p className="text-xs text-muted-foreground">{option.description}</p>
                          </CardContent>
                        </Card>;
                  })}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 2: Equipment Selection */}
          <AccordionItem value="step-2" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step2Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step2Complete ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Equipment Selection</span>
                  {step2Complete && <Badge variant="secondary" className="ml-3">
                      {equipment.flatMap(c => c.items).filter(i => i.quantity > 0).length} items
                    </Badge>}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Order</p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-dashed border-2 py-6 hover:border-primary hover:bg-secondary/50 text-foreground" 
                    onClick={handleSelectEssentials}
                  >
                    <Package className="w-5 h-5 mr-2 text-muted-foreground" />
                    Project Essentials
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-dashed border-2 py-6 bg-highlight border-highlight-border hover:border-primary hover:bg-highlight-hover text-foreground" 
                    onClick={handleSelectComprehensive}
                  >
                    <Sparkles className="w-5 h-5 mr-2 text-primary" />
                    Comprehensive
                  </Button>
                </div>
              </div>

              <div className="space-y-6">
                {equipment.map(category => {
                  // Filter out items without valid Booqable links (no imageUrl from Booqable)
                  const linkedItems = category.items.filter(item => item.imageUrl && !item.imageUrl.includes('unsplash'));
                  if (linkedItems.length === 0) return null;
                  
                  return (
                    <div key={category.id}>
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                        {category.name}
                      </h4>
                      <div className="space-y-2">
                        {linkedItems.map(item => <EquipmentItem key={item.id} item={item} onQuantityChange={(id, qty) => handleEquipmentQuantityChange(category.id, id, qty)} onItemClick={handleItemClick} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 3: Add-ons */}
          <AccordionItem value="step-3" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step3Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step3Complete ? <Check className="w-4 h-4" /> : '3'}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Add-ons</span>
                  {step3Complete && <Badge variant="secondary" className="ml-3">
                      {addOns.filter(c => c.items.some(i => i.quantity > 0)).length} packages
                    </Badge>}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <p className="text-muted-foreground mb-4">
                Optional add-on packages for related tasks.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {addOns.map(category => {
                const hasSelection = category.items.some(item => item.quantity > 0);
                return <Card key={category.id} className={`cursor-pointer transition-all hover:shadow-md ${hasSelection ? 'border-primary bg-primary/5' : ''}`} onClick={() => setActiveAddOn(category)}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{category.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {getAddOnSummary(category)}
                          </p>
                        </div>
                        {hasSelection ? <Check className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-muted-foreground" />}
                      </CardContent>
                    </Card>;
              })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 4: Rental Period */}
          <AccordionItem value="step-4" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step4Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step4Complete ? <Check className="w-4 h-4" /> : '4'}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Rental Period</span>
                  {step4Complete && startDate && <span className="text-sm text-muted-foreground ml-3">
                      {format(startDate, 'MMM d')} • {rentalDays} days
                    </span>}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <RentalDatePicker startDate={startDate} endDate={endDate} duration={rentalDuration} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onDurationChange={setRentalDuration} />
            </AccordionContent>
          </AccordionItem>

          {/* Step 5: Materials & Consumables */}
          <AccordionItem value="step-5" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step5Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step5Complete ? <Check className="w-4 h-4" /> : '5'}
                </div>
                <span className="font-display font-semibold text-lg text-left">
                  Materials & Consumables
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              {/* Materials Auto-Calculator Section */}
              <div className="mb-6 p-4 border rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold text-base">Materials Calculator</h4>
                </div>
                
                {selectedTileSizes.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enter the exact square footage for each tile size you selected in Project Sizing.
                    </p>
                    {selectedTileSizes.map((sizeValue) => {
                      const sizeInfo = tileSizes.find(t => t.value === sizeValue);
                      const area = tileAreas.find(a => a.tileSize === sizeValue);
                      return (
                        <div key={sizeValue} className="p-4 border rounded-lg bg-background">
                          <div className="flex items-center gap-3 mb-3">
                            {sizeInfo?.imageUrl && (
                              <img 
                                src={sizeInfo.imageUrl} 
                                alt={sizeInfo.label}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <span className="font-medium">{sizeInfo?.label}</span>
                              <p className="text-xs text-muted-foreground">{sizeInfo?.description}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Square Footage</Label>
                            <Input 
                              type="number" 
                              placeholder="Sq ft" 
                              value={area?.squareFootage || ''} 
                              onChange={e => {
                                const newValue = e.target.value;
                                setTileAreas(prev => {
                                  const existing = prev.find(a => a.tileSize === sizeValue);
                                  if (existing) {
                                    return prev.map(a => a.tileSize === sizeValue ? { ...a, squareFootage: newValue } : a);
                                  } else {
                                    return [...prev, { id: sizeValue, squareFootage: newValue, tileSize: sizeValue }];
                                  }
                                });
                              }} 
                              className="bg-background w-24" 
                              max={99999}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Please select tile sizes in the Project Sizing step first.
                  </p>
                )}
              </div>

              <p className="text-muted-foreground mb-4">
                Purchase materials for your project.
              </p>
              <div className="space-y-3">
                {materials.map(item => {
                  const suggestedQty = calculateSuggestedQuantity(item);
                  const applicableSqft = item.scalingTileSize ? getTotalSqftForSize(item.scalingTileSize) : 0;
                  
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-muted" />}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {item.scalingGuidance && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[280px] bg-popover text-popover-foreground">
                                    <p className="text-sm">{item.scalingGuidance}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            ${item.dailyRate.toFixed(2)} each
                          </p>
                          {suggestedQty !== null && applicableSqft > 0 && (
                            <p className="text-sm text-primary font-medium">
                              Suggested: {suggestedQty} for {applicableSqft.toLocaleString()} sq ft
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {suggestedQty !== null && applicableSqft > 0 && item.quantity !== suggestedQty && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleMaterialQuantityChange(item.id, suggestedQty)}
                            className="text-xs"
                          >
                            Use {suggestedQty}
                          </Button>
                        )}
                        <QuantitySelector quantity={item.quantity} onQuantityChange={qty => handleMaterialQuantityChange(item.id, qty)} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-amber-soft rounded-lg border border-amber-glow/20">
                <p className="text-sm">
                  <span className="font-semibold">📝 Note:</span> You'll need to buy tile and underlayment — we'll bring the rest.
                  We recommend <span className="text-primary font-medium">Floor & Decor</span>.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Checkout Button */}
        <div className="mt-8">
          <Button size="lg" className="w-full" disabled={!step1Complete || !step4Complete} onClick={() => setShowCheckout(true)}>
            View Checkout Summary
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          {(!step1Complete || !step4Complete) && <p className="text-center text-sm text-muted-foreground mt-2">
              {!step1Complete ? 'Please complete the tile sizing step to continue' : 'Please select a rental period to continue'}
            </p>}
        </div>
      </div>

      <AddOnModal category={activeAddOn ? addOns.find(c => c.id === activeAddOn.id) || null : null} open={!!activeAddOn} onClose={() => setActiveAddOn(null)} onQuantityChange={handleAddOnQuantityChange} onItemClick={handleItemClick} />

      <ItemDetailsModal item={selectedItem} open={!!selectedItem} onClose={() => setSelectedItem(null)} onQuantityChange={handleItemQuantityChangeFromModal} />
    </div>;
};
export default TileOrderingFlow;