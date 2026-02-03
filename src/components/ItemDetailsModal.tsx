import { RentalItem } from '@/types/rental';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Info, DollarSign, Wrench, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import QuantitySelector from './QuantitySelector';
import PriceComparisonAccordion from './PriceComparisonAccordion';
interface ItemDetailsModalProps {
  item: RentalItem | null;
  open: boolean;
  onClose: () => void;
  onQuantityChange: (id: string, quantity: number) => void;
}
const ItemDetailsModal = ({
  item,
  open,
  onClose,
  onQuantityChange
}: ItemDetailsModalProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const booqableButtonRef = useRef<HTMLDivElement>(null);

  // Trigger Booqable refresh when modal opens with an item that has a booqableId
  useEffect(() => {
    if (open && item?.booqableId) {
      // Give DOM time to render, then trigger Booqable refresh
      const timer = setTimeout(() => {
        const api = (window as any).Booqable || (window as any).booqable;
        if (api?.refresh) api.refresh();
        if (api?.trigger) api.trigger('page-change');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, item?.booqableId]);
  if (!item) return null;
  const images = item.images?.length ? item.images : item.imageUrl ? [item.imageUrl] : [];
  const hasMultipleImages = images.length > 1;
  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % images.length);
  };
  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
  };

  return <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.name}
            {item.isConsumable && <Badge variant="outline" className="text-xs">Purchase</Badge>}
          </DialogTitle>
          <DialogDescription>
            {item.isConsumable ? 'Purchase item details' : 'Rental equipment details and booking'}
          </DialogDescription>
        </DialogHeader>

        {/* Image Gallery */}
        {images.length > 0 && <div className="relative">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img src={images[currentImageIndex]} alt={item.name} className="w-full h-full object-cover" />
            </div>
            {hasMultipleImages && <>
                <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background" onClick={prevImage}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background" onClick={nextImage}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, idx) => <div key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-primary' : 'bg-muted-foreground/50'}`} />)}
                </div>
              </>}
          </div>}

        {/* Price Comparison */}
        <div className="bg-secondary/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Pricing</span>
          </div>
          {item.isConsumable ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Retail Price</p>
                <p className="text-lg font-bold text-muted-foreground line-through">
                  ${item.retailPrice.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Our Price</p>
                <p className="text-lg font-bold text-primary">
                  ${item.dailyRate.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">First Day</p>
                  <p className="text-lg font-bold text-primary">
                    ${(item.firstDayRate ?? item.dailyRate).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Includes delivery & setup</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily Rate After</p>
                  <p className="text-lg font-bold text-primary">
                    ${item.dailyRate.toFixed(2)}/day
                  </p>
                  <p className="text-xs text-muted-foreground">Flat fee per day</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Retail Value: <span className="line-through">${item.retailPrice.toFixed(2)}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Price Comparison Accordion - only for rental items */}
        {!item.isConsumable && !item.isSalesItem && (
          <PriceComparisonAccordion
            itemId={item.id}
            itemName={item.name}
            rentalDailyRate={item.dailyRate}
            rentalFirstDayRate={item.firstDayRate ?? item.dailyRate}
          />
        )}
        {item.description && <div>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Description</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          </div>}

        <Separator />

        {/* Usage Tips */}
        {item.usage && <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">How to Use</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.usage}
            </p>
          </div>}

        {/* Specifications */}
        {item.specifications && item.specifications.length > 0 && <div>
            <span className="font-semibold text-sm">Specifications</span>
            <div className="mt-2 space-y-1">
              {item.specifications.map((spec, idx) => <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{spec.label}</span>
                  <span className="font-medium">{spec.value}</span>
                </div>)}
            </div>
          </div>}

        <Separator />

        {/* Booqable Add to Cart (if available) */}
        {item.booqableId}

        <Separator />

        {/* Add to Order */}
        <div className="flex items-center justify-between">
          <span className="font-medium">Add to Order</span>
          <QuantitySelector quantity={item.quantity} onQuantityChange={qty => onQuantityChange(item.id, qty)} />
        </div>
      </DialogContent>
    </Dialog>;
};
export default ItemDetailsModal;