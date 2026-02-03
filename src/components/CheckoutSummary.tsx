import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  ArrowLeft, 
  CalendarDays, 
  Check, 
  Truck, 
  Shield, 
  Clock, 
  Wrench,
  Package,
  ArrowRight,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertCircle,
  LogIn,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RentalItem } from '@/types/rental';
import { format, addDays } from 'date-fns';
import { useBooqableOrder } from '@/hooks/useBooqableOrder';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface CheckoutSummaryProps {
  items: RentalItem[];
  rentalDays: number;
  startDate?: Date;
  onBack: () => void;
}

const DAY_1_FEE = 150; // Processing, delivery, damage waiver
const DAY_2_PLUS_RATE = 25; // Flat fee per additional day

const CheckoutSummary = ({ items, rentalDays, startDate, onBack }: CheckoutSummaryProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCreating, error: orderError, checkoutUrl, createOrder, redirectToCheckout, reset } = useBooqableOrder();
  
  const rentals = items.filter(item => !item.isConsumable && item.quantity > 0);
  const consumables = items.filter(item => item.isConsumable && item.quantity > 0);

  const consumableTotal = consumables.reduce((sum, item) => sum + (item.dailyRate * item.quantity), 0);
  
  // New pricing model: Day 1 + (Days - 1) * flat rate
  const additionalDays = Math.max(0, rentalDays - 1);
  const rentalTotal = DAY_1_FEE + (additionalDays * DAY_2_PLUS_RATE);
  const grandTotal = rentalTotal + consumableTotal;

  // Comparison totals (purchase instead of rent)
  const proPurchaseTotal = items.reduce((sum, item) => sum + (item.retailPrice * item.quantity), 0);
  const budgetPurchaseTotal = proPurchaseTotal * 0.5;

  const benefits = [
    { icon: Truck, text: 'Free delivery & pickup' },
    { icon: Shield, text: 'Damage waiver included' },
    { icon: Wrench, text: 'Pro-grade tools, properly maintained' },
    { icon: Clock, text: 'Save 10–15 hours of research & shopping' },
    { icon: RefreshCw, text: 'No storage, no depreciation, no clutter' },
    { icon: Package, text: 'Everything curated for your specific project' },
  ];

  // Benefits page (shown first)
  if (!showDetails) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Ordering
        </Button>

        <Card className="shadow-elevated overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pb-6">
            <Badge variant="secondary" className="w-fit bg-primary/20 text-primary border-0 mb-2">
              Why Rent With Us?
            </Badge>
            <CardTitle className="font-display text-2xl md:text-3xl">
              The Smart Way to DIY
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Get everything you need without the commitment of buying
            </p>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Benefits list */}
            <div className="grid gap-4">
              {benefits.map((benefit, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg"
                >
                  <div className="p-2 rounded-full bg-success/10">
                    <benefit.icon className="w-5 h-5 text-success" />
                  </div>
                  <span className="font-medium">{benefit.text}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Price comparison teaser */}
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">Ready to see your total?</p>
              <Button 
                size="lg" 
                className="w-full"
                disabled={isGenerating}
                onClick={() => {
                  setIsGenerating(true);
                  setTimeout(() => {
                    setIsGenerating(false);
                    setShowDetails(true);
                  }, 5000);
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating your order...
                  </>
                ) : (
                  <>
                    View Pricing Breakdown
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pricing details page
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
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
            Your Investment
          </CardTitle>
          {startDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              <span>
                {format(startDate, 'EEE, MMM d')} → {format(addDays(startDate, rentalDays), 'EEE, MMM d, yyyy')}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pricing breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">How pricing works:</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-start p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div>
                  <p className="font-semibold">Day 1</p>
                  <p className="text-sm text-muted-foreground">
                    Processing, delivery & damage waiver
                  </p>
                </div>
                <span className="font-bold text-lg">${DAY_1_FEE}</span>
              </div>

              {additionalDays > 0 && (
                <div className="flex justify-between items-start p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="font-semibold">Day 2–{rentalDays}</p>
                    <p className="text-sm text-muted-foreground">
                      ${DAY_2_PLUS_RATE}/day × {additionalDays} days
                    </p>
                  </div>
                  <span className="font-bold text-lg">${additionalDays * DAY_2_PLUS_RATE}</span>
                </div>
              )}

              {consumables.length > 0 && (
                <div className="flex justify-between items-start p-4 bg-amber-soft rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">Materials & Consumables</p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs p-4 space-y-2">
                            <p className="text-sm">
                              We focus on tool rental, which often includes standard consumables—those everyday items where brand or type doesn't really change the outcome.
                            </p>
                            <p className="text-sm">
                              For materials that are highly specific or visually important, like tiles or other finish surfaces, we recommend purchasing directly from a specialized retailer and using their home‑delivery options.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {consumables.length} items (one-time purchase)
                    </p>
                  </div>
                  <span className="font-bold text-lg">${consumableTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Your Total</span>
            <span className="text-primary">${grandTotal.toFixed(2)}</span>
          </div>

          <Separator />

          {/* Comparison */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">How does that compare?</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <div>
                  <p className="font-medium text-destructive">Amazon (pro-grade)</p>
                  <p className="text-sm text-muted-foreground">Buy it all, store it forever</p>
                </div>
                <span className="font-bold text-lg text-destructive">${proPurchaseTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-accent/50 rounded-lg border border-accent">
                <div>
                  <p className="font-medium text-accent-foreground">Home Depot (pro-grade)</p>
                  <p className="text-sm text-muted-foreground">Buy it all new, keep it forever</p>
                </div>
                <span className="font-bold text-lg text-accent-foreground">${proPurchaseTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg border border-border">
                <div>
                  <p className="font-medium">Budget/DIY options</p>
                  <p className="text-sm text-muted-foreground">Estimated ~50% of pro-grade purchases</p>
                </div>
                <span className="font-bold text-lg">${budgetPurchaseTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-success/10 rounded-lg border border-success/30">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-full bg-success/20 mt-0.5">
                    <Check className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-success">Toolio Package</p>
                    <p className="text-sm text-muted-foreground">
                      The right stuff, delivered, ready to help you succeed
                    </p>
                  </div>
                </div>
                <span className="font-bold text-xl text-success">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Items included (collapsible) */}
          {rentals.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                View {rentals.length} rental items included →
              </summary>
              <div className="mt-3 space-y-2 animate-fade-in">
                {rentals.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-secondary/30 rounded-lg text-sm">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded object-cover" />
                    )}
                    <span className="flex-1">{item.name}</span>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Consumables/Purchase items (collapsible) */}
          {consumables.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                <Package className="w-4 h-4" />
                View {consumables.length} purchase items →
              </summary>
              <div className="mt-3 space-y-2 animate-fade-in">
                {consumables.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-amber-soft rounded-lg text-sm">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded object-cover" />
                    )}
                    <span className="flex-1">{item.name}</span>
                    <Badge variant="outline" className="text-xs">Purchase</Badge>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                    <span className="font-medium">${(item.dailyRate * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-foreground">📝 Note:</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs p-4 space-y-2">
                    <p className="text-sm">
                      We focus on tool rental, which often includes standard consumables—those everyday items where brand or type doesn't really change the outcome.
                    </p>
                    <p className="text-sm">
                      For materials that are highly specific or visually important, like tiles or other finish surfaces, we recommend purchasing directly from a specialized retailer and using their home‑delivery options.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p>
              You'll need to buy tile and underlayment separately — we'll bring the rest. 
              We recommend <span className="text-primary font-medium">Floor & Decor</span> for materials.
            </p>
          </div>

          {orderError && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{orderError}</p>
              <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
                Retry
              </Button>
            </div>
          )}

          {checkoutUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-4 bg-success/10 border border-success/30 rounded-lg text-success">
                <Check className="w-5 h-5" />
                <p className="font-medium">Order created! Complete your booking on Booqable.</p>
              </div>
              <Button 
                size="lg" 
                className="w-full" 
                onClick={redirectToCheckout}
              >
                Complete Checkout
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-4 bg-warning/10 border border-warning/30 rounded-lg">
                <LogIn className="w-5 h-5 text-warning flex-shrink-0" />
                <p className="text-sm">Please sign in to complete your order.</p>
              </div>
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In to Checkout
              </Button>
            </div>
          ) : (
            <Button 
              size="lg" 
              className="w-full"
              disabled={isCreating || !startDate}
              onClick={async () => {
                if (!startDate) {
                  toast({
                    title: "Start date required",
                    description: "Please select a rental start date",
                    variant: "destructive"
                  });
                  return;
                }

                const booqableItems = rentals.filter(item => item.booqableId);
                if (booqableItems.length === 0) {
                  toast({
                    title: "No items available",
                    description: "None of the selected items can be booked online. Please contact us for availability.",
                    variant: "destructive"
                  });
                  return;
                }

                try {
                  const endDate = addDays(startDate, rentalDays);
                  await createOrder({
                    items: rentals,
                    startDate,
                    endDate,
                  });
                  toast({
                    title: "Order created!",
                    description: "Click the button to complete checkout.",
                  });
                } catch {
                  toast({
                    title: "Order failed",
                    description: "There was an error creating your order. Please try again.",
                    variant: "destructive"
                  });
                }
              }}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Order...
                </>
              ) : (
                'Proceed to Checkout'
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSummary;