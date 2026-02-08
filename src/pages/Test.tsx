import { useState, useEffect } from 'react';
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

  // Explicitly enhance product buttons when they're rendered - matching checkout page logic
  useEffect(() => {
    // Wait for buttons to be in DOM, then enhance them
    const enhanceButtons = () => {
      const api = getBooqableApi();
      if (!api) {
        console.log('[Test] Booqable API not available yet, retrying...');
        setTimeout(enhanceButtons, 200);
        return;
      }

      // Find all product buttons in the container
      const container = document.getElementById('booqable-addon-products');
      if (!container) {
        console.log('[Test] Container not found, retrying...');
        setTimeout(enhanceButtons, 200);
        return;
      }

      const buttons = container.querySelectorAll('.booqable-product-button[data-id]');
      if (buttons.length === 0) {
        console.log('[Test] No product buttons found in container, retrying...');
        setTimeout(enhanceButtons, 200);
        return;
      }

      console.log(`[Test] Found ${buttons.length} product buttons to enhance`);
      
      // Log button details
      Array.from(buttons).forEach((btn, idx) => {
        console.log(`[Test] Button ${idx + 1}:`, {
          dataId: btn.getAttribute('data-id'),
          dataSlug: btn.getAttribute('data-product-slug'),
          className: btn.className,
          hasChildren: btn.children.length > 0,
          computedStyle: window.getComputedStyle(btn).display,
        });
      });

      // Log API details
      console.log('[Test] Booqable API:', {
        hasApi: !!api,
        apiKeys: Object.keys(api).filter(k => typeof api[k] === 'function').slice(0, 15),
        hasScan: typeof api.scan === 'function',
        hasRefresh: typeof api.refresh === 'function',
        hasEnhance: typeof api.enhance === 'function',
        hasTrigger: typeof api.trigger === 'function',
        hasInit: typeof api.init === 'function',
      });

      // Try multiple enhancement methods with detailed logging
      const methods = [];
      
      if (typeof api.scan === 'function') {
        try {
          api.scan();
          methods.push('scan');
          console.log('[Test] ✅ Called api.scan()');
        } catch (e) {
          console.error('[Test] ❌ api.scan() failed:', e);
        }
      }
      
      if (typeof api.refresh === 'function') {
        try {
          api.refresh();
          methods.push('refresh');
          console.log('[Test] ✅ Called api.refresh()');
        } catch (e) {
          console.error('[Test] ❌ api.refresh() failed:', e);
        }
      }
      
      if (typeof api.enhance === 'function') {
        try {
          api.enhance();
          methods.push('enhance');
          console.log('[Test] ✅ Called api.enhance()');
        } catch (e) {
          console.error('[Test] ❌ api.enhance() failed:', e);
        }
      }
      
      if (typeof api.init === 'function') {
        try {
          api.init();
          methods.push('init');
          console.log('[Test] ✅ Called api.init()');
        } catch (e) {
          console.error('[Test] ❌ api.init() failed:', e);
        }
      }
      
      if (typeof api.trigger === 'function') {
        try {
          api.trigger('refresh');
          api.trigger('dom-change');
          api.trigger('page-change');
          methods.push('trigger');
          console.log('[Test] ✅ Called api.trigger()');
        } catch (e) {
          console.error('[Test] ❌ api.trigger() failed:', e);
        }
      }
      
      // Also trigger refresh via our helper
      try {
        booqableRefresh();
        methods.push('booqableRefresh');
        console.log('[Test] ✅ Called booqableRefresh()');
      } catch (e) {
        console.error('[Test] ❌ booqableRefresh() failed:', e);
      }
      
      // Dispatch custom events
      try {
        document.dispatchEvent(new CustomEvent('booqable:refresh'));
        document.dispatchEvent(new CustomEvent('booqable:dom-change'));
        window.dispatchEvent(new CustomEvent('booqable:refresh'));
        methods.push('customEvents');
        console.log('[Test] ✅ Dispatched custom events');
      } catch (e) {
        console.error('[Test] ❌ Custom events failed:', e);
      }

      console.log(`[Test] Enhancement complete. Methods called: ${methods.join(', ')}`);
      
      // Check if buttons were enhanced after a delay
      setTimeout(() => {
        const enhancedButtons = Array.from(buttons).filter(btn => btn.children.length > 0 || btn.innerHTML.trim().length > 0);
        console.log(`[Test] After enhancement: ${enhancedButtons.length}/${buttons.length} buttons have content`);
        if (enhancedButtons.length === 0) {
          console.warn('[Test] ⚠️ No buttons were enhanced. Booqable may not recognize the product slugs.');
        } else {
          // Set up click tracking for enhanced buttons
          Array.from(buttons).forEach((btn, idx) => {
            // Track clicks on the button container
            btn.addEventListener('click', (e) => {
              console.log(`[Test] 🖱️ Button ${idx + 1} clicked!`, {
                target: e.target,
                currentTarget: e.currentTarget,
                dataId: btn.getAttribute('data-id'),
                dataSlug: btn.getAttribute('data-product-slug'),
                buttonHTML: btn.innerHTML.substring(0, 200),
                buttonClasses: btn.className,
                eventType: e.type,
                bubbles: e.bubbles,
                cancelable: e.cancelable,
              });
            }, true); // Use capture phase to catch early

            // Track clicks on any child elements
            btn.addEventListener('click', (e) => {
              console.log(`[Test] 🖱️ Child element clicked in button ${idx + 1}:`, {
                childElement: e.target,
                tagName: (e.target as HTMLElement)?.tagName,
                className: (e.target as HTMLElement)?.className,
                textContent: (e.target as HTMLElement)?.textContent?.substring(0, 100),
              });
            });

            console.log(`[Test] ✅ Added click listeners to button ${idx + 1}`);
          });
        }
      }, 2000);
    };

    // Start enhancement with multiple retries
    const timeouts = [100, 300, 500, 1000, 2000, 3000, 5000].map(delay => 
      setTimeout(enhanceButtons, delay)
    );

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // Track cart changes and Booqable API calls
  useEffect(() => {
    console.log('[Test] 🔍 Setting up cart tracking...');

    const api = getBooqableApi();
    if (!api) {
      console.warn('[Test] ⚠️ Booqable API not available for tracking setup');
      return;
    }

    // Track cartData changes
    let lastCartData: any = null;
    const cartDataCheckInterval = setInterval(() => {
      const currentCartData = api.cartData;
      if (currentCartData !== lastCartData) {
        const itemsChanged = JSON.stringify(currentCartData?.items || []) !== JSON.stringify(lastCartData?.items || []);
        const datesChanged = currentCartData?.starts_at !== lastCartData?.starts_at || 
                            currentCartData?.stops_at !== lastCartData?.stops_at;
        
        if (itemsChanged || datesChanged || !lastCartData) {
          console.log('[Test] 📦 Cart data changed!', {
            before: lastCartData ? {
              itemsCount: lastCartData.items?.length || 0,
              starts_at: lastCartData.starts_at,
              stops_at: lastCartData.stops_at,
            } : null,
            after: {
              itemsCount: currentCartData?.items?.length || 0,
              items: currentCartData?.items?.map((item: any) => ({
                id: item.id || item.product_id,
                quantity: item.quantity,
                name: item.name || item.product_name,
              })) || [],
              starts_at: currentCartData?.starts_at,
              stops_at: currentCartData?.stops_at,
            },
            itemsChanged,
            datesChanged,
            fullCartData: currentCartData,
          });
          lastCartData = currentCartData ? JSON.parse(JSON.stringify(currentCartData)) : null;
        }
      }
    }, 500); // Check every 500ms

    // Track Booqable events if available
    if (typeof api.on === 'function') {
      const eventsToTrack = ['cart:update', 'cart:change', 'cart:item:add', 'cart:item:remove', 'cart:refresh', 'dom-change'];
      eventsToTrack.forEach(eventName => {
        try {
          api.on(eventName, (data: any) => {
            console.log(`[Test] 📡 Booqable event fired: ${eventName}`, {
              eventName,
              data,
              timestamp: new Date().toISOString(),
            });
          });
          console.log(`[Test] ✅ Listening for Booqable event: ${eventName}`);
        } catch (e) {
          console.warn(`[Test] ⚠️ Could not listen for event ${eventName}:`, e);
        }
      });
    }

    // Track DOM mutations in the cart widget
    const cartWidget = document.getElementById('booqable-cart-widget');
    if (cartWidget) {
      const cartObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            console.log('[Test] 🔄 Cart widget DOM changed (items added)', {
              addedNodes: Array.from(mutation.addedNodes).map(node => ({
                nodeName: node.nodeName,
                textContent: node.textContent?.substring(0, 100),
                className: (node as HTMLElement)?.className,
              })),
              removedNodes: Array.from(mutation.removedNodes).map(node => ({
                nodeName: node.nodeName,
                textContent: node.textContent?.substring(0, 100),
              })),
            });
          }
        });
      });

      cartObserver.observe(cartWidget, {
        childList: true,
        subtree: true,
        attributes: false,
      });

      console.log('[Test] ✅ Watching cart widget DOM for changes');

      // Cleanup
      return () => {
        clearInterval(cartDataCheckInterval);
        cartObserver.disconnect();
        console.log('[Test] 🧹 Cleaned up cart tracking');
      };
    }

    return () => {
      clearInterval(cartDataCheckInterval);
      console.log('[Test] 🧹 Cleaned up cart tracking');
    };
  }, []);

  // Track all click events on the page (to catch Booqable button clicks)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('.booqable-product-button');
      
      if (button) {
        console.log('[Test] 🖱️ Click detected on Booqable product button!', {
          target: {
            tagName: target.tagName,
            className: target.className,
            textContent: target.textContent?.substring(0, 100),
            id: target.id,
          },
          button: {
            dataId: button.getAttribute('data-id'),
            dataSlug: button.getAttribute('data-product-slug'),
            className: button.className,
            innerHTML: button.innerHTML.substring(0, 200),
          },
          event: {
            type: e.type,
            bubbles: e.bubbles,
            cancelable: e.cancelable,
            timeStamp: e.timeStamp,
          },
        });
      }
    };

    // Use capture phase to catch all clicks
    document.addEventListener('click', handleClick, true);
    console.log('[Test] ✅ Added global click listener for Booqable buttons');

    return () => {
      document.removeEventListener('click', handleClick, true);
      console.log('[Test] 🧹 Removed global click listener');
    };
  }, []);

  // Set default dates: Feb 15-25, 2026 (start of day)
  const defaultStartDate = startOfDay(new Date(2026, 1, 15)); // Month is 0-indexed, so 1 = February
  const defaultEndDate = startOfDay(new Date(2026, 1, 25));

  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [cartDataState, setCartDataState] = useState<any>(null);

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

        {/* Booqable Cart Widget - same as checkout page */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-3">Booqable Cart Widget</p>
          <div id="booqable-cart-widget"></div>
        </div>

        {/* Add-on product button - matching checkout page structure */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-3">Need additional tools?</p>
          <div className="flex flex-wrap gap-3" id="booqable-addon-products">
            <div
              className="booqable-product-button"
              data-id="sander"
              data-product-slug="sander"
              style={{
                minWidth: '200px',
                minHeight: '40px',
                display: 'block',
                visibility: 'visible',
              }}
            ></div>
          </div>
        </div>

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

