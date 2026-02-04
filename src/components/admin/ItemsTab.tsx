import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw, Package, Check, ChevronsUpDown, Loader2, Search, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import useBooqableProducts from '@/hooks/useBooqableProducts';
import { cn } from '@/lib/utils';

interface SectionItem {
  id: string;
  section_id: string;
  booqable_product_id: string;
  name: string;
  description: string | null;
  daily_rate: number;
  retail_price: number;
  image_url: string | null;
  default_quantity: number;
  default_quantity_essentials: number;
  default_quantity_comprehensive: number;
  is_visible: boolean;
  display_order: number;
  selection_guidance: string | null;
  scaling_tile_size: string | null;
  scaling_per_100_sqft: number | null;
  scaling_guidance: string | null;
  is_sales_item: boolean;
  average_market_price: number;
}

interface PricingComparison {
  id: string;
  section_item_id: string;
  comparison_level: string;
  model_name: string;
  retailer: string;
  price: number;
  url: string | null;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  variationValues: string[];
  quantity: number;
  dailyRate?: number;
  day1Rate?: number;
  day2PlusRate?: number;
  imageUrl?: string;
}

interface ProductDetails {
  booqableId: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  dailyRate: number;
  depositAmount: number;
  stockCount: number;
  trackable: boolean;
  hasVariations: boolean;
  variationFields: string[];
  variants: ProductVariant[];
  productType: string;
  isSalesItem: boolean;
  // Tiered pricing from Booqable price tiles
  day1Rate?: number;
  day2PlusRate?: number;
}

interface ItemsTabProps {
  sectionId: string | null;
  projectName: string | null;
  sectionName: string | null;
  sectionType?: string;
}

const TILE_SIZE_OPTIONS = [
  { value: 'small', label: 'Small Tiles (< 6")' },
  { value: 'medium', label: 'Medium Tiles (6" - 12")' },
  { value: 'large', label: 'Large Format (> 12")' },
  { value: 'all', label: 'All Tile Sizes' },
];

export default function ItemsTab({ sectionId, projectName, sectionName, sectionType }: ItemsTabProps) {
  const [items, setItems] = useState<SectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SectionItem | null>(null);
  const [selectedBooqableId, setSelectedBooqableId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isFindingPricing, setIsFindingPricing] = useState(false);
  const [pricingComparisons, setPricingComparisons] = useState<PricingComparison[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    daily_rate: 0,
    retail_price: 0,
    image_url: '',
    default_quantity: 0,
    default_quantity_essentials: 0,
    default_quantity_comprehensive: 0,
    is_visible: true,
    is_sales_item: false,
    selection_guidance: '',
    scaling_tile_size: '',
    scaling_per_100_sqft: '',
    scaling_guidance: ''
  });

  const { data: booqableProducts, isLoading: isLoadingProducts, refetch: refetchProducts } = useBooqableProducts();

  useEffect(() => {
    if (sectionId) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [sectionId]);

  const fetchItems = async () => {
    if (!sectionId) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('section_items')
      .select('*')
      .eq('section_id', sectionId)
      .order('display_order');
    
    if (error) {
      toast.error('Failed to load items');
      console.error(error);
    } else {
      setItems(data || []);
    }
    setIsLoading(false);
  };

  const fetchProductDetails = async (productId: string) => {
    setIsLoadingDetails(true);
    setProductDetails(null);
    setSelectedVariantId('');
    
    try {
      const { data, error } = await supabase.functions.invoke('booqable', {
        body: { action: 'get-product-details', product_id: productId }
      });

      if (error) {
        console.error('[ItemsTab] Error fetching product details:', error);
        return;
      }

      const details = data.product as ProductDetails;
      setProductDetails(details);
      
      // Auto-populate form with product group info
      // Default essentials and comprehensive quantities to 1
      setFormData({
        name: details.name,
        description: details.description || '',
        daily_rate: details.day1Rate ?? details.dailyRate,
        retail_price: 0,
        image_url: details.imageUrl || '',
        default_quantity: 0,
        default_quantity_essentials: 1,
        default_quantity_comprehensive: 1,
        is_visible: true,
        is_sales_item: details.isSalesItem || false,
        selection_guidance: '',
        scaling_tile_size: '',
        scaling_per_100_sqft: '',
        scaling_guidance: ''
      });

      // If no variants, use the slug as the booqable_product_id
      if (!details.hasVariations || details.variants.length === 0) {
        // Product has no variants, we use the slug for lookup
      } else {
        // Auto-select the first variant (whether there's 1 or many)
        const firstVariant = details.variants[0];
        setSelectedVariantId(firstVariant.id);
        
        // Use variant-specific day1 rate
        const variantDay1Rate = firstVariant.day1Rate ?? firstVariant.dailyRate ?? details.day1Rate ?? details.dailyRate;
        
        if (firstVariant.variationValues.length > 0) {
          setFormData(prev => ({
            ...prev,
            name: `${details.name} - ${firstVariant.variationValues.join(', ')}`,
            daily_rate: variantDay1Rate,
            image_url: firstVariant.imageUrl || details.imageUrl || prev.image_url,
          }));
        }
      }
    } catch (err) {
      console.error('[ItemsTab] Error:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSelectBooqableProduct = (booqableId: string) => {
    setSelectedBooqableId(booqableId);
    const product = booqableProducts?.find(p => p.booqableId === booqableId);
    if (product) {
      // Fetch full product details to check for variants
      fetchProductDetails(booqableId);
    }
  };

  const handleSelectVariant = (variantId: string) => {
    setSelectedVariantId(variantId);
    if (productDetails) {
      const variant = productDetails.variants.find(v => v.id === variantId);
      if (variant) {
        // Update name based on variation values
        const variantName = variant.variationValues.length > 0
          ? `${productDetails.name} - ${variant.variationValues.join(', ')}`
          : (variant.name || productDetails.name);
        
        // Use variant-specific tiered pricing (day1Rate) and image if available
        const variantDay1Rate = variant.day1Rate ?? variant.dailyRate ?? productDetails.day1Rate ?? productDetails.dailyRate;
        
        setFormData(prev => ({
          ...prev,
          name: variantName,
          daily_rate: variantDay1Rate,
          image_url: variant.imageUrl || productDetails.imageUrl || prev.image_url,
        }));
      }
    }
  };

  const handleOpenDialog = (e: React.MouseEvent, item?: SectionItem) => {
    e.preventDefault();
    e.stopPropagation();
    // Reset variant state when opening dialog
    setProductDetails(null);
    setSelectedVariantId('');
    
    if (item) {
      setEditingItem(item);
      setSelectedBooqableId(item.booqable_product_id);
      setFormData({
        name: item.name,
        description: item.description || '',
        daily_rate: item.daily_rate,
        retail_price: item.retail_price,
        image_url: item.image_url || '',
        default_quantity: item.default_quantity,
        default_quantity_essentials: item.default_quantity_essentials || 0,
        default_quantity_comprehensive: item.default_quantity_comprehensive || 0,
        is_visible: item.is_visible,
        is_sales_item: item.is_sales_item || false,
        selection_guidance: item.selection_guidance || '',
        scaling_tile_size: item.scaling_tile_size || '',
        scaling_per_100_sqft: item.scaling_per_100_sqft?.toString() || '',
        scaling_guidance: item.scaling_guidance || ''
      });
      // Fetch existing pricing comparisons for this item
      fetchPricingComparisons(item.id);
    } else {
      setEditingItem(null);
      setSelectedBooqableId('');
      setPricingComparisons([]);
      setFormData({ name: '', description: '', daily_rate: 0, retail_price: 0, image_url: '', default_quantity: 0, default_quantity_essentials: 0, default_quantity_comprehensive: 0, is_visible: true, is_sales_item: false, selection_guidance: '', scaling_tile_size: '', scaling_per_100_sqft: '', scaling_guidance: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!sectionId || !formData.name || !selectedBooqableId) {
      toast.error('Select a Booqable product and provide a name');
      return;
    }

    // If product has variants and user hasn't selected one, show error
    if (productDetails?.hasVariations && productDetails.variants.length > 1 && !selectedVariantId) {
      toast.error('Please select a variant');
      return;
    }

    // Determine which ID to use: variant ID if selected, otherwise product slug for lookup
    const booqableProductId = selectedVariantId || productDetails?.slug || selectedBooqableId;

    // Get is_sales_item from Booqable product details
    const isSalesItem = productDetails?.isSalesItem || false;

    if (editingItem) {
      const { error } = await supabase
        .from('section_items')
        .update({
          booqable_product_id: booqableProductId,
          name: formData.name,
          description: formData.description || null,
          daily_rate: formData.daily_rate,
          retail_price: formData.retail_price,
          image_url: formData.image_url || null,
          default_quantity: formData.default_quantity,
          default_quantity_essentials: formData.default_quantity_essentials,
          default_quantity_comprehensive: formData.default_quantity_comprehensive,
          is_visible: formData.is_visible,
          is_sales_item: isSalesItem,
          selection_guidance: formData.selection_guidance || null,
          scaling_tile_size: formData.scaling_tile_size || null,
          scaling_per_100_sqft: formData.scaling_per_100_sqft ? parseFloat(formData.scaling_per_100_sqft) : null,
          scaling_guidance: formData.scaling_guidance || null
        })
        .eq('id', editingItem.id);

      if (error) {
        toast.error('Failed to update item');
        console.error(error);
      } else {
        toast.success('Item updated');
        fetchItems();
        setIsDialogOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('section_items')
        .insert({
          section_id: sectionId,
          booqable_product_id: booqableProductId,
          name: formData.name,
          description: formData.description || null,
          daily_rate: formData.daily_rate,
          retail_price: formData.retail_price,
          image_url: formData.image_url || null,
          default_quantity: formData.default_quantity,
          default_quantity_essentials: formData.default_quantity_essentials,
          default_quantity_comprehensive: formData.default_quantity_comprehensive,
          is_visible: formData.is_visible,
          is_sales_item: isSalesItem,
          selection_guidance: formData.selection_guidance || null,
          scaling_tile_size: formData.scaling_tile_size || null,
          scaling_per_100_sqft: formData.scaling_per_100_sqft ? parseFloat(formData.scaling_per_100_sqft) : null,
          scaling_guidance: formData.scaling_guidance || null,
          display_order: items.length
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This product is already in this section');
        } else {
          toast.error('Failed to add item');
          console.error(error);
        }
      } else {
        toast.success('Item added');
        fetchItems();
        setIsDialogOpen(false);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Remove this item from the section?')) return;
    
    const { error } = await supabase.from('section_items').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete item');
    } else {
      toast.success('Item removed');
      fetchItems();
    }
  };

  const handleToggleVisible = async (e: React.MouseEvent, item: SectionItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { error } = await supabase
      .from('section_items')
      .update({ is_visible: !item.is_visible })
      .eq('id', item.id);

    if (error) {
      toast.error('Failed to update item');
    } else {
      fetchItems();
    }
  };

  const fetchPricingComparisons = async (itemId: string) => {
    const { data, error } = await supabase
      .from('pricing_comparisons')
      .select('*')
      .eq('section_item_id', itemId)
      .order('comparison_level');

    if (error) {
      console.error('[ItemsTab] Error fetching pricing:', error);
    } else {
      setPricingComparisons(data || []);
    }
  };

  const handleFindPricing = async () => {
    if (!formData.name) {
      toast.error('Enter a product name first');
      return;
    }

    if (!editingItem) {
      toast.error('Save the item first before finding pricing');
      return;
    }

    setIsFindingPricing(true);

    try {
      const { data, error } = await supabase.functions.invoke('find-pricing', {
        body: { 
          item_name: formData.name,
          item_description: formData.description,
          section_item_id: editingItem.id
        }
      });

      if (error) {
        console.error('[ItemsTab] Error finding pricing:', error);
        toast.error('Failed to find pricing');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setPricingComparisons(data.comparisons || []);
      
      // Update retail_price with recommended comparison (DIY average by default)
      if (data.recommended_comparison > 0) {
        setFormData(prev => ({ ...prev, retail_price: Math.round(data.recommended_comparison * 100) / 100 }));
      }
      
      const tierAvgs = data.tier_averages;
      const avgSummary = tierAvgs 
        ? `Pro: $${tierAvgs.professional?.toFixed(0) || 'N/A'}, DIY: $${tierAvgs.diy?.toFixed(0) || 'N/A'}, Used: $${tierAvgs.used?.toFixed(0) || 'N/A'}`
        : '';
      toast.success(`Found ${data.comparisons?.length || 0} comparisons. ${avgSummary}`);
      fetchItems(); // Refresh to show updated average_market_price
    } catch (err) {
      console.error('[ItemsTab] Error:', err);
      toast.error('Failed to find pricing');
    } finally {
      setIsFindingPricing(false);
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    refetchProducts();
  };

  if (!sectionId) {
    return (
      <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
        <AlertCircle className="h-8 w-8" />
        <p>Select a section first to manage its items</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {(projectName || sectionName) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md flex-wrap">
          {projectName && (
            <>
              <span className="font-medium text-foreground">Project:</span>
              <span>{projectName}</span>
            </>
          )}
          {projectName && sectionName && <span className="text-muted-foreground/50">→</span>}
          {sectionName && (
            <>
              <span className="font-medium text-foreground">Section:</span>
              <span>{sectionName}</span>
            </>
          )}
        </div>
      )}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Add Booqable products to this section</p>
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh Booqable inventory">
            <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Button size="sm" onClick={(e) => handleOpenDialog(e)}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto z-[10000]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item from Booqable'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the item details below.' : 'Select a product from Booqable inventory.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Booqable Product</Label>
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedBooqableId
                      ? booqableProducts?.find((p) => p.booqableId === selectedBooqableId)?.name || "Select product..."
                      : "Search products..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 z-[10001]" align="start">
                  <Command>
                    <CommandInput placeholder="Search products..." />
                    <CommandList>
                      <CommandEmpty>No product found.</CommandEmpty>
                      <CommandGroup className="max-h-[300px] overflow-auto">
                        {booqableProducts?.map((product) => (
                          <CommandItem
                            key={product.booqableId}
                            value={product.name}
                            onSelect={() => {
                              handleSelectBooqableProduct(product.booqableId);
                              setProductSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedBooqableId === product.booqableId ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 truncate">{product.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {product.isSalesItem 
                                ? `$${product.dailyRate.toFixed(2)} (sale)`
                                : `$${product.dailyRate.toFixed(2)}/day`
                              }
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {isLoadingProducts && <p className="text-xs text-muted-foreground">Loading Booqable inventory...</p>}
            </div>
            
            {/* Variant selector - shown when product has variations */}
            {isLoadingDetails && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading product variants...
              </div>
            )}
            
            {productDetails?.hasVariations && productDetails.variants.length > 1 && (
              <div className="space-y-2">
                <Label>
                  Select Variant
                  {productDetails.variationFields.length > 0 && (
                    <span className="text-muted-foreground ml-1">
                      ({productDetails.variationFields.join(', ')})
                    </span>
                  )}
                </Label>
                <Select value={selectedVariantId} onValueChange={handleSelectVariant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a variant..." />
                  </SelectTrigger>
                  <SelectContent className="z-[10002]">
                    {productDetails.variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.variationValues.length > 0 
                          ? variant.variationValues.join(' / ')
                          : variant.name}
                        {variant.quantity > 0 && (
                          <span className="text-muted-foreground ml-2">
                            ({variant.quantity} in stock)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Safety Glasses"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="ANSI-rated safety glasses..."
              />
            </div>
            <div className="space-y-2">
              <Label>Selection Guidance</Label>
              <Input
                value={formData.selection_guidance}
                onChange={(e) => setFormData({ ...formData, selection_guidance: e.target.value })}
                placeholder="e.g., Do you have tile larger than 15 inches?"
              />
              <p className="text-xs text-muted-foreground">
                Short question/statement to help users decide if they need this item
              </p>
            </div>
            
            {/* Scaling Configuration - only for consumable sections */}
            {sectionType === 'consumable' && (
              <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Auto-Scaling Configuration</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure how this material scales based on project square footage
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Applies to Tile Size</Label>
                    <Select 
                      value={formData.scaling_tile_size} 
                      onValueChange={(v) => setFormData({ ...formData, scaling_tile_size: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tile size..." />
                      </SelectTrigger>
                      <SelectContent className="z-[10002]">
                        {TILE_SIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Units per 100 sq ft</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.scaling_per_100_sqft}
                      onChange={(e) => setFormData({ ...formData, scaling_per_100_sqft: e.target.value })}
                      placeholder="e.g., 5"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Scaling Guidance (shown to users)</Label>
                  <Input
                    value={formData.scaling_guidance}
                    onChange={(e) => setFormData({ ...formData, scaling_guidance: e.target.value })}
                    placeholder="e.g., 1 bag per 20 sq ft. Buy 10% extra for waste."
                  />
                  <p className="text-xs text-muted-foreground">
                    Explains the calculation to help users understand quantities
                  </p>
                </div>
              </div>
            )}
            {/* Pricing from Booqable - read-only */}
            {productDetails && !productDetails.isSalesItem && (() => {
              // Get the selected variant's pricing if a variant is selected
              const selectedVariant = selectedVariantId 
                ? productDetails.variants.find(v => v.id === selectedVariantId)
                : null;
              
              const day1Rate = selectedVariant?.day1Rate ?? selectedVariant?.dailyRate ?? productDetails.day1Rate ?? productDetails.dailyRate;
              const day2PlusRate = selectedVariant?.day2PlusRate ?? selectedVariant?.day1Rate ?? selectedVariant?.dailyRate ?? productDetails.day2PlusRate ?? productDetails.day1Rate ?? productDetails.dailyRate;
              
              return (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">
                      Booqable Pricing (read-only)
                      {selectedVariant && <span className="text-xs text-muted-foreground ml-1">- Variant</span>}
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Day 1 Rate</p>
                      <p className="text-lg font-semibold text-primary">
                        ${day1Rate.toFixed(2)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Day 2+ Rate</p>
                      <p className="text-lg font-semibold text-primary">
                        ${day2PlusRate.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/day</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rates are pulled directly from Booqable price tiles and cannot be edited here.
                  </p>
                </div>
              );
            })()}

            {/* Sales item pricing - read-only */}
            {productDetails?.isSalesItem && (() => {
              // Get the selected variant's pricing if a variant is selected
              const selectedVariant = selectedVariantId 
                ? productDetails.variants.find(v => v.id === selectedVariantId)
                : null;
              
              const salePrice = selectedVariant?.dailyRate ?? productDetails.dailyRate;
              
              return (
                <div className="space-y-2 p-4 bg-secondary/50 rounded-lg border border-secondary">
                  <Label className="text-sm font-medium">
                    Sale Price
                    {selectedVariant && <span className="text-xs text-muted-foreground ml-1">- Variant</span>}
                  </Label>
                  <p className="text-lg font-semibold text-primary">
                    ${salePrice.toFixed(2)}
                  </p>
                </div>
              );
            })()}

            {/* Package Quantity Configuration - only for equipment sections */}
            {sectionType === 'equipment' && (
              <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Package Default Quantities</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set how many of this item are included in each package type
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project Essentials</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.default_quantity_essentials}
                      onChange={(e) => setFormData({ ...formData, default_quantity_essentials: parseInt(e.target.value) || 0 })}
                      placeholder="0 = not included"
                    />
                    <p className="text-xs text-muted-foreground">Minimum required items</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Comprehensive</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.default_quantity_comprehensive}
                      onChange={(e) => setFormData({ ...formData, default_quantity_comprehensive: parseInt(e.target.value) || 0 })}
                      placeholder="0 = not included"
                    />
                    <p className="text-xs text-muted-foreground">Full package items</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Quantity</Label>
                <Input
                  type="number"
                  value={formData.default_quantity}
                  onChange={(e) => setFormData({ ...formData, default_quantity: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Initial quantity shown to users</p>
              </div>
              <div className="space-y-2">
                <Label>Retail Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.retail_price}
                  onChange={(e) => setFormData({ ...formData, retail_price: parseFloat(e.target.value) || 0 })}
                  placeholder="For price comparison"
                />
                <p className="text-xs text-muted-foreground">Used for purchase comparison only</p>
              </div>
            </div>
            
            {/* Pricing Comparisons */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Market Pricing Comparison</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFindPricing}
                  disabled={isFindingPricing || !formData.name || !editingItem}
                >
                  {isFindingPricing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Finding...
                    </>
                  ) : (
                    <>
                      <Search className="h-3 w-3 mr-1" />
                      Find Pricing
                    </>
                  )}
                </Button>
              </div>
              
              {!editingItem && (
                <p className="text-xs text-muted-foreground">Save the item first to enable pricing lookup</p>
              )}
              
              {pricingComparisons.length > 0 && (
                <div className="space-y-3">
                  {/* Tier Averages Summary */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {['exact', 'professional', 'diy', 'used'].map(level => {
                      const tierItems = pricingComparisons.filter(c => c.comparison_level === level);
                      const avg = tierItems.length > 0 
                        ? tierItems.reduce((sum, c) => sum + c.price, 0) / tierItems.length 
                        : 0;
                      return (
                        <div key={level} className="bg-muted/50 rounded-lg p-2">
                          <Badge 
                            variant={
                              level === 'exact' ? 'default' :
                              level === 'professional' ? 'secondary' :
                              level === 'diy' ? 'outline' : 'destructive'
                            }
                            className="text-xs capitalize mb-1"
                          >
                            {level}
                          </Badge>
                          <p className="text-sm font-bold">
                            {avg > 0 ? `$${avg.toFixed(0)}` : 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground">{tierItems.length} items</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed Table */}
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Level</th>
                          <th className="px-3 py-2 text-left font-medium">Model</th>
                          <th className="px-3 py-2 text-left font-medium">Retailer</th>
                          <th className="px-3 py-2 text-right font-medium">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingComparisons.map((comp, idx) => (
                          <tr key={comp.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                            <td className="px-3 py-2">
                              <Badge 
                                variant={
                                  comp.comparison_level === 'exact' ? 'default' :
                                  comp.comparison_level === 'professional' ? 'secondary' :
                                  comp.comparison_level === 'diy' ? 'outline' : 'destructive'
                                }
                                className="text-xs capitalize"
                              >
                                {comp.comparison_level}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 truncate max-w-[150px]" title={comp.model_name}>
                              {comp.model_name}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{comp.retailer}</td>
                            <td className="px-3 py-2 text-right font-medium">${comp.price.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Professional brands: DeWalt, Milwaukee, Makita, Bosch. DIY brands: Ryobi, Kobalt, Harbor Freight tools.
                Retail price is set to DIY average (most relevant for rental comparison).
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_visible}
                onCheckedChange={(v) => setFormData({ ...formData, is_visible: v })}
              />
              <Label>Visible to users</Label>
            </div>
            <Button onClick={handleSave} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded" />
                )}
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">${item.daily_rate.toFixed(2)}/day</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.is_visible}
                  onCheckedChange={() => {}}
                  onClick={(e) => handleToggleVisible(e, item)}
                />
                <Button variant="ghost" size="icon" onClick={(e) => handleOpenDialog(e, item)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, item.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {items.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">No items yet. Add products from Booqable!</p>
        )}
      </div>
    </div>
  );
}
