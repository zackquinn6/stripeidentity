import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, TrendingDown, ArrowLeft } from 'lucide-react';
import { RentalItem } from '@/types/rental';

interface CheckoutSummaryProps {
  items: RentalItem[];
  rentalDays: number;
  onBack: () => void;
}

const CheckoutSummary = ({ items, rentalDays, onBack }: CheckoutSummaryProps) => {
  const rentals = items.filter(item => !item.isConsumable && item.quantity > 0);
  const consumables = items.filter(item => item.isConsumable && item.quantity > 0);

  const rentalTotal = rentals.reduce((sum, item) => sum + (item.dailyRate * item.quantity * rentalDays), 0);
  const consumableTotal = consumables.reduce((sum, item) => sum + (item.dailyRate * item.quantity), 0);
  const grandTotal = rentalTotal + consumableTotal;

  const retailTotal = items
    .filter(item => item.quantity > 0)
    .reduce((sum, item) => sum + (item.retailPrice * item.quantity), 0);
  
  const savings = retailTotal - grandTotal;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <Button 
        variant="ghost" 
        onClick={onBack}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Ordering
      </Button>

      <Card className="shadow-elevated">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-2xl flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Order Summary
          </CardTitle>
          <p className="text-muted-foreground">
            {rentalDays}-day rental period
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Rental Items */}
          {rentals.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                Rental Items
                <Badge variant="secondary">{rentals.length}</Badge>
              </h3>
              <div className="space-y-2">
                {rentals.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 px-3 bg-secondary/30 rounded-lg">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">
                        ${(item.dailyRate * item.quantity * rentalDays).toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        ${item.dailyRate.toFixed(2)}/day × {rentalDays} days
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 font-semibold">
                Subtotal: ${rentalTotal.toFixed(2)}
              </div>
            </div>
          )}

          {/* Consumables */}
          {consumables.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                Materials & Consumables
                <Badge variant="outline">Purchase</Badge>
              </h3>
              <div className="space-y-2">
                {consumables.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 px-3 bg-amber-soft rounded-lg">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                    </div>
                    <span className="font-medium">
                      ${(item.dailyRate * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-right mt-2 font-semibold">
                Subtotal: ${consumableTotal.toFixed(2)}
              </div>
            </div>
          )}

          <Separator />

          {/* Totals */}
          <div className="space-y-3">
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-primary">${grandTotal.toFixed(2)}</span>
            </div>

            {savings > 0 && (
              <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg border border-success/20">
                <div className="flex items-center gap-2 text-success">
                  <TrendingDown className="w-5 h-5" />
                  <span className="font-semibold">Savings vs. Buying</span>
                </div>
                <span className="font-bold text-success text-lg">
                  ${savings.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">📝 Note:</p>
            <p>
              You'll need to buy tile and underlayment separately — we'll bring the rest. 
              We recommend <span className="text-primary font-medium">Floor & Decor</span> for materials.
            </p>
          </div>

          <Button size="lg" className="w-full">
            Proceed to Checkout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSummary;
