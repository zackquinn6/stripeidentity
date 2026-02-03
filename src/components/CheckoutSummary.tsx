import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertCircle,
  LogIn,
  Info,
  TrendingDown
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
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-start generation on mount and handle progress
  useEffect(() => {
    if (!showDetails && !isGenerating && progress === 0) {
      setIsGenerating(true);
    }
  }, []);

  useEffect(() => {
    if (isGenerating) {
      const duration = 5000; // 5 seconds
      const interval = 50; // Update every 50ms for smooth animation
      const increment = (100 / duration) * interval;
      
      const timer = setInterval(() => {
        setProgress(prev => {
          const next = prev + increment;
          if (next >= 100) {
            clearInterval(timer);
            // Auto-advance after reaching 100%
            setTimeout(() => {
              setIsGenerating(false);
              setShowDetails(true);
            }, 200);
            return 100;
          }
          return next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [isGenerating]);
  const { isCreating, error: orderError, checkoutUrl, createOrder, redirectToCheckout, reset } = useBooqableOrder();
  
  const rentals = items.filter(item => !item.isConsumable && !item.isSalesItem && item.quantity > 0);
  const salesItems = items.filter(item => (item.isConsumable || item.isSalesItem));

  const consumableTotal = salesItems.filter(i => i.quantity > 0).reduce((sum, item) => sum + (item.dailyRate * item.quantity), 0);
  
  // New pricing model: Day 1 + (Days - 1) * flat rate
  const additionalDays = Math.max(0, rentalDays - 1);
  const rentalTotal = DAY_1_FEE + (additionalDays * DAY_2_PLUS_RATE);
  const grandTotal = rentalTotal + consumableTotal;

  // Comparison totals (purchase instead of rent) - simulated retailer prices
  const proPurchaseTotal = items.reduce((sum, item) => sum + (item.retailPrice * item.quantity), 0);
  const diyPurchaseTotal = proPurchaseTotal * 0.55; // DIY-grade is ~55% of pro
  const usedPurchaseTotal = proPurchaseTotal * 0.35; // Used is ~35% of pro

  // Calculate average savings across all options
  const allComparisonTotals = [proPurchaseTotal, diyPurchaseTotal, usedPurchaseTotal];
  const averageComparisonPrice = allComparisonTotals.reduce((a, b) => a + b, 0) / allComparisonTotals.length;
  const averageSavings = Math.max(0, averageComparisonPrice - grandTotal);

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

            {/* Progress bar and loading state */}
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                {isGenerating ? 'Generating your personalized order...' : 'Ready to see your total?'}
              </p>
              
              {isGenerating && (
                <div className="space-y-2 animate-fade-in">
                  <Progress value={progress} className="h-2" />
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Calculating best pricing...</span>
                  </div>
                </div>
              )}
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
            Your Order
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
              {/* Day 1 section with rental items accordion */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">Day 1</p>
                    <p className="text-sm text-muted-foreground">
                      Processing, delivery & damage waiver
                    </p>
                  </div>
                  <span className="font-bold text-lg">${DAY_1_FEE}</span>
                </div>
                
                {/* Rental items accordion under Day 1 */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="rental-items" className="border-0">
                    <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:text-foreground hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        View {rentals.length} rental items included
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
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
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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

              {/* Materials & Sales section - always show */}
              <div className="p-4 bg-amber-soft rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">Materials / Sales</p>
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
                      {salesItems.filter(i => i.quantity > 0).length} items (one-time purchase)
                    </p>
                  </div>
                  <span className="font-bold text-lg">${consumableTotal.toFixed(2)}</span>
                </div>

                {/* Sales items accordion */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="sales-items" className="border-0">
                    <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:text-foreground hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        View {salesItems.length} materials / sales items
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {salesItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-white/50 rounded-lg text-sm">
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
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Floor & Decor note - moved under materials/sales */}
                <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground mt-2">
                  <p>
                    📝 <strong className="text-foreground">Note:</strong> You'll need to buy tile and underlayment separately — we'll bring the rest. 
                    We recommend <span className="text-primary font-medium">Floor & Decor</span> for materials.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center text-2xl font-bold">
            <span>Your Total</span>
            <span className="text-primary">${grandTotal.toFixed(2)}</span>
          </div>

          <Separator />

          {/* Savings highlight and comparison accordion */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-success" />
                <h3 className="font-semibold text-lg">On average save ${averageSavings.toFixed(0)}</h3>
              </div>
              <Badge variant="secondary" className="bg-success/10 text-success border-0">
                vs buying
              </Badge>
            </div>
            
            {/* Toolio Package highlight */}
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

            {/* See the savings accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="savings-comparison" className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <span className="font-semibold">See the savings</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Pro-Grade New bucket */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-destructive flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-destructive"></span>
                        Pro-Grade New
                      </h4>
                      <div className="space-y-1 pl-5">
                        <div className="flex justify-between text-sm p-2 bg-destructive/5 rounded">
                          <span>Home Depot</span>
                          <span className="font-medium">${proPurchaseTotal.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-destructive/5 rounded">
                          <span>Amazon</span>
                          <span className="font-medium">${(proPurchaseTotal * 0.98).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-destructive/5 rounded">
                          <span>Lowe's</span>
                          <span className="font-medium">${(proPurchaseTotal * 1.02).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* DIY-Grade New bucket */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-warning flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-warning"></span>
                        DIY-Grade New
                      </h4>
                      <div className="space-y-1 pl-5">
                        <div className="flex justify-between text-sm p-2 bg-warning/10 rounded">
                          <span>Harbor Freight</span>
                          <span className="font-medium">${(diyPurchaseTotal * 0.9).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-warning/10 rounded">
                          <span>Amazon (budget brands)</span>
                          <span className="font-medium">${diyPurchaseTotal.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-warning/10 rounded">
                          <span>Walmart</span>
                          <span className="font-medium">${(diyPurchaseTotal * 1.05).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Used bucket */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-muted-foreground"></span>
                        Used
                      </h4>
                      <div className="space-y-1 pl-5">
                        <div className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                          <span>Facebook Marketplace</span>
                          <span className="font-medium">${usedPurchaseTotal.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                          <span>Craigslist</span>
                          <span className="font-medium">${(usedPurchaseTotal * 0.95).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                          <span>OfferUp</span>
                          <span className="font-medium">${(usedPurchaseTotal * 1.1).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Prices are estimates based on current market research. Actual prices may vary.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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