import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Truck, 
  Shield, 
  Clock, 
  Wrench,
  Package,
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingDown,
  Check
} from 'lucide-react';
import { RentalItem } from '@/types/rental';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useBooqable } from '@/hooks/use-booqable';
import { useBooqableOrder } from '@/hooks/useBooqableOrder';
import { useBooqableIdMap } from '@/hooks/useBooqableIdMap';
import { getBooqableApi, booqableRefresh } from '@/lib/booqable/client';

interface CheckoutSummaryProps {
  items: RentalItem[];
  rentalDays: number;
  startDate?: Date;
  onBack: () => void;
}


const CheckoutSummary = ({ items, rentalDays, startDate, onBack }: CheckoutSummaryProps) => {
  // ========================================
  // VERSION 4.0: ORDER-BASED CART POPULATION
  // Date: 2024-02-04
  // This version creates an order via API and loads it into the cart widget
  // ========================================
  console.log('🚀 [CheckoutSummary v4.0] Component loaded - Order-based cart population');
  console.log('🚀 [CheckoutSummary v4.0] Creating order via API and loading into cart widget');
  
  // Initialize Booqable script for add-on product buttons
  useBooqable();

  // Slug → UUID mapping (Booqable embeds require UUIDs in data-id)
  const { slugToUuid, isLoading: isIdMapLoading } = useBooqableIdMap();
  
  const [showDetails, setShowDetails] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cartSynced, setCartSynced] = useState(false);

  // Nudge the library after the add-on placeholders render with resolved IDs.
  useEffect(() => {
    if (isIdMapLoading) return;
    const t = setTimeout(() => booqableRefresh(), 0);
    return () => clearTimeout(t);
  }, [isIdMapLoading]);

  // Use BooqableOrder to create order, then load it into cart widget
  const { createOrder, isCreating: isOrderCreating, error: orderError } = useBooqableOrder();
  // Fetch app options for delivery/pickup visibility
  const { data: checkoutSettings } = useQuery({
    queryKey: ['app-options', 'checkout_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_options')
        .select('value')
        .eq('key', 'checkout_settings')
        .single();
      
      if (error) return { show_delivery_pickup: true };
      return data.value as unknown as { show_delivery_pickup: boolean };
    },
  });

  const showDeliveryPickup = checkoutSettings?.show_delivery_pickup ?? true;

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

  const rentals = items.filter(item => !item.isConsumable && !item.isSalesItem && item.quantity > 0);
  const salesItems = items.filter(item => (item.isConsumable || item.isSalesItem));

  const consumableTotal = salesItems.filter(i => i.quantity > 0).reduce((sum, item) => sum + (item.dailyRate * item.quantity), 0);
  
  // Calculate Day 1 and Day 2+ totals separately
  const day1Total = rentals.reduce((sum, item) => {
    const firstDayRate = item.firstDayRate ?? item.dailyRate;
    return sum + (firstDayRate * item.quantity);
  }, 0);
  
  const additionalDays = Math.max(0, rentalDays - 1);
  const day2PlusTotal = rentals.reduce((sum, item) => {
    return sum + (item.dailyRate * item.quantity * additionalDays);
  }, 0);
  
  const rentalTotal = day1Total + day2PlusTotal;
  const grandTotal = rentalTotal + consumableTotal;

  // Comparison totals (purchase instead of rent) - simulated retailer prices
  const proPurchaseTotal = items.reduce((sum, item) => sum + (item.retailPrice * item.quantity), 0);
  const diyPurchaseTotal = proPurchaseTotal * 0.55; // DIY-grade is ~55% of pro
  const usedPurchaseTotal = proPurchaseTotal * 0.35; // Used is ~35% of pro

  // Calculate average savings across all options
  const allComparisonTotals = [proPurchaseTotal, diyPurchaseTotal, usedPurchaseTotal];
  const averageComparisonPrice = allComparisonTotals.reduce((a, b) => a + b, 0) / allComparisonTotals.length;
  const averageSavings = Math.max(0, averageComparisonPrice - grandTotal);
  const isLowSavings = averageSavings < 50;

  const benefits = [
    { icon: Truck, text: 'Free delivery & pickup' },
    { icon: Shield, text: 'Damage waiver included' },
    { icon: Wrench, text: 'Pro-grade tools, properly maintained' },
    { icon: Clock, text: 'Save 10–15 hours of research & shopping' },
    { icon: RefreshCw, text: 'No storage, no depreciation, no clutter' },
    { icon: Package, text: 'Everything curated for your specific project' },
  ];

  // Handle cart sync when checkout is initiated
  // Creates order via API and loads it into the existing cart widget
  const handleProceedToCheckout = async () => {
    console.log('========================================');
    console.log('ORDER CREATION v4.0 - Loading order into cart widget');
    console.log('Timestamp:', new Date().toISOString());
    console.log('========================================');
    setValidationError(null);

    if (!startDate) {
      setValidationError('Please select a rental start date');
      return;
    }

    const booqableItems = rentals.filter((item) => item.booqableId);
    if (booqableItems.length === 0) {
      setValidationError(
        'None of the selected items can be booked online. Please contact us for availability.'
      );
      return;
    }

    // Calculate end date
    const endDate = addDays(startDate, rentalDays);

    try {
      // Step 1: Create order via API
      console.log('[CheckoutSummary] Creating order via API with', booqableItems.length, 'items');
      const { orderId, checkoutUrl } = await createOrder({ 
        items: booqableItems, 
        startDate, 
        endDate 
      });
      
      console.log('[CheckoutSummary] Order created:', orderId);
      
      // Step 2: Add items directly to cart widget using Booqable JavaScript API
      // Use the original items we already have - no need to fetch from order
      const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
      const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
      
      // Update URL with dates first
      const url = new URL(window.location.href);
      url.searchParams.set('starts_at', startsAt);
      url.searchParams.set('stops_at', stopsAt);
      window.history.replaceState({}, '', url.toString());
      
      // Wait for Booqable API to be available (with timeout)
      let api = getBooqableApi();
      let attempts = 0;
      const maxAttempts = 20;
      
      while (!api && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        api = getBooqableApi();
        attempts++;
      }
      
      if (!api) {
        console.warn('[CheckoutSummary] Booqable API not available after waiting');
        // Still set cart synced - URL params might work
        setCartSynced(true);
        return;
      }
      
      const cart = api?.cart;
      
      if (cart) {
        console.log('[CheckoutSummary] Booqable API and cart available');
        console.log('[CheckoutSummary] Available cart methods:', Object.keys(cart).filter(k => typeof cart[k] === 'function'));
        console.log('[CheckoutSummary] Cart object:', cart);
        
        // Try to set dates via API
        const dateMethods = [
          { name: 'cart.setTimespan', fn: cart.setTimespan },
          { name: 'cart.setPeriod', fn: cart.setPeriod },
          { name: 'cart.setDates', fn: cart.setDates },
          { name: 'cart.setRentalPeriod', fn: cart.setRentalPeriod },
        ];
        
        for (const method of dateMethods) {
          if (typeof method.fn === 'function') {
            try {
              method.fn(startsAt, stopsAt);
              console.log(`[CheckoutSummary] Set dates via ${method.name}`);
              break;
            } catch (e) {
              try {
                method.fn({ starts_at: startsAt, stops_at: stopsAt });
                console.log(`[CheckoutSummary] Set dates via ${method.name} (object)`);
                break;
              } catch (e2) {
                // continue
              }
            }
          }
        }
        
        // Prepare items for cart - use product_group_id format
        const itemsToAdd = booqableItems.map(item => ({
          product_group_id: item.booqableId,
          quantity: item.quantity,
        }));
        
        console.log('[CheckoutSummary] Adding', itemsToAdd.length, 'items to cart via API:', itemsToAdd);
        
        // Try batch add methods first
        const batchMethods = [
          { name: 'cart.addItems', fn: cart.addItems },
          { name: 'cart.addLineItems', fn: cart.addLineItems },
          { name: 'cart.addLines', fn: cart.addLines },
        ];
        
        let itemsAdded = false;
        for (const method of batchMethods) {
          if (typeof method.fn === 'function') {
            try {
              method.fn(itemsToAdd);
              console.log(`[CheckoutSummary] ✅ Added items via ${method.name}`);
              itemsAdded = true;
              break;
            } catch (e) {
              console.log(`[CheckoutSummary] ${method.name} failed:`, e);
            }
          }
        }
        
        // Fallback: add items one by one
        if (!itemsAdded) {
          console.log('[CheckoutSummary] Batch methods failed, trying per-item methods');
          const perItemMethods = [
            { name: 'cart.addItem', fn: cart.addItem },
            { name: 'cart.addProductGroup', fn: cart.addProductGroup },
            { name: 'cart.add', fn: cart.add },
          ];
          
          let successCount = 0;
          for (const item of itemsToAdd) {
            const productId = item.product_group_id;
            const quantity = item.quantity;
            
            let itemAdded = false;
            for (const method of perItemMethods) {
              if (typeof method.fn === 'function') {
                try {
                  // Try string, quantity format
                  method.fn(productId, quantity);
                  console.log(`[CheckoutSummary] ✅ Added item via ${method.name}:`, productId, quantity);
                  itemAdded = true;
                  successCount++;
                  break;
                } catch (e) {
                  try {
                    // Try object format
                    method.fn({ product_group_id: productId, quantity });
                    console.log(`[CheckoutSummary] ✅ Added item via ${method.name} (object):`, productId, quantity);
                    itemAdded = true;
                    successCount++;
                    break;
                  } catch (e2) {
                    // continue
                  }
                }
              }
            }
            
            if (!itemAdded) {
              console.warn(`[CheckoutSummary] ❌ Could not add item:`, productId, quantity);
            }
          }
          
          console.log(`[CheckoutSummary] Added ${successCount}/${itemsToAdd.length} items to cart`);
        }
        
        // Refresh cart to update display
        setTimeout(() => {
          booqableRefresh();
          console.log('[CheckoutSummary] Refreshed Booqable widget');
        }, 500);
      } else {
        console.warn('[CheckoutSummary] Booqable cart not available');
        // Fallback: Update URL with order_id and dates
        url.searchParams.set('order_id', orderId);
        window.history.replaceState({}, '', url.toString());
        
        setTimeout(() => {
          booqableRefresh();
        }, 500);
      }
      
      setCartSynced(true);
      console.log('[CheckoutSummary] Order loaded into cart widget successfully');
    } catch (error) {
      console.error('[CheckoutSummary] Failed to create/load order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order. Please try again.';
      setValidationError(errorMessage);
    }
  };

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
                    <span>Assembling your order...</span>
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
            <div className="space-y-3">
              {/* Day 1 section with rental items accordion */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">Day 1</p>
                    <p className="text-sm text-muted-foreground">
                      Includes delivery & damage waiver
                    </p>
                  </div>
                  <span className="font-bold text-lg">${day1Total.toFixed(2)}</span>
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
                        {rentals.map((item) => {
                          const firstDay = item.firstDayRate ?? item.dailyRate;
                          return (
                            <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-secondary/30 rounded-lg text-sm">
                              {item.imageUrl && (
                                <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded object-cover" />
                              )}
                              <span className="flex-1">{item.name}</span>
                              <span className="text-muted-foreground">×{item.quantity}</span>
                              <span className="font-medium">${(firstDay * item.quantity).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {additionalDays > 0 && (
                <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">Day 2–{rentalDays}</p>
                      <p className="text-sm text-muted-foreground">
                        {additionalDays} additional day{additionalDays > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="font-bold text-lg">${day2PlusTotal.toFixed(2)}</span>
                  </div>
                  
                  {/* Day 2+ items accordion */}
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="day2-items" className="border-0">
                      <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:text-foreground hover:no-underline">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          View daily rates
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pt-2">
                          {rentals.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-lg text-sm">
                              {item.imageUrl && (
                                <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded object-cover" />
                              )}
                              <span className="flex-1">{item.name}</span>
                              <span className="text-muted-foreground">${item.dailyRate.toFixed(2)}/day × {item.quantity}</span>
                              <span className="font-medium">${(item.dailyRate * item.quantity * additionalDays).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

              {/* Materials & Sales section - always show */}
              <div className="p-4 bg-amber-soft rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">Materials / Sales</p>
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
              </div>

              {/* Delivery & Pickup */}
              {showDeliveryPickup && (
                <div className="p-4 bg-success/10 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-success" />
                      <p className="font-semibold">Delivery & Pickup</p>
                    </div>
                    <span className="font-bold text-lg text-success">Free</span>
                  </div>
                </div>
              )}

              {/* Your Responsibility note - outside materials container */}
              <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                <p>
                  📝 <strong className="text-foreground">Your Responsibility:</strong> You'll need to buy tile and underlayment separately — we'll bring the rest. 
                  We recommend <span className="text-primary font-medium">Floor & Decor</span> for materials.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center p-4 border-2 border-foreground rounded-lg">
            <span className="text-2xl font-bold">Your Total</span>
            <span className="text-2xl font-bold">${grandTotal.toFixed(2)}</span>
          </div>

          <Separator />

          {/* Savings section - conditional based on savings amount */}
          <div className="space-y-4">
            {isLowSavings ? (
              /* Low savings accordion explanation */
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="savings-explanation" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span className="font-semibold">Learn about your expected savings</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <p>
                        Most Toolio rentals save customers money compared to buying tools outright. For this project, the specific tools and rental length mean the savings may be smaller than usual. We want to be upfront about that while also highlighting what you do gain.
                      </p>
                      <p className="font-medium text-foreground">
                        You'll never pay more than retail for any item—ever. That's our commitment, and this project is no exception.
                      </p>
                      <p>
                        Even when the dollar savings aren't the headline, the value still is:
                      </p>
                      <ul className="space-y-2 list-none">
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                          <span>No storing bulky tools you'll rarely use</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                          <span>Pro‑grade, well‑maintained equipment</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                          <span>Delivery to your home</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                          <span>The right mix of tools curated for your project</span>
                        </li>
                      </ul>
                      <p>
                        Toolio exists to make your project easier, faster, and more successful than buying tools the traditional way—even in cases where the savings aren't the main benefit.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              /* Normal savings display */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-success" />
                  <h3 className="font-semibold text-lg">Your expected savings: ${averageSavings.toFixed(0)}</h3>
                </div>
                <Badge variant="secondary" className="bg-success/10 text-success border-0">
                  vs buying
                </Badge>
              </div>
            )}

            {/* See the savings accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="savings-comparison" className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <span className="font-semibold">See how pricing compares</span>
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

          {/* Add-on product buttons */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-3">Need additional tools?</p>
            {isIdMapLoading ? (
              <p className="text-sm text-muted-foreground">Loading add-ons…</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {([
                  'channel-lock-pliers',
                  'headlamp',
                ] as const).map((slug) => {
                  const resolvedId = slugToUuid[slug] || slug;
                  return (
                    <div
                      key={slug}
                      className="booqable-product-button"
                      data-id={resolvedId}
                      data-slug={slug}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Inline validation error */}
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{validationError}</p>
            </div>
          )}

          {/* Order creation error */}
          {orderError && !cartSynced && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{orderError}</p>
            </div>
          )}

          {/* Success message when cart is synced */}
          {cartSynced && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm">
              <Check className="w-4 h-4 flex-shrink-0" />
              <p>Items added to cart. Complete your checkout below.</p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={isOrderCreating || !startDate || cartSynced}
            onClick={handleProceedToCheckout}
          >
            {isOrderCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Order...
              </>
            ) : cartSynced ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Order Loaded in Cart
              </>
            ) : (
              'Proceed to Checkout'
            )}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
};

export default CheckoutSummary;