import { RentalItem } from '@/types/rental';
import QuantitySelector from './QuantitySelector';
import { Badge } from '@/components/ui/badge';

interface EquipmentItemProps {
  item: RentalItem;
  onQuantityChange: (id: string, quantity: number) => void;
}

const EquipmentItem = ({ item, onQuantityChange }: EquipmentItemProps) => {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
      <div className="flex items-center gap-3 flex-1">
        {item.imageUrl && (
          <img 
            src={item.imageUrl} 
            alt={item.name}
            className="w-12 h-12 rounded-lg object-cover bg-muted"
          />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{item.name}</span>
            {item.isConsumable && (
              <Badge variant="outline" className="text-xs">Purchase</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {item.isConsumable ? (
              <span className="text-sm text-muted-foreground">
                ${item.dailyRate.toFixed(2)} each
              </span>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">
                  ${item.dailyRate.toFixed(2)}/day
                </span>
                <span className="text-xs text-muted-foreground">
                  (Retail: ${item.retailPrice})
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <QuantitySelector
        quantity={item.quantity}
        onQuantityChange={(qty) => onQuantityChange(item.id, qty)}
      />
    </div>
  );
};

export default EquipmentItem;
