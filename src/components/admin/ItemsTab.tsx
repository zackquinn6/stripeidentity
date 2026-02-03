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
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw, Package, Check, ChevronsUpDown, Loader2, Search, ExternalLink, Calculator } from 'lucide-react';
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
  is_visible: boolean;
  display_order: number;
  amazon_url: string | null;
  home_depot_url: string | null;
  selection_guidance: string | null;
  scaling_tile_size: string | null;
  scaling_per_100_sqft: number | null;
  scaling_guidance: string | null;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  variationValues: string[];
  quantity: number;
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
  // Tiered pricing from Booqable price structure
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
  const [isFindingLinks, setIsFindingLinks] = useState(false);
  const [retailerSearchUrls, setRetailerSearchUrls] = useState<{ amazon: string; homeDepot: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    daily_rate: 0,
    retail_price: 0,
    image_url: '',
    default_quantity: 1,
    is_visible: true,
    amazon_url: '',
    home_depot_url: '',
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
      setFormData({
        name: details.name,
        description: details.description || '',
        daily_rate: details.dailyRate,
        retail_price: 0,
        image_url: details.imageUrl || '',
        default_quantity: 1,
        is_visible: true,
        amazon_url: '',
        home_depot_url: '',
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
        if (firstVariant.variationValues.length > 0) {
          setFormData(prev => ({
            ...prev,
            name: `${details.name} - ${firstVariant.variationValues.join(', ')}`
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
      if (variant && variant.variationValues.length > 0) {
        setFormData(prev => ({
          ...prev,
          name: `${productDetails.name} - ${variant.variationValues.join(', ')}`
        }));
      } else if (variant) {
        setFormData(prev => ({
          ...prev,
          name: variant.name || productDetails.name
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
        is_visible: item.is_visible,
        amazon_url: item.amazon_url || '',
        home_depot_url: item.home_depot_url || '',
        selection_guidance: item.selection_guidance || '',
        scaling_tile_size: item.scaling_tile_size || '',
        scaling_per_100_sqft: item.scaling_per_100_sqft?.toString() || '',
        scaling_guidance: item.scaling_guidance || ''
      });
    } else {
      setEditingItem(null);
      setSelectedBooqableId('');
      setFormData({ name: '', description: '', daily_rate: 0, retail_price: 0, image_url: '', default_quantity: 1, is_visible: true, amazon_url: '', home_depot_url: '', selection_guidance: '', scaling_tile_size: '', scaling_per_100_sqft: '', scaling_guidance: '' });
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
          is_visible: formData.is_visible,
          amazon_url: formData.amazon_url || null,
          home_depot_url: formData.home_depot_url || null,
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
          is_visible: formData.is_visible,
          amazon_url: formData.amazon_url || null,
          home_depot_url: formData.home_depot_url || null,
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

  const handleFindRetailerLinks = async () => {
    if (!formData.name) {
      toast.error('Enter a product name first');
      return;
    }

    setIsFindingLinks(true);
    setRetailerSearchUrls(null);

    try {
      const { data, error } = await supabase.functions.invoke('find-retailer-products', {
        body: { 
          product_name: formData.name,
          description: formData.description 
        }
      });

      if (error) {
        console.error('[ItemsTab] Error finding retailer links:', error);
        toast.error('Failed to generate search links');
        return;
      }

      setRetailerSearchUrls(data.searchUrls);
      toast.success('Search links generated - click to find products');
    } catch (err) {
      console.error('[ItemsTab] Error:', err);
      toast.error('Failed to find products');
    } finally {
      setIsFindingLinks(false);
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
            {productDetails && !productDetails.isSalesItem && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Booqable Pricing (read-only)</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Day 1 Rate</p>
                    <p className="text-lg font-semibold text-primary">
                      ${productDetails.dailyRate.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Day 2+ Rate</p>
                    <p className="text-lg font-semibold text-primary">
                      ${productDetails.dailyRate.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/day</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rates are pulled directly from Booqable and cannot be edited here.
                </p>
              </div>
            )}

            {/* Sales item pricing - read-only */}
            {productDetails?.isSalesItem && (
              <div className="space-y-3 p-4 bg-secondary/50 rounded-lg border border-secondary">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Sale Item Pricing (read-only)</Label>
                  <Badge variant="secondary" className="text-xs">Consumable</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Price per Item</p>
                  <p className="text-lg font-semibold text-primary">
                    ${productDetails.dailyRate.toFixed(2)}<span className="text-sm font-normal text-muted-foreground"> each</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is a one-time purchase item, not a rental.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Quantity</Label>
                <Input
                  type="number"
                  value={formData.default_quantity}
                  onChange={(e) => setFormData({ ...formData, default_quantity: parseInt(e.target.value) || 1 })}
                />
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
            
            {/* Retailer Links */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-muted-foreground">Retailer Links (for price comparison)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFindRetailerLinks}
                  disabled={isFindingLinks || !formData.name}
                >
                  {isFindingLinks ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Finding...
                    </>
                  ) : (
                    <>
                      <Search className="h-3 w-3 mr-1" />
                      Find Links
                    </>
                  )}
                </Button>
              </div>
              
              {retailerSearchUrls && (
                <div className="flex gap-2 p-2 bg-muted/50 rounded-md">
                  <a
                    href={retailerSearchUrls.amazon}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Search Amazon
                  </a>
                  <span className="text-muted-foreground">|</span>
                  <a
                    href={retailerSearchUrls.homeDepot}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Search Home Depot
                  </a>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Amazon URL</Label>
                  <Input
                    type="url"
                    value={formData.amazon_url}
                    onChange={(e) => setFormData({ ...formData, amazon_url: e.target.value })}
                    placeholder="https://amazon.com/dp/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Home Depot URL</Label>
                  <Input
                    type="url"
                    value={formData.home_depot_url}
                    onChange={(e) => setFormData({ ...formData, home_depot_url: e.target.value })}
                    placeholder="https://homedepot.com/p/..."
                  />
                </div>
              </div>
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
