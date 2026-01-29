import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Check, Package, Plus, Sparkles, ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import { equipmentCategories, addOnCategories, consumables, tileSizes, squareFootageBuckets } from '@/data/tileEquipment';
import { EquipmentCategory, AddOnCategory, RentalItem } from '@/types/rental';
import EquipmentItem from './EquipmentItem';
import AddOnModal from './AddOnModal';
import CheckoutSummary from './CheckoutSummary';
import QuantitySelector from './QuantitySelector';
import RentalDatePicker, { RentalDuration, durationOptions } from './RentalDatePicker';
import PackageValueCard from './PackageValueCard';
import { format, nextFriday, isFriday, startOfDay } from 'date-fns';

interface TileOrderingFlowProps {
  onBack: () => void;
}

const TileOrderingFlow = ({ onBack }: TileOrderingFlowProps) => {
  const [squareFootageBucket, setSquareFootageBucket] = useState<string>('');
  const [exactSquareFootage, setExactSquareFootage] = useState<string>('');
  const [tileSize, setTileSize] = useState<string>('');
  const [equipment, setEquipment] = useState<EquipmentCategory[]>(equipmentCategories);
  const [addOns, setAddOns] = useState<AddOnCategory[]>(addOnCategories);
  const [materials, setMaterials] = useState<RentalItem[]>(consumables);
  const [activeAddOn, setActiveAddOn] = useState<AddOnCategory | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>('step-1');
  
  // Rental date state
  const [rentalDuration, setRentalDuration] = useState<RentalDuration>('1-weekend');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const exactSqft = parseFloat(exactSquareFootage) || 0;
  const thinsetBags = Math.ceil(exactSqft / 10);

  const step1Complete = squareFootageBucket !== '' && tileSize !== '';
  const step2Complete = equipment.some(cat => cat.items.some(item => item.quantity > 0));
  const step3Complete = addOns.some(cat => cat.items.some(item => item.quantity > 0));
  const step4Complete = !!startDate && (rentalDuration !== 'daily' || !!endDate);
  
  const getRentalDays = () => {
    if (rentalDuration === 'daily' && startDate && endDate) {
      return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    return durationOptions.find(o => o.value === rentalDuration)?.days || 3;
  };
  
  const rentalDays = getRentalDays();

  const handleEquipmentQuantityChange = (categoryId: string, itemId: string, quantity: number) => {
    setEquipment(prev =>
      prev.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map(item =>
                item.id === itemId ? { ...item, quantity } : item
              ),
            }
          : cat
      )
    );
  };

  const handleAddOnQuantityChange = (categoryId: string, itemId: string, quantity: number) => {
    setAddOns(prev =>
      prev.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map(item =>
                item.id === itemId ? { ...item, quantity } : item
              ),
            }
          : cat
      )
    );
  };

  const handleMaterialQuantityChange = (itemId: string, quantity: number) => {
    setMaterials(prev =>
      prev.map(item => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const handleSelectComprehensive = () => {
    setEquipment(prev =>
      prev.map(cat => ({
        ...cat,
        items: cat.items.map(item => ({ ...item, quantity: 1 })),
      }))
    );
    setOpenAccordion('step-2');
  };

  const getAllSelectedItems = useMemo((): RentalItem[] => {
    const equipmentItems = equipment.flatMap(cat => cat.items).filter(item => item.quantity > 0);
    const addOnItems = addOns.flatMap(cat => cat.items).filter(item => item.quantity > 0);
    const materialItems = materials.filter(item => item.quantity > 0);

    return [...equipmentItems, ...addOnItems, ...materialItems];
  }, [equipment, addOns, materials]);

  const getAddOnSummary = (category: AddOnCategory) => {
    const selected = category.items.filter(item => item.quantity > 0);
    if (selected.length === 0) return 'Click to add';
    return `${selected.length} items selected`;
  };

  if (showCheckout) {
    return (
      <div className="py-12 px-6">
        <CheckoutSummary 
          items={getAllSelectedItems} 
          rentalDays={rentalDays}
          startDate={startDate}
          onBack={() => setShowCheckout(false)} 
        />
      </div>
    );
  }

  return (
    <div className="py-12 px-6 bg-background min-h-screen">
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

        <Accordion 
          type="single" 
          collapsible
          value={openAccordion}
          onValueChange={(value) => setOpenAccordion(value || '')}
          className="space-y-4"
        >
          {/* Step 1: Tile Sizing */}
          <AccordionItem value="step-1" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step1Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step1Complete ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Tile Sizing</span>
                  {step1Complete && (
                    <span className="text-sm text-muted-foreground ml-3">
                      {squareFootageBuckets.find(b => b.value === squareFootageBucket)?.label} • {tileSizes.find(t => t.value === tileSize)?.label}
                    </span>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid gap-6 md:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <Label>Square Footage Range</Label>
                  <Select value={squareFootageBucket} onValueChange={setSquareFootageBucket}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {squareFootageBuckets.map((bucket) => (
                        <SelectItem key={bucket.value} value={bucket.value}>
                          {bucket.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tile Size</Label>
                  <Select value={tileSize} onValueChange={setTileSize}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select tile size" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {tileSizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 2: Equipment Selection */}
          <AccordionItem value="step-2" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step2Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step2Complete ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Equipment Selection</span>
                  {step2Complete && (
                    <Badge variant="secondary" className="ml-3">
                      {equipment.flatMap(c => c.items).filter(i => i.quantity > 0).length} items
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <Button 
                variant="outline" 
                className="w-full mb-6 border-dashed border-2 py-6 hover:border-primary hover:bg-primary/5"
                onClick={handleSelectComprehensive}
              >
                <Sparkles className="w-5 h-5 mr-2 text-primary" />
                Skip this — give me the comprehensive package
              </Button>

              <div className="space-y-6">
                {equipment.map((category) => (
                  <div key={category.id}>
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                      {category.name}
                    </h4>
                    <div className="space-y-2">
                      {category.items.map((item) => (
                        <EquipmentItem
                          key={item.id}
                          item={item}
                          onQuantityChange={(id, qty) => handleEquipmentQuantityChange(category.id, id, qty)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 3: Add-ons */}
          <AccordionItem value="step-3" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step3Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step3Complete ? <Check className="w-4 h-4" /> : '3'}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Add-ons</span>
                  {step3Complete && (
                    <Badge variant="secondary" className="ml-3">
                      {addOns.filter(c => c.items.some(i => i.quantity > 0)).length} packages
                    </Badge>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <p className="text-muted-foreground mb-4">
                Optional add-on packages for related tasks.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {addOns.map((category) => {
                  const hasSelection = category.items.some(item => item.quantity > 0);
                  return (
                    <Card
                      key={category.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        hasSelection ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setActiveAddOn(category)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{category.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {getAddOnSummary(category)}
                          </p>
                        </div>
                        {hasSelection ? (
                          <Check className="w-5 h-5 text-primary" />
                        ) : (
                          <Plus className="w-5 h-5 text-muted-foreground" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 4: Rental Period */}
          <AccordionItem value="step-4" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step4Complete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step4Complete ? <Check className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <span className="font-display font-semibold text-lg">Rental Period</span>
                  {step4Complete && startDate && (
                    <span className="text-sm text-muted-foreground ml-3">
                      {format(startDate, 'MMM d')} • {rentalDays} days
                    </span>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <RentalDatePicker
                startDate={startDate}
                endDate={endDate}
                duration={rentalDuration}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onDurationChange={setRentalDuration}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Step 5: Materials & Consumables */}
          <AccordionItem value="step-5" className="border rounded-xl overflow-hidden bg-card shadow-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                  <Package className="w-4 h-4" />
                </div>
                <span className="font-display font-semibold text-lg text-left">
                  Materials & Consumables
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              {/* Show selected square footage bucket */}
              {squareFootageBucket && (
                <div className="mb-4 p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Selected Range: </span>
                    {squareFootageBuckets.find(b => b.value === squareFootageBucket)?.label}
                  </p>
                </div>
              )}
              
              {/* Exact square footage input for materials calculation */}
              <div className="mb-6 p-4 border border-dashed border-primary/30 rounded-lg bg-primary/5">
                <Label htmlFor="exact-sqft" className="text-sm font-medium">
                  To calculate materials, enter exact square footage:
                </Label>
                <Input
                  id="exact-sqft"
                  type="number"
                  placeholder="e.g., 75"
                  value={exactSquareFootage}
                  onChange={(e) => setExactSquareFootage(e.target.value)}
                  className="mt-2 max-w-[200px]"
                />
              </div>

              <p className="text-muted-foreground mb-4">
                Purchase materials for your project.
                {exactSqft > 0 && ' Thinset is pre-calculated based on your square footage.'}
              </p>
              <div className="space-y-3">
                {materials.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.imageUrl && (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover bg-muted"
                        />
                      )}
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <p className="text-sm text-muted-foreground">
                          ${item.dailyRate.toFixed(2)} each
                          {item.id === 'thinset' && exactSqft > 0 && (
                            <span className="ml-2 text-primary">
                              (Suggested: {thinsetBags} for {exactSqft} sq ft)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <QuantitySelector
                      quantity={item.quantity}
                      onQuantityChange={(qty) => handleMaterialQuantityChange(item.id, qty)}
                    />
                  </div>
                ))}
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
          <Button 
            size="lg" 
            className="w-full"
            disabled={!step1Complete || !step4Complete}
            onClick={() => setShowCheckout(true)}
          >
            View Checkout Summary
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          {(!step1Complete || !step4Complete) && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              {!step1Complete 
                ? 'Please complete the tile sizing step to continue'
                : 'Please select a rental period to continue'
              }
            </p>
          )}
        </div>
      </div>

      <AddOnModal
        category={activeAddOn ? addOns.find(c => c.id === activeAddOn.id) || null : null}
        open={!!activeAddOn}
        onClose={() => setActiveAddOn(null)}
        onQuantityChange={handleAddOnQuantityChange}
      />
    </div>
  );
};

export default TileOrderingFlow;
