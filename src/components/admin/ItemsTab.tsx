import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, AlertCircle, RefreshCw, Package } from 'lucide-react';
import { toast } from 'sonner';
import useBooqableProducts from '@/hooks/useBooqableProducts';

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
}

interface ItemsTabProps {
  sectionId: string | null;
}

export default function ItemsTab({ sectionId }: ItemsTabProps) {
  const [items, setItems] = useState<SectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SectionItem | null>(null);
  const [selectedBooqableId, setSelectedBooqableId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    daily_rate: 0,
    retail_price: 0,
    image_url: '',
    default_quantity: 0,
    is_visible: true
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

  const handleSelectBooqableProduct = (booqableId: string) => {
    setSelectedBooqableId(booqableId);
    const product = booqableProducts?.find(p => p.booqableId === booqableId);
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        daily_rate: product.dailyRate,
        retail_price: 0,
        image_url: product.imageUrl || '',
        default_quantity: 0,
        is_visible: true
      });
    }
  };

  const handleOpenDialog = (e: React.MouseEvent, item?: SectionItem) => {
    e.preventDefault();
    e.stopPropagation();
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
        is_visible: item.is_visible
      });
    } else {
      setEditingItem(null);
      setSelectedBooqableId('');
      setFormData({ name: '', description: '', daily_rate: 0, retail_price: 0, image_url: '', default_quantity: 0, is_visible: true });
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

    if (editingItem) {
      const { error } = await supabase
        .from('section_items')
        .update({
          booqable_product_id: selectedBooqableId,
          name: formData.name,
          description: formData.description || null,
          daily_rate: formData.daily_rate,
          retail_price: formData.retail_price,
          image_url: formData.image_url || null,
          default_quantity: formData.default_quantity,
          is_visible: formData.is_visible
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
          booqable_product_id: selectedBooqableId,
          name: formData.name,
          description: formData.description || null,
          daily_rate: formData.daily_rate,
          retail_price: formData.retail_price,
          image_url: formData.image_url || null,
          default_quantity: formData.default_quantity,
          is_visible: formData.is_visible,
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
              <Select value={selectedBooqableId} onValueChange={handleSelectBooqableProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent className="z-[10001]">
                  {booqableProducts?.map(product => (
                    <SelectItem key={product.booqableId} value={product.booqableId}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {product.name} - ${product.dailyRate.toFixed(2)}/day
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoadingProducts && <p className="text-xs text-muted-foreground">Loading Booqable inventory...</p>}
            </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Daily Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.daily_rate}
                  onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Retail Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.retail_price}
                  onChange={(e) => setFormData({ ...formData, retail_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Default Quantity</Label>
              <Input
                type="number"
                value={formData.default_quantity}
                onChange={(e) => setFormData({ ...formData, default_quantity: parseInt(e.target.value) || 0 })}
              />
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
