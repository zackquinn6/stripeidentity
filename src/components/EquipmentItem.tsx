import { RentalItem } from '@/types/rental';
import QuantitySelector from './QuantitySelector';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface EquipmentItemProps {
  item: RentalItem;
  onQuantityChange: (id: string, quantity: number) => void;
  onItemClick?: (item: RentalItem) => void;
}

const EquipmentItem = ({ item, onQuantityChange, onItemClick }: EquipmentItemProps) => {
  const handleClick = (e: React.MouseEvent) => {
    // Prevent click when interacting with quantity selector
    const target = e.target as HTMLElement;
    if (target.closest('.quantity-selector') || target.closest('.booqable-product-button')) {
      return;
    }
    onItemClick?.(item);
  };

  return (
    <div 
      className="flex items-center justify-between py-3 px-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors cursor-pointer group"
      onClick={handleClick}
    >
      <div className="flex items-center gap-3 flex-1">
        {item.imageUrl && (
          <div className="relative">
            <img 
              src={item.imageUrl} 
              alt={item.name}
              className="w-12 h-12 rounded-lg object-cover bg-muted"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
              <Info className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground group-hover:text-primary transition-colors">
              {item.name}
            </span>
            {(item.isConsumable || item.isSalesItem) && (
              <Badge variant="outline" className="text-xs">Purchase</Badge>
            )}
          </div>
          {item.selectionGuidance && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {item.selectionGuidance}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {(item.isConsumable || item.isSalesItem) ? (
              <span className="text-sm text-muted-foreground">
                ${item.dailyRate.toFixed(2)} each
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                ${(item.firstDayRate ?? item.dailyRate).toFixed(2)} first day · ${item.dailyRate.toFixed(2)}/day after
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {item.booqableId && (
          <div className="booqable-product-button" data-id={item.booqableId}></div>
        )}
        <div className="quantity-selector">
          <QuantitySelector
            quantity={item.quantity}
            onQuantityChange={(qty) => onQuantityChange(item.id, qty)}
          />
        </div>
      </div>
    </div>
  );
};

export default EquipmentItem;
