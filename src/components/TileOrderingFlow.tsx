import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Check, Package, Plus, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import { equipmentCategories, addOnCategories, consumables, tileSizes } from '@/data/tileEquipment';
import { EquipmentCategory, AddOnCategory, RentalItem } from '@/types/rental';
import EquipmentItem from './EquipmentItem';
import AddOnModal from './AddOnModal';
import CheckoutSummary from './CheckoutSummary';
import QuantitySelector from './QuantitySelector';

interface TileOrderingFlowProps {
  onBack: () => void;
}

const TileOrderingFlow = ({ onBack }: TileOrderingFlowProps) => {
  const [squareFootage, setSquareFootage] = useState<string>('');
  const [tileSize, setTileSize] = useState<string>('');
  const [equipment, setEquipment] = useState<EquipmentCategory[]>(equipmentCategories);
  const [addOns, setAddOns] = useState<AddOnCategory[]>(addOnCategories);
  const [materials, setMaterials] = useState<RentalItem[]>(consumables);
  const [activeAddOn, setActiveAddOn] = useState<AddOnCategory | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [openAccordions, setOpenAccordions] = useState<string[]>(['step-1']);

  const sqft = parseFloat(squareFootage) || 0;
  const thinsetBags = Math.ceil(sqft / 10);

  const step1Complete = sqft > 0 && tileSize !== '';
  const step2Complete = equipment.some(cat => cat.items.some(item => item.quantity > 0));
  const step3Complete = addOns.some(cat => cat.items.some(item => item.quantity > 0));

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
    setOpenAccordions(prev => [...new Set([...prev, 'step-2'])]);
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
          rentalDays={3}
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
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
            Tile Flooring Package
          </h1>
          <p className="text-muted-foreground text-lg">
            Configure your rental package in a few simple steps.
          </p>
        </div>

        <Accordion 
          type="multiple" 
          value={openAccordions}
          onValueChange={setOpenAccordions}
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
                      {squareFootage} sq ft • {tileSizes.find(t => t.value === tileSize)?.label}
                    </span>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid gap-6 md:grid-cols-2 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="sqft">Square Footage</Label>
                  <Input
                    id="sqft"
                    type="number"
                    placeholder="e.g., 200"
                    value={squareFootage}
                    onChange={(e) => setSquareFootage(e.target.value)}
                  />
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

          {/* Step 4: Materials & Consumables */}
          <AccordionItem value="step-4" className="border rounded-xl overflow-hidden bg-card shadow-card">
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
              <p className="text-muted-foreground mb-4">
                Purchase materials for your project. Thinset is pre-calculated based on your square footage.
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
                          {item.id === 'thinset' && sqft > 0 && (
                            <span className="ml-2 text-primary">
                              (Suggested: {thinsetBags} for {sqft} sq ft)
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
            disabled={!step1Complete}
            onClick={() => setShowCheckout(true)}
          >
            View Checkout Summary
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          {!step1Complete && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Please complete the tile sizing step to continue
            </p>
          )}
        </div>
      </div>

      <AddOnModal
        category={activeAddOn}
        open={!!activeAddOn}
        onClose={() => setActiveAddOn(null)}
        onQuantityChange={handleAddOnQuantityChange}
      />
    </div>
  );
};

export default TileOrderingFlow;
