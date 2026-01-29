import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AddOnCategory } from '@/types/rental';
import EquipmentItem from './EquipmentItem';

interface AddOnModalProps {
  category: AddOnCategory | null;
  open: boolean;
  onClose: () => void;
  onQuantityChange: (categoryId: string, itemId: string, quantity: number) => void;
}

const AddOnModal = ({ category, open, onClose, onQuantityChange }: AddOnModalProps) => {
  const hasInitialized = useRef<string | null>(null);

  // Default all items to quantity 1 when modal opens for a new category
  useEffect(() => {
    if (open && category && hasInitialized.current !== category.id) {
      const hasNoSelections = category.items.every(item => item.quantity === 0);
      if (hasNoSelections) {
        category.items.forEach(item => {
          onQuantityChange(category.id, item.id, 1);
        });
      }
      hasInitialized.current = category.id;
    }
    if (!open) {
      hasInitialized.current = null;
    }
  }, [open, category, onQuantityChange]);

  if (!category) return null;

  const totalItems = category.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalDaily = category.items.reduce((sum, item) => sum + (item.dailyRate * item.quantity), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{category.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {category.items.map((item) => (
            <EquipmentItem
              key={item.id}
              item={item}
              onQuantityChange={(id, qty) => onQuantityChange(category.id, id, qty)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {totalItems > 0 ? (
              <span>{totalItems} items • ${totalDaily.toFixed(2)}/day</span>
            ) : (
              <span>No items selected</span>
            )}
          </div>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddOnModal;
