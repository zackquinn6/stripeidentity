import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  min?: number;
  max?: number;
}

const QuantitySelector = ({ 
  quantity, 
  onQuantityChange, 
  min = 0, 
  max = 10 
}: QuantitySelectorProps) => {
  const handleDecrease = () => {
    if (quantity > min) {
      onQuantityChange(quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (quantity < max) {
      onQuantityChange(quantity + 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleDecrease}
        disabled={quantity <= min}
      >
        <Minus className="w-4 h-4" />
      </Button>
      
      <span className="w-8 text-center font-semibold text-foreground">
        {quantity}
      </span>
      
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleIncrease}
        disabled={quantity >= max}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default QuantitySelector;
