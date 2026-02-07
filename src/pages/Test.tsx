import { useState, useEffect, useRef } from 'react';
import { format, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyRentalPeriod, getBooqableApi, booqableRefresh } from '@/lib/booqable/client';
import { useBooqable } from '@/hooks/use-booqable';

const Test = () => {
  // Initialize Booqable script
  useBooqable();

  // Set default dates: Feb 15-25, 2026 (start of day)
  const defaultStartDate = startOfDay(new Date(2026, 1, 15)); // Month is 0-indexed, so 1 = February
  const defaultEndDate = startOfDay(new Date(2026, 1, 25));

  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [cartDataState, setCartDataState] = useState<any>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const buttonRef = useRef<HTMLElement | null>(null);
  const clickHandlerRef = useRef<((e: Event) => void) | null>(null);

  // Refresh Booqable when product div is rendered
  useEffect(() => {
    const timer = setTimeout(() => {
      booqableRefresh();
      console.log('[Test] Refreshed Booqable after product div rendered');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Add comprehensive tracing/debugging for the Booqable product div
  useEffect(() => {
    const addLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `[${timestamp}] ${message}`;
      console.log(logMessage);
      setDebugLog(prev => [...prev.slice(-49), logMessage]); // Keep last 50 logs
    };

    addLog('🔍 Starting Booqable product div tracing...');

    // Find the Booqable product div and watch for enhancement
    const setupButtonTracing = () => {
      const container = document.getElementById('booqable-addon-products');
      if (!container) {
        addLog('⚠️ Container not found, retrying...');
        setTimeout(setupButtonTracing, 500);
        return;
      }

      const productDiv = container.querySelector('.booqable-product[data-id="sander"]');
      if (!productDiv) {
        addLog('⚠️ Booqable product div not found, retrying...');
        setTimeout(setupButtonTracing, 500);
        return;
      }

      // Watch for when Booqable enhances the div into a button
      const observer = new MutationObserver((mutations) => {
        const clickable = productDiv.querySelector('button, a, [role="button"], [data-action]');
        if (clickable && buttonRef.current !== clickable) {
          buttonRef.current = clickable as HTMLElement;
          addLog('✅ Booqable product enhanced! Found clickable element');
          addLog(`   Element type: ${clickable.tagName}`);
          addLog(`   Classes: ${clickable.className}`);
          addLog(`   Text: ${clickable.textContent?.trim() || 'N/A'}`);

          // Get cart state before click
          const api = getBooqableApi();
          const cartBefore = api?.cartData ? JSON.parse(JSON.stringify(api.cartData)) : null;
          addLog(`📊 Cart state before enhancement: ${cartBefore?.items?.length || 0} items`);

          // Add click listener to track what happens
          const clickHandler = (e: Event) => {
            addLog('🖱️ ========================================');
            addLog('🖱️ BOOQABLE PRODUCT BUTTON CLICKED!');
            addLog(`🖱️ Event type: ${e.type}`);
            addLog(`🖱️ Target: ${(e.target as HTMLElement)?.tagName} ${(e.target as HTMLElement)?.className}`);

            const api = getBooqableApi();
            const cartBeforeClick = api?.cartData ? JSON.parse(JSON.stringify(api.cartData)) : null;
            addLog(`📊 Cart BEFORE click: ${cartBeforeClick?.items?.length || 0} items`);
            if (cartBeforeClick?.items) {
              addLog(`   Items: ${JSON.stringify(cartBeforeClick.items.map((i: any) => ({ id: i.product_id || i.id, qty: i.quantity })))}`);
            }

            // Track cart state after click
            setTimeout(() => {
              const apiAfter = getBooqableApi();
              const cartAfter = apiAfter?.cartData ? JSON.parse(JSON.stringify(apiAfter.cartData)) : null;
              addLog(`📊 Cart AFTER click (500ms): ${cartAfter?.items?.length || 0} items`);
              if (cartAfter?.items) {
                addLog(`   Items: ${JSON.stringify(cartAfter.items.map((i: any) => ({ id: i.product_id || i.id, qty: i.quantity })))}`);
              }
              setCartDataState(cartAfter);
            }, 500);

            setTimeout(() => {
              const apiAfter = getBooqableApi();
              const cartAfter = apiAfter?.cartData ? JSON.parse(JSON.stringify(apiAfter.cartData)) : null;
              addLog(`📊 Cart AFTER click (1000ms): ${cartAfter?.items?.length || 0} items`);
              setCartDataState(cartAfter);
            }, 1000);

            setTimeout(() => {
              const apiAfter = getBooqableApi();
              const cartAfter = apiAfter?.cartData ? JSON.parse(JSON.stringify(apiAfter.cartData)) : null;
              addLog(`📊 Cart AFTER click (2000ms): ${cartAfter?.items?.length || 0} items`);
              setCartDataState(cartAfter);
              addLog('🖱️ ========================================');
            }, 2000);
          };

          clickHandlerRef.current = clickHandler;
          clickable.addEventListener('click', clickHandler, true);
          addLog('✅ Added click listener to Booqable product button');
        }
      });

      observer.observe(productDiv, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-id']
      });

      // Initial check in case it's already enhanced
      const clickable = productDiv.querySelector('button, a, [role="button"], [data-action]');
      if (clickable) {
        observer.disconnect();
        setupButtonTracing(); // Re-run to set up listener
      }

      addLog('✅ Watching for Booqable product enhancement...');
    };

    setupButtonTracing();
  }, []);

  // Function to add headlamp to cart using Booqable API
  const handleTestAddToCart = () => {
    const addLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `[${timestamp}] ${message}`;
      console.log(logMessage);
      setDebugLog(prev => [...prev.slice(-49), logMessage]);
    };

    addLog('🧪 ========================================');
    addLog('🧪 TEST ADD TO CART BUTTON CLICKED');
    addLog('🧪 Attempting to add headlamp to cart...');

    const api = getBooqableApi();
    const cartBefore = api?.cartData ? JSON.parse(JSON.stringify(api.cartData)) : null;
    addLog(`📊 Cart BEFORE: ${cartBefore?.items?.length || 0} items`);

    // Try using Booqable API directly
    if (api?.cart) {
      addLog('🔄 Trying Booqable API methods...');
      const cart = api.cart;
      const productId = 'sander';

      // Try various API methods
      const methods = [
        { name: 'cart.addItem', fn: cart.addItem },
        { name: 'cart.addProductGroup', fn: cart.addProductGroup },
        { name: 'cart.add', fn: cart.add },
        { name: 'api.addItem', fn: api.addItem },
        { name: 'api.addProductGroup', fn: api.addProductGroup },
      ];

      let methodWorked = false;
      for (const method of methods) {
        if (typeof method.fn === 'function') {
          try {
            method.fn(productId, 1);
            addLog(`✅ Called ${method.name}(${productId}, 1)`);
            methodWorked = true;
            break;
          } catch (e) {
            try {
              method.fn({ product_group_id: productId, quantity: 1 });
              addLog(`✅ Called ${method.name}({product_group_id: ${productId}, quantity: 1})`);
              methodWorked = true;
              break;
            } catch (e2) {
              // continue
            }
          }
        }
      }

      if (!methodWorked) {
        addLog('⚠️ No API methods worked, trying refresh...');
        booqableRefresh();
      }
    } else {
      addLog('❌ Booqable API or cart not available');
    }

    // Check cart state after
    setTimeout(() => {
      const apiAfter = getBooqableApi();
      const cartAfter = apiAfter?.cartData ? JSON.parse(JSON.stringify(apiAfter.cartData)) : null;
      addLog(`📊 Cart AFTER (500ms): ${cartAfter?.items?.length || 0} items`);
      setCartDataState(cartAfter);
    }, 500);

    setTimeout(() => {
      const apiAfter = getBooqableApi();
      const cartAfter = apiAfter?.cartData ? JSON.parse(JSON.stringify(apiAfter.cartData)) : null;
      addLog(`📊 Cart AFTER (2000ms): ${cartAfter?.items?.length || 0} items`);
      setCartDataState(cartAfter);
      addLog('🧪 ========================================');
    }, 2000);
  };

  const handleAddToCart = () => {
    if (!startDate || !endDate) {
      setStatus('Please select both start and end dates');
      return;
    }

    // Format dates in ISO format with timezone
    const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

    setStatus('Applying rental period...');
    console.log('[Test] ========================================');
    console.log('[Test] Setting rental period');
    console.log('[Test] Start Date:', startDate);
    console.log('[Test] End Date:', endDate);
    console.log('[Test] Formatted startsAt:', startsAt);
    console.log('[Test] Formatted stopsAt:', stopsAt);

    // Method 1: Update URL parameters (most reliable for widget)
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('starts_at', startsAt);
      url.searchParams.set('stops_at', stopsAt);
      window.history.replaceState({}, '', url.toString());
      console.log('[Test] ✅ Updated URL params:', url.toString());
    } catch (e) {
      console.error('[Test] ❌ Failed to update URL:', e);
    }

    // Method 2: Try Booqable API methods (with retries)
    const setDatesViaApi = () => {
      const api = getBooqableApi();
      if (!api) {
        console.log('[Test] Booqable API not ready, will retry...');
        return;
      }
      
      console.log('[Test] Booqable API available, setting dates...');
      console.log('[Test] API methods:', Object.keys(api).filter(k => typeof api[k] === 'function').slice(0, 20));
      console.log('[Test] API has cart:', !!api.cart);
      console.log('[Test] API has cartData:', !!api.cartData);
      
      const cart = api?.cart;
      const appliedMethods: string[] = [];
      
      // Method 2a: Try setCartData (available in the API)
      if (typeof api.setCartData === 'function') {
        try {
          api.setCartData({
            starts_at: startsAt,
            stops_at: stopsAt,
          });
          appliedMethods.push('api.setCartData');
          console.log('[Test] ✅ Called api.setCartData({starts_at, stops_at})');
        } catch (e) {
          console.warn('[Test] ❌ api.setCartData failed:', e);
        }
      }
      
      // Method 2b: Try setting cartData directly
      if (api.cartData) {
        try {
          api.cartData.starts_at = startsAt;
          api.cartData.stops_at = stopsAt;
          appliedMethods.push('cartData direct assignment');
          console.log('[Test] ✅ Set cartData.starts_at and cartData.stops_at directly');
          console.log('[Test] cartData after setting:', {
            starts_at: api.cartData.starts_at,
            stops_at: api.cartData.stops_at,
            items: api.cartData.items?.length || 0,
            fullCartData: api.cartData
          });
        } catch (e) {
          console.warn('[Test] ❌ Could not set cartData:', e);
        }
      }
      
      // Method 2c: Try all known date-setting methods
      const methods = [
        { name: 'cart.setTimespan', fn: cart?.setTimespan },
        { name: 'cart.setTimeSpan', fn: cart?.setTimeSpan },
        { name: 'cart.setPeriod', fn: cart?.setPeriod },
        { name: 'cart.setDates', fn: cart?.setDates },
        { name: 'cart.setRentalPeriod', fn: cart?.setRentalPeriod },
        { name: 'api.setTimespan', fn: api?.setTimespan },
        { name: 'api.setPeriod', fn: api?.setPeriod },
        { name: 'api.setDates', fn: api?.setDates },
      ];
      
      for (const method of methods) {
        if (typeof method.fn === 'function') {
          try {
            method.fn(startsAt, stopsAt);
            appliedMethods.push(method.name);
            console.log(`[Test] ✅ Called ${method.name}(startsAt, stopsAt)`);
            break;
          } catch (e) {
            try {
              method.fn({ starts_at: startsAt, stops_at: stopsAt });
              appliedMethods.push(`${method.name}:object`);
              console.log(`[Test] ✅ Called ${method.name}({starts_at, stops_at})`);
              break;
            } catch (e2) {
              // continue
            }
          }
        }
      }
      
      // Method 3: Try refresh methods
      const refreshMethods: string[] = [];
      if (typeof api.refresh === 'function') {
        try {
          api.refresh();
          refreshMethods.push('api.refresh');
          console.log('[Test] ✅ Called api.refresh()');
        } catch (e) {
          console.warn('[Test] ❌ api.refresh() failed:', e);
        }
      }
      
      if (typeof api.trigger === 'function') {
        try {
          api.trigger('refresh');
          api.trigger('dom-change');
          api.trigger('page-change');
          api.trigger('date-change');
          refreshMethods.push('api.trigger');
          console.log('[Test] ✅ Called api.trigger(refresh, dom-change, page-change, date-change)');
        } catch (e) {
          console.warn('[Test] ❌ api.trigger() failed:', e);
        }
      }
      
      // Also trigger refresh via our helper
      try {
        booqableRefresh();
        refreshMethods.push('booqableRefresh');
        console.log('[Test] ✅ Called booqableRefresh()');
      } catch (e) {
        console.warn('[Test] ❌ booqableRefresh() failed:', e);
      }
      
      // Dispatch custom events
      try {
        document.dispatchEvent(new CustomEvent('booqable:refresh'));
        window.dispatchEvent(new CustomEvent('booqable:refresh'));
        refreshMethods.push('custom events');
        console.log('[Test] ✅ Dispatched custom events');
      } catch (e) {
        console.warn('[Test] ❌ Custom events failed:', e);
      }
      
      // Check final state
      const finalCartData = api.cartData;
      if (finalCartData) {
        const cartState = {
          starts_at: finalCartData.starts_at,
          stops_at: finalCartData.stops_at,
          hasItems: !!finalCartData.items,
          itemCount: finalCartData.items?.length || 0
        };
        console.log('[Test] Final cartData state:', cartState);
        setCartDataState(finalCartData);
      } else {
        setCartDataState(null);
      }
      
      // Update status
      const allMethods = ['url', ...appliedMethods, ...refreshMethods];
      let statusMsg = `Applied via: ${allMethods.join(', ')}`;
      
      if (finalCartData) {
        if (finalCartData.starts_at && finalCartData.stops_at) {
          statusMsg += `\n✅ Dates set in cartData: ${finalCartData.starts_at} → ${finalCartData.stops_at}`;
        } else {
          statusMsg += `\n⚠️ Dates may not be in cartData (check console)`;
        }
      }
      
      setStatus(statusMsg);
      
      if (appliedMethods.length === 0 && !api.setCartData && !api.cartData) {
        console.warn('[Test] ⚠️ No date-setting methods found on Booqable API');
        setStatus('⚠️ No API methods found. Only URL params set. Check console for details.');
      }
    };
    
    // Try immediately and with retries
    setDatesViaApi();
    setTimeout(setDatesViaApi, 500);
    setTimeout(setDatesViaApi, 1000);
    setTimeout(setDatesViaApi, 2000);
    
    // Also use the standard applyRentalPeriod for completeness
    try {
      const result = applyRentalPeriod(startsAt, stopsAt);
      console.log('[Test] applyRentalPeriod result:', result);
    } catch (error) {
      console.error('[Test] applyRentalPeriod error:', error);
    }

  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Cart Debug Test Page</h1>
          <p className="text-muted-foreground">Test rental period integration with Booqable cart</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-3 block">Start Date</label>
            <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-12',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date ? startOfDay(date) : undefined);
                    setStartCalendarOpen(false);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">End Date</label>
            <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-12',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date ? startOfDay(date) : undefined);
                    setEndCalendarOpen(false);
                  }}
                  disabled={(date) => startDate ? date <= startDate : false}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {startDate && endDate && (
          <div className="p-4 bg-secondary/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Rental Period</p>
            <p className="font-semibold">
              {format(startDate, 'EEE, MMM d, yyyy')} → {format(endDate, 'EEE, MMM d, yyyy')}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleAddToCart}
            className="flex-1"
            size="lg"
            disabled={!startDate || !endDate}
          >
            Test add to cart
          </Button>
          <Button
            onClick={() => {
              const api = getBooqableApi();
              if (api?.cartData) {
                setCartDataState(api.cartData);
                console.log('[Test] Current cartData:', api.cartData);
                setStatus('Cart data refreshed. Check the cartData state section below.');
              } else {
                setCartDataState(null);
                setStatus('No cartData found. Booqable API may not be initialized.');
              }
            }}
            variant="outline"
            size="lg"
          >
            Check Cart
          </Button>
        </div>

        {status && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Status:</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{status}</p>
          </div>
        )}

        {cartDataState && (
          <div className="p-4 bg-secondary/50 rounded-lg border">
            <p className="text-sm font-medium mb-2">Current cartData State:</p>
            <div className="text-xs font-mono space-y-1">
              <div>
                <span className="text-muted-foreground">starts_at:</span>{' '}
                <span className={cartDataState.starts_at ? 'text-green-600' : 'text-red-600'}>
                  {cartDataState.starts_at || 'NOT SET'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">stops_at:</span>{' '}
                <span className={cartDataState.stops_at ? 'text-green-600' : 'text-red-600'}>
                  {cartDataState.stops_at || 'NOT SET'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Items:</span>{' '}
                {cartDataState.items?.length || 0}
              </div>
            </div>
          </div>
        )}

        {/* Add-on product button */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-3">Need additional tools?</p>
          <div id="booqable-addon-products">
            <div className="booqable-product" data-id="sander"></div>
          </div>
        </div>

        {/* Debug Log */}
        {debugLog.length > 0 && (
          <div className="p-4 bg-secondary/50 rounded-lg border max-h-96 overflow-y-auto">
            <p className="text-sm font-medium mb-2">Debug Log (Last 50 entries):</p>
            <div className="text-xs font-mono space-y-1">
              {debugLog.map((log, idx) => (
                <div key={idx} className="text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm font-medium mb-2">Note:</p>
          <p className="text-xs text-muted-foreground">
            This page sets the rental period in the Booqable cart data. The product button above should 
            add items to the cart with the rental period you set. Check the browser console for detailed debugging information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Test;

