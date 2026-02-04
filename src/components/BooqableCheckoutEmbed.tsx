import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ExternalLink, RefreshCw, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { RentalItem } from '@/types/rental';
import { format, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useBooqable } from '@/hooks/use-booqable';
import { booqableRefresh } from '@/lib/booqable/client';
interface BooqableCheckoutEmbedProps {
  items: RentalItem[];
  startDate: Date;
  rentalDays: number;
  onBack: () => void;
}

interface OrderState {
  isCreating: boolean;
  error: string | null;
  checkoutUrl: string | null;
  orderNumber: number | null;
  orderId: string | null;
}

/**
 * Embeds the Booqable hosted checkout directly in the page.
 * 
 * This component:
 * 1. Creates an order via backend API with items + rental period
 * 2. Adds line items for each rental item
 * 3. Gets the checkout URL and embeds it in an iframe
 * 
 * This is the reliable path - it uses documented Booqable APIs rather than
 * attempting to manipulate the client-side widget which has no public API.
 */
const BooqableCheckoutEmbed = ({ 
  items, 
  startDate, 
  rentalDays, 
  onBack 
}: BooqableCheckoutEmbedProps) => {
  // Initialize Booqable script and observe for new buttons
  useBooqable();
  
  const [state, setState] = useState<OrderState>({
    isCreating: false,
    error: null,
    checkoutUrl: null,
    orderNumber: null,
    orderId: null,
  });
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Refresh Booqable when iframe loads to pick up the product button
  useEffect(() => {
    if (iframeLoaded) {
      // Give the DOM a moment to settle, then refresh Booqable
      const timer = setTimeout(() => {
        booqableRefresh();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [iframeLoaded]);

  const endDate = addDays(startDate, rentalDays);

  // Filter to rental items with booqableId
  const rentalItems = items.filter(
    (item) => item.booqableId && item.quantity > 0 && !item.isConsumable && !item.isSalesItem
  );

  const createOrderAndGetCheckoutUrl = async () => {
    setState({ isCreating: true, error: null, checkoutUrl: null, orderNumber: null, orderId: null });
    setIframeLoaded(false);

    try {
      // Format dates with timezone
      const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
      const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

      console.log('[BooqableCheckoutEmbed] Creating order with dates:', startsAt, '→', stopsAt);

      // Step 1: Create the order with all items included
      // Per Booqable guidance: Create order with all items and dates in one call
      const lines = rentalItems.map(item => ({
        product_id: item.booqableId!,
        quantity: item.quantity,
      }));

      console.log(`[BooqableCheckoutEmbed] Creating order with ${lines.length} items...`);

      const { data: orderData, error: orderError } = await supabase.functions.invoke('booqable', {
        body: {
          action: 'create-order',
          starts_at: startsAt,
          stops_at: stopsAt,
          lines: lines,
        }
      });

      if (orderError) {
        throw new Error(orderError.message || 'Failed to create order');
      }

      const orderId = orderData.order?.id;
      if (!orderId) {
        throw new Error('Order created but no ID returned');
      }

      console.log(`[BooqableCheckoutEmbed] Order created: ${orderId} with ${lines.length} items`);

      // Step 2: Book/reserve the order and get checkout URL
      // Per Booqable guidance: order must be booked before checkout is available
      // Pass rental period dates explicitly to ensure checkout widget displays them correctly
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('booqable', {
        body: {
          action: 'get-checkout-url',
          order_id: orderId,
          book_order: true, // Reserve stock and enable checkout
          starts_at: startsAt, // Pass dates explicitly so checkout widget receives rental period
          stops_at: stopsAt,
        }
      });

      if (checkoutError) {
        throw new Error(checkoutError.message || 'Failed to get checkout URL');
      }

      const checkoutUrl = checkoutData?.checkoutUrl;
      const orderNumber = checkoutData?.orderNumber;

      if (!checkoutUrl) {
        throw new Error('No checkout URL returned');
      }

      console.log(`[BooqableCheckoutEmbed] Checkout URL: ${checkoutUrl}, Order #${orderNumber}`);

      setState({
        isCreating: false,
        error: null,
        checkoutUrl,
        orderNumber,
        orderId,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create order';
      console.error('[BooqableCheckoutEmbed] Error:', message);
      setState(prev => ({
        ...prev,
        isCreating: false,
        error: message,
      }));
    }
  };

  // Auto-create order on mount
  useEffect(() => {
    if (rentalItems.length > 0 && !state.checkoutUrl && !state.isCreating && !state.error) {
      createOrderAndGetCheckoutUrl();
    }
  }, []);

  // Loading state
  if (state.isCreating) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Creating Your Order</h3>
            <p className="text-muted-foreground">
              Setting up your rental for {format(startDate, 'MMM d')} → {format(endDate, 'MMM d, yyyy')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (state.error) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <h3 className="font-semibold">Unable to Create Order</h3>
          </div>
          <p className="text-muted-foreground">{state.error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={createOrderAndGetCheckoutUrl}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No items state
  if (rentalItems.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertCircle className="w-6 h-6" />
            <h3 className="font-semibold">No Rental Items Selected</h3>
          </div>
          <p className="text-muted-foreground">
            Please go back and select at least one rental item to proceed to checkout.
          </p>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Selection
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Checkout embed
  if (state.checkoutUrl) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {state.orderNumber && (
              <span className="text-sm text-muted-foreground">
                Order #{state.orderNumber}
              </span>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(state.checkoutUrl!, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="bg-success/10 border-b">
            <CardTitle className="flex items-center gap-2 text-success">
              <Check className="w-5 h-5" />
              Order Created Successfully
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Complete your checkout below. Your rental period: {format(startDate, 'MMM d')} → {format(endDate, 'MMM d, yyyy')}
            </p>
          </CardHeader>
          <CardContent className="p-0 relative">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            <iframe
              src={state.checkoutUrl}
              className="w-full border-0"
              style={{ height: '700px', minHeight: '500px' }}
              onLoad={() => setIframeLoaded(true)}
              title="Booqable Checkout"
              allow="payment"
            />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Having trouble? <button className="underline hover:text-foreground" onClick={() => window.open(state.checkoutUrl!, '_blank')}>Open checkout in a new tab</button>
        </p>

        {/* Add-on product button */}
        <div className="mt-6 p-4 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-2">Need additional tools?</p>
          <div className="booqable-product-button" data-id="channel-lock-pliers"></div>
        </div>
      </div>
    );
  }

  return null;
};

export default BooqableCheckoutEmbed;
