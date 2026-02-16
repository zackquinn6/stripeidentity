import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Store target dates globally so they can be re-applied if cleared
  const targetDatesRef = useRef<{ startsAt?: string; stopsAt?: string }>({});

  // Set dates whenever user-selected dates change or Booqable initializes
  useEffect(() => {
    // Only set dates if user has selected both dates
    if (!startDate || !endDate) {
      return;
    }

    const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    
    // Store target dates immediately
    targetDatesRef.current = { startsAt, stopsAt };

    console.log('[Test] 📅 ========================================');
    console.log('[Test] 📅 USER DATES CHANGED - Setting rental dates');
    console.log('[Test] 📅 ========================================');
    console.log('[Test] 📅 User selected dates:', { startDate, endDate, startsAt, stopsAt });

    const setDates = () => {
      const api = getBooqableApi();
      if (!api) {
        console.log('[Test] 📅 Booqable API not ready, will retry...');
        // Retry if API not ready
        setTimeout(setDates, 200);
        return;
      }

      console.log('[Test] 📅 Booqable API available, applying dates...');

      // Use the proven applyRentalPeriod helper function
      const result = applyRentalPeriod(startsAt, stopsAt);
      console.log('[Test] 📅 applyRentalPeriod result:', result);

      // Also try additional methods for maximum compatibility
      const cart = api?.cart;
      
      // Method 1: api.setCartData (ONLY when cart is empty - it clears items otherwise)
      const hasItems = api.cartData?.items && Array.isArray(api.cartData.items) && api.cartData.items.length > 0;
      if (typeof api.setCartData === 'function' && !hasItems) {
        try {
          api.setCartData({
            starts_at: startsAt,
            stops_at: stopsAt,
          });
          console.log('[Test] 📅 ✅ Called api.setCartData({starts_at, stops_at}) - cart is empty');
        } catch (e) {
          console.warn('[Test] 📅 ❌ api.setCartData failed:', e);
        }
      } else if (hasItems) {
        console.log('[Test] 📅 ⚠️ Skipped api.setCartData - cart has items, would clear them');
      }

      // Method 2: Direct cartData assignment
      if (api.cartData) {
        try {
          api.cartData.starts_at = startsAt;
          api.cartData.stops_at = stopsAt;
          console.log('[Test] 📅 ✅ Set cartData.starts_at and cartData.stops_at directly');
        } catch (e) {
          console.warn('[Test] 📅 ❌ Could not set cartData:', e);
        }
      }

      // Method 3: Try cart API methods
      if (cart) {
        const cartMethods = [
          { name: 'cart.setTimespan', fn: cart.setTimespan },
          { name: 'cart.setTimeSpan', fn: cart.setTimeSpan },
          { name: 'cart.setPeriod', fn: cart.setPeriod },
          { name: 'cart.setDates', fn: cart.setDates },
          { name: 'cart.setRentalPeriod', fn: cart.setRentalPeriod },
        ];

        for (const method of cartMethods) {
          if (typeof method.fn === 'function') {
            try {
              method.fn(startsAt, stopsAt);
              console.log(`[Test] 📅 ✅ Called ${method.name}(startsAt, stopsAt)`);
              break;
            } catch (e) {
              try {
                method.fn({ starts_at: startsAt, stops_at: stopsAt });
                console.log(`[Test] 📅 ✅ Called ${method.name}({starts_at, stops_at})`);
                break;
              } catch (e2) {
                // continue
              }
            }
          }
        }
      }

      // Verify dates were set after a delay
      setTimeout(() => {
        const finalCartData = api.cartData;
        if (finalCartData) {
          const datesMatch = finalCartData.starts_at === startsAt && finalCartData.stops_at === stopsAt;
          console.log('[Test] 📅 Verification after setting dates:', {
            target: { starts_at: startsAt, stops_at: stopsAt },
            actual: { starts_at: finalCartData.starts_at, stops_at: finalCartData.stops_at },
            datesMatch,
          });
          
          if (datesMatch) {
            console.log('[Test] 📅 ✅ SUCCESS: Dates are set in cart!');
          } else {
            console.log('[Test] 📅 ⚠️ Dates may not match. Will continue monitoring...');
          }
        }
      }, 500);
    };

    // Set dates immediately and with retries (Booqable may initialize later)
    setDates();
    const timeouts = [500, 1000, 2000, 3000, 5000, 7000, 10000].map(delay => 
      setTimeout(setDates, delay)
    );

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [startDate, endDate]); // Run whenever user changes dates

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
          // Set up click tracking for enhanced buttons (only once per button)
          Array.from(buttons).forEach((btn, idx) => {
            // Check if we already added listeners (avoid duplicates)
            if ((btn as any).__testClickTracked) {
              return;
            }
            (btn as any).__testClickTracked = true;
            
            // Get cart state before click
            const getCartSnapshot = () => {
              const api = getBooqableApi();
              const cartData = api?.cartData;
              return {
                itemsCount: cartData?.items?.length || 0,
                items: cartData?.items?.map((item: any) => ({
                  id: item.id || item.product_id || item.product_group_id,
                  quantity: item.quantity,
                })) || [],
                timestamp: new Date().toISOString(),
              };
            };
            
            // Track clicks on the button container (capture phase - fires first)
            btn.addEventListener('click', (e) => {
              const beforeCart = getCartSnapshot();
              console.log(`[Test] 🖱️ ========================================`);
              console.log(`[Test] 🖱️ BUTTON ${idx + 1} CLICKED (CAPTURE PHASE)`);
              console.log(`[Test] 🖱️ ========================================`);
              console.log(`[Test] 🖱️ Button details:`, {
                dataId: btn.getAttribute('data-id'),
                dataSlug: btn.getAttribute('data-product-slug'),
                buttonClasses: btn.className,
              });
              console.log(`[Test] 🖱️ Click target:`, {
                tagName: (e.target as HTMLElement)?.tagName,
                className: (e.target as HTMLElement)?.className,
                textContent: (e.target as HTMLElement)?.textContent?.substring(0, 100),
                id: (e.target as HTMLElement)?.id,
              });
              console.log(`[Test] 🖱️ Cart BEFORE click:`, beforeCart);
              
        // Check cart after a short delay and remove rush order items
        setTimeout(() => {
          const api = getBooqableApi();
          const afterCart = getCartSnapshot();
          const changed = JSON.stringify(beforeCart.items) !== JSON.stringify(afterCart.items);
          
          // Remove rush order items if any were added
          if (api?.cartData?.items) {
            const rushItems = api.cartData.items.filter((item: any) => {
              const name = (item.item_name || item.name || '').toLowerCase();
              const id = (item.item_id || item.id || '').toLowerCase();
              return name.includes('rush') || id.includes('rush');
            });
            
            if (rushItems.length > 0) {
              console.log(`[Test] 🚫 Rush order items detected, removing:`, rushItems);
              const cart = api.cart;
              rushItems.forEach((item: any) => {
                const itemId = item.item_id || item.id;
                if (itemId && cart) {
                  const removeMethods = [
                    { name: 'cart.removeItem', fn: cart.removeItem },
                    { name: 'cart.remove', fn: cart.remove },
                    { name: 'cart.removeLine', fn: cart.removeLine },
                  ];
                  for (const method of removeMethods) {
                    if (typeof method.fn === 'function') {
                      try {
                        method.fn(itemId);
                        console.log(`[Test] 🚫 Removed rush order via ${method.name}`);
                        break;
                      } catch (e) {
                        // continue
                      }
                    }
                  }
                }
              });
              
              // Also filter from cartData directly
              api.cartData.items = api.cartData.items.filter((item: any) => {
                const name = (item.item_name || item.name || '').toLowerCase();
                const id = (item.item_id || item.id || '').toLowerCase();
                return !name.includes('rush') && !id.includes('rush');
              });
            }
          }
          
          console.log(`[Test] 🖱️ Cart AFTER click (100ms delay):`, {
            ...afterCart,
            fullCartData: api?.cartData,
          });
          if (changed) {
            console.log(`[Test] 🖱️ ✅ Cart was updated by this click!`);
            // Show what changed
            const beforeIds = new Set(beforeCart.items.map((i: any) => i.id));
            const afterIds = new Set(afterCart.items.map((i: any) => i.id));
            const added = afterCart.items.filter((i: any) => !beforeIds.has(i.id));
            const removed = beforeCart.items.filter((i: any) => !afterIds.has(i.id));
            if (added.length > 0) console.log(`[Test] 🖱️ ➕ Items added:`, added);
            if (removed.length > 0) console.log(`[Test] 🖱️ ➖ Items removed:`, removed);
          } else {
            console.log(`[Test] 🖱️ ⚠️ Cart not yet updated (may take longer)`);
          }
        }, 100);
              
              setTimeout(() => {
                const api = getBooqableApi();
                const afterCart = getCartSnapshot();
                const changed = JSON.stringify(beforeCart.items) !== JSON.stringify(afterCart.items);
                const fullCartData = api?.cartData;
                console.log(`[Test] 🖱️ Cart AFTER click (500ms delay):`, {
                  ...afterCart,
                  fullCartData: fullCartData ? {
                    cartId: fullCartData.cartId,
                    orderId: fullCartData.orderId,
                    items: fullCartData.items?.map((item: any) => ({
                      id: item.id || item.product_id || item.product_group_id,
                      slug: item.slug || item.product_slug,
                      quantity: item.quantity,
                      name: item.name || item.product_name,
                      price: item.price || item.unit_price,
                      fullItem: item,
                    })),
                    toBePaid: fullCartData.toBePaid,
                    total: fullCartData.total || fullCartData.total_price,
                  } : null,
                });
                if (changed) {
                  console.log(`[Test] 🖱️ ✅ Cart was updated by this click!`);
                  // Show what changed
                  const beforeIds = new Set(beforeCart.items.map((i: any) => i.id));
                  const afterIds = new Set(afterCart.items.map((i: any) => i.id));
                  const added = afterCart.items.filter((i: any) => !beforeIds.has(i.id));
                  const removed = beforeCart.items.filter((i: any) => !beforeIds.has(i.id));
                  const modified = afterCart.items.filter((i: any) => {
                    const beforeItem = beforeCart.items.find((bi: any) => bi.id === i.id);
                    return beforeItem && beforeItem.quantity !== i.quantity;
                  });
                  if (added.length > 0) {
                    console.log(`[Test] 🖱️ ➕ Items added:`, added.map((i: any) => ({
                      ...i,
                      fullItem: fullCartData?.items?.find((item: any) => 
                        (item.id || item.product_id || item.product_group_id) === i.id
                      ),
                    })));
                  }
                  if (removed.length > 0) console.log(`[Test] 🖱️ ➖ Items removed:`, removed);
                  if (modified.length > 0) {
                    console.log(`[Test] 🖱️ ✏️ Items modified (${modified.length}):`);
                    modified.forEach((i: any, idx: number) => {
                      const beforeItem = beforeCart.items.find((bi: any) => bi.id === i.id);
                      const fullItem = fullCartData?.items?.find((item: any) => 
                        (item.id || item.product_id || item.product_group_id) === i.id
                      );
                      console.log(`[Test] 🖱️ ✏️ Modified Item ${idx + 1}:`, {
                        ...i,
                        quantityBefore: beforeItem?.quantity,
                        quantityChange: i.quantity - (beforeItem?.quantity || 0),
                      });
                      console.log(`[Test] 🖱️ ✏️ Modified Item ${idx + 1} (FULL):`, JSON.stringify(fullItem, null, 2));
                    });
                  }
                } else {
                  // Check again after more time
                  setTimeout(() => {
                    const api2 = getBooqableApi();
                    const afterCart2 = getCartSnapshot();
                    const changed2 = JSON.stringify(beforeCart.items) !== JSON.stringify(afterCart2.items);
                    if (changed2) {
                      console.log(`[Test] 🖱️ ✅ Cart was updated by this click (delayed - 2000ms)!`);
                      const fullCartData2 = api2?.cartData;
                      const beforeIds = new Set(beforeCart.items.map((i: any) => i.id));
                      const added = afterCart2.items.filter((i: any) => !beforeIds.has(i.id));
                      if (added.length > 0) {
                        console.log(`[Test] 🖱️ ➕ Items added (delayed):`, added.map((i: any) => ({
                          ...i,
                          fullItem: fullCartData2?.items?.find((item: any) => 
                            (item.id || item.product_id || item.product_group_id) === i.id
                          ),
                        })));
                      }
                    }
                  }, 1500); // Check again at 2000ms total
                }
              }, 500);
            }, true); // Use capture phase to catch early

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

    // Remove rush order items from cart programmatically
    const removeRushOrderItems = () => {
      if (!api.cartData || !api.cartData.items) return;
      
      const rushOrderItems = api.cartData.items.filter((item: any) => {
        const itemName = (item.item_name || item.name || '').toLowerCase();
        const itemId = (item.item_id || item.id || '').toLowerCase();
        const slug = (item.slug || '').toLowerCase();
        return itemName.includes('rush') || 
               itemId.includes('rush') || 
               slug.includes('rush-order') ||
               slug.includes('rush-order-processing');
      });
      
      if (rushOrderItems.length > 0) {
        console.log('[Test] 🚫 Found rush order items in cart, removing:', rushOrderItems);
        
        // Try to remove via cart API
        const cart = api.cart;
        if (cart) {
          rushOrderItems.forEach((item: any) => {
            const itemId = item.item_id || item.id;
            if (itemId) {
              // Try remove methods
              const removeMethods = [
                { name: 'cart.removeItem', fn: cart.removeItem },
                { name: 'cart.remove', fn: cart.remove },
                { name: 'cart.removeLine', fn: cart.removeLine },
                { name: 'cart.removeLineItem', fn: cart.removeLineItem },
              ];
              
              for (const method of removeMethods) {
                if (typeof method.fn === 'function') {
                  try {
                    method.fn(itemId);
                    console.log(`[Test] 🚫 Removed rush order item via ${method.name}`);
                    break;
                  } catch (e) {
                    try {
                      method.fn({ item_id: itemId });
                      console.log(`[Test] 🚫 Removed rush order item via ${method.name} (object)`);
                      break;
                    } catch (e2) {
                      // continue
                    }
                  }
                }
              }
            }
          });
        }
        
        // Also try to filter items directly from cartData
        if (api.cartData.items) {
          const filteredItems = api.cartData.items.filter((item: any) => {
            const itemName = (item.item_name || item.name || '').toLowerCase();
            const itemId = (item.item_id || item.id || '').toLowerCase();
            const slug = (item.slug || '').toLowerCase();
            return !itemName.includes('rush') && 
                   !itemId.includes('rush') && 
                   !slug.includes('rush-order') &&
                   !slug.includes('rush-order-processing');
          });
          
          if (filteredItems.length !== api.cartData.items.length) {
            api.cartData.items = filteredItems;
            console.log('[Test] 🚫 Filtered rush order items from cartData');
            
            // Trigger refresh
            if (typeof api.refresh === 'function') {
              api.refresh();
            }
            booqableRefresh();
          }
        }
      }
    };
    
    // Track cartData changes with detailed diff
    let lastCartData: any = null;
    let lastCartDataString = '';
    let lastCartId: string | undefined = undefined;
    let dateApplicationInProgress = false; // Prevent infinite loops
    const cartDataCheckInterval = setInterval(() => {
      // Remove rush order items first
      removeRushOrderItems();
      
      const currentCartData = api.cartData;
      const currentCartDataString = JSON.stringify(currentCartData);
      const currentCartId = currentCartData?.cartId;
      
      // Detect when a new cart is created (cartId changed or appeared)
      const cartIdChanged = currentCartId !== lastCartId;
      const newCartCreated = !lastCartId && currentCartId;
      
      // If dates were cleared or don't match target, re-apply them aggressively
      const targetDates = targetDatesRef.current;
      if (targetDates.startsAt && targetDates.stopsAt && !dateApplicationInProgress) {
        const currentStartsAt = currentCartData?.starts_at;
        const currentStopsAt = currentCartData?.stops_at;
        const datesCleared = !currentStartsAt || !currentStopsAt;
        const datesDontMatch = currentStartsAt !== targetDates.startsAt || 
                               currentStopsAt !== targetDates.stopsAt;
        
        // Also check if dates look like Booqable defaults (2/26-2/28 or similar)
        const looksLikeDefault = currentStartsAt && currentStopsAt && 
                                 (currentStartsAt.includes('2026-02-26') || 
                                  currentStartsAt.includes('2026-02-27') ||
                                  currentStopsAt.includes('2026-02-28'));
        
        // If new cart created or dates are wrong, apply dates immediately
        if (newCartCreated || cartIdChanged || datesCleared || datesDontMatch || looksLikeDefault) {
          dateApplicationInProgress = true;
          
          console.log('[Test] 📅 Dates need to be set/updated. Re-applying target dates...', {
            target: targetDates,
            current: {
              starts_at: currentStartsAt,
              stops_at: currentStopsAt,
            },
            reason: newCartCreated ? 'new cart created' : cartIdChanged ? 'cartId changed' : datesCleared ? 'cleared' : datesDontMatch ? 'mismatch' : 'default detected',
            cartId: currentCartId,
            lastCartId,
          });
          
          // Method 1: URL parameters (most reliable - widget reads from URL)
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('starts_at', targetDates.startsAt);
            url.searchParams.set('stops_at', targetDates.stopsAt);
            window.history.replaceState({}, '', url.toString());
            console.log('[Test] 📅 ✅ Re-applied dates via URL params');
          } catch (e) {
            console.warn('[Test] 📅 ❌ Failed to re-apply dates via URL:', e);
          }
          
          // Check if cart has items
          const hasItems = currentCartData?.items && Array.isArray(currentCartData.items) && currentCartData.items.length > 0;
          
          // When cart has items, prioritize cart API methods and DOM manipulation
          // When cart is empty, use api.setCartData
          
          // Method 2: Try cart API methods FIRST (PRIORITY when cart has items - these should preserve items)
          const cart = api?.cart;
          if (cart) {
            const cartMethods = [
              { name: 'cart.setTimespan', fn: cart.setTimespan },
              { name: 'cart.setTimeSpan', fn: cart.setTimeSpan },
              { name: 'cart.setPeriod', fn: cart.setPeriod },
              { name: 'cart.setDates', fn: cart.setDates },
              { name: 'cart.setRentalPeriod', fn: cart.setRentalPeriod },
            ];
            
            let methodSucceeded = false;
            for (const method of cartMethods) {
              if (typeof method.fn === 'function') {
                try {
                  method.fn(targetDates.startsAt, targetDates.stopsAt);
                  console.log(`[Test] 📅 ✅ Re-applied dates via ${method.name}`);
                  methodSucceeded = true;
                  break;
                } catch (e) {
                  try {
                    method.fn({ starts_at: targetDates.startsAt, stops_at: targetDates.stopsAt });
                    console.log(`[Test] 📅 ✅ Re-applied dates via ${method.name} (object)`);
                    methodSucceeded = true;
                    break;
                  } catch (e2) {
                    // continue
                  }
                }
              }
            }
            
            // If cart API methods exist but didn't work, retry after a delay
            if (!methodSucceeded && hasItems) {
              setTimeout(() => {
                for (const method of cartMethods) {
                  if (typeof method.fn === 'function') {
                    try {
                      method.fn(targetDates.startsAt, targetDates.stopsAt);
                      console.log(`[Test] 📅 ✅ Re-applied dates via ${method.name} (retry)`);
                      break;
                    } catch (e) {
                      try {
                        method.fn({ starts_at: targetDates.startsAt, stops_at: targetDates.stopsAt });
                        console.log(`[Test] 📅 ✅ Re-applied dates via ${method.name} (object, retry)`);
                        break;
                      } catch (e2) {
                        // continue
                      }
                    }
                  }
                }
              }, 300);
            }
          }
          
          // Method 3: Try to set dates directly in DOM (if widget has date inputs) - CRITICAL for persistence
          const setDatesInDOM = () => {
            try {
              // Try multiple comprehensive selectors to find date inputs
              const selectors = [
                '#booqable-cart-widget input[type="date"]',
                '#booqable-cart-widget input[type="text"][name*="start"]',
                '#booqable-cart-widget input[type="text"][name*="stop"]',
                '#booqable-cart-widget input[name*="start"]',
                '#booqable-cart-widget input[name*="stop"]',
                '.booqable-cart input[type="date"]',
                '.booqable-cart input[name*="start"]',
                '.booqable-cart input[name*="stop"]',
                'input[type="date"]',
                'input[name*="start"]',
                'input[name*="stop"]',
                '[data-booqable-date-start]',
                '[data-booqable-date-stop]',
                '[id*="start"]',
                '[id*="stop"]',
              ];
              
              let dateInputs: HTMLInputElement[] = [];
              let foundSelector = '';
              
              for (const selector of selectors) {
                const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
                if (inputs.length >= 2) {
                  dateInputs = inputs;
                  foundSelector = selector;
                  break;
                }
              }
              
              if (dateInputs.length >= 2) {
                const startInput = dateInputs[0];
                const stopInput = dateInputs[1];
                
                // Extract date from ISO string (YYYY-MM-DD format)
                const startDateStr = targetDates.startsAt.split('T')[0];
                const stopDateStr = targetDates.stopsAt.split('T')[0];
                
                console.log('[Test] 📅 🔧 Setting dates in DOM inputs:', {
                  startInput: { 
                    tagName: startInput.tagName, 
                    type: startInput.type, 
                    name: startInput.name, 
                    id: startInput.id,
                    currentValue: startInput.value,
                    newValue: startDateStr
                  },
                  stopInput: { 
                    tagName: stopInput.tagName, 
                    type: stopInput.type, 
                    name: stopInput.name, 
                    id: stopInput.id,
                    currentValue: stopInput.value,
                    newValue: stopDateStr
                  },
                  selector: foundSelector
                });
                
                // Method 1: Direct value assignment
                startInput.value = startDateStr;
                stopInput.value = stopDateStr;
                
                // Method 2: Set attribute
                startInput.setAttribute('value', startDateStr);
                stopInput.setAttribute('value', stopDateStr);
                
                // Method 3: Use native value setter (triggers React updates)
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(startInput, startDateStr);
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(stopInput, stopDateStr);
                
                // Method 4: Trigger multiple event types in sequence
                const eventTypes = ['focus', 'input', 'change', 'blur'];
                eventTypes.forEach((eventType, idx) => {
                  setTimeout(() => {
                    const startEvent = new Event(eventType, { bubbles: true, cancelable: true });
                    const stopEvent = new Event(eventType, { bubbles: true, cancelable: true });
                    startInput.dispatchEvent(startEvent);
                    stopInput.dispatchEvent(stopEvent);
                  }, idx * 10);
                });
                
                // Verify values were set
                setTimeout(() => {
                  const actualStartValue = startInput.value;
                  const actualStopValue = stopInput.value;
                  console.log('[Test] 📅 ✅ DOM dates set:', {
                    start: { expected: startDateStr, actual: actualStartValue, match: actualStartValue === startDateStr },
                    stop: { expected: stopDateStr, actual: actualStopValue, match: actualStopValue === stopDateStr }
                  });
                }, 100);
                
                return true;
              } else {
                console.log('[Test] 📅 ⚠️ No date inputs found in DOM. Tried selectors:', selectors);
                return false;
              }
            } catch (e) {
              console.warn('[Test] 📅 DOM manipulation failed:', e);
              return false;
            }
          };
          
          // Try immediately
          setDatesInDOM();
          
          // Retry after delays (date inputs might not be in DOM yet)
          setTimeout(() => setDatesInDOM(), 100);
          setTimeout(() => setDatesInDOM(), 300);
          setTimeout(() => setDatesInDOM(), 500);
          setTimeout(() => setDatesInDOM(), 1000);
          
          // Method 4: api.setCartData (ONLY when cart is empty - it clears items otherwise)
          if (typeof api.setCartData === 'function' && !hasItems) {
            try {
              api.setCartData({
                starts_at: targetDates.startsAt,
                stops_at: targetDates.stopsAt,
              });
              console.log('[Test] 📅 ✅ Re-applied dates via api.setCartData - cart is empty');
              
              // If new cart was created, retry after a delay (only if still empty)
              if (newCartCreated || cartIdChanged) {
                setTimeout(() => {
                  const stillEmpty = !api.cartData?.items || api.cartData.items.length === 0;
                  if (stillEmpty) {
                  try {
                    api.setCartData({
                      starts_at: targetDates.startsAt,
                      stops_at: targetDates.stopsAt,
                    });
                    console.log('[Test] 📅 ✅ Re-applied dates via api.setCartData (retry after cart creation)');
                  } catch (e) {
                    // ignore
                    }
                  }
                }, 200);
              }
            } catch (e) {
              console.warn('[Test] 📅 ❌ Failed to re-apply dates via setCartData:', e);
            }
          } else if (hasItems) {
            console.log('[Test] 📅 ⚠️ Skipped api.setCartData - cart has items, would clear them');
          }
          
          // Method 5: Direct cartData assignment (fallback - less reliable but sometimes works)
          if (api.cartData) {
            try {
              api.cartData.starts_at = targetDates.startsAt;
              api.cartData.stops_at = targetDates.stopsAt;
              console.log('[Test] 📅 ✅ Re-applied dates directly on cartData');
              
              // If new cart was created, retry after a delay
              if (newCartCreated || cartIdChanged) {
                setTimeout(() => {
                  if (api.cartData) {
                    try {
                      api.cartData.starts_at = targetDates.startsAt;
                      api.cartData.stops_at = targetDates.stopsAt;
                      console.log('[Test] 📅 ✅ Re-applied dates directly on cartData (retry after cart creation)');
                    } catch (e) {
                      // ignore
                    }
                  }
                }, 200);
              }
            } catch (e) {
              console.warn('[Test] 📅 ❌ Failed to re-apply dates on cartData:', e);
            }
          }
          
          // Refresh widget
          booqableRefresh();
          
          // Reset flag after a delay
          setTimeout(() => {
            dateApplicationInProgress = false;
          }, 1000);
        }
      }
      
      // Update tracking variables
      lastCartId = currentCartId;
      
      if (currentCartDataString !== lastCartDataString) {
        const beforeItems = lastCartData?.items || [];
        const afterItems = currentCartData?.items || [];
        
        const itemsChanged = JSON.stringify(beforeItems) !== JSON.stringify(afterItems);
        const datesChanged = currentCartData?.starts_at !== lastCartData?.starts_at || 
                            currentCartData?.stops_at !== lastCartData?.stops_at;
        
        if (itemsChanged || datesChanged || !lastCartData) {
          // Calculate what was added
          const beforeItemIds = new Set(beforeItems.map((item: any) => item.id || item.product_id || item.product_group_id));
          const afterItemIds = new Set(afterItems.map((item: any) => item.id || item.product_id || item.product_group_id));
          
          const addedItems = afterItems.filter((item: any) => {
            const id = item.id || item.product_id || item.product_group_id;
            return !beforeItemIds.has(id);
          });
          
          const removedItems = beforeItems.filter((item: any) => {
            const id = item.id || item.product_id || item.product_group_id;
            return !afterItemIds.has(id);
          });
          
          const modifiedItems = afterItems.filter((item: any) => {
            const id = item.id || item.product_id || item.product_group_id;
            if (!beforeItemIds.has(id)) return false;
            const beforeItem = beforeItems.find((bi: any) => (bi.id || bi.product_id || bi.product_group_id) === id);
            return beforeItem && beforeItem.quantity !== item.quantity;
          });
          
          console.log('[Test] 📦 ========================================');
          console.log('[Test] 📦 CART DATA CHANGED!');
          console.log('[Test] 📦 ========================================');
          const beforeItemsDetails = beforeItems.map((item: any) => ({
            id: item.id || item.product_id || item.product_group_id,
            slug: item.slug || item.product_slug,
            quantity: item.quantity,
            name: item.name || item.product_name,
            price: item.price || item.unit_price,
            fullItem: item, // Include full item for inspection
          }));
          
          const afterItemsDetails = afterItems.map((item: any) => ({
            id: item.id || item.product_id || item.product_group_id,
            slug: item.slug || item.product_slug,
            quantity: item.quantity,
            name: item.name || item.product_name,
            price: item.price || item.unit_price,
            fullItem: item, // Include full item for inspection
          }));
          
          console.log('[Test] 📦 BEFORE:', {
            itemsCount: beforeItems.length,
            items: beforeItemsDetails,
            starts_at: lastCartData?.starts_at,
            stops_at: lastCartData?.stops_at,
            total: lastCartData?.total || lastCartData?.total_price,
            fullCartData: lastCartData,
          });
          console.log('[Test] 📦 AFTER:', {
            itemsCount: afterItems.length,
            items: afterItemsDetails,
            starts_at: currentCartData?.starts_at,
            stops_at: currentCartData?.stops_at,
            total: currentCartData?.total || currentCartData?.total_price,
            fullCartData: currentCartData,
          });
          
          if (addedItems.length > 0) {
            console.log(`[Test] 📦 ➕ ADDED ITEMS (${addedItems.length}):`);
            addedItems.forEach((item: any, idx: number) => {
              const itemDetails = {
                id: item.id || item.product_id || item.product_group_id,
                slug: item.slug || item.product_slug,
                quantity: item.quantity,
                name: item.name || item.product_name,
                price: item.price || item.unit_price,
                total: item.total || item.subtotal,
              };
              console.log(`[Test] 📦 ➕ ADDED ITEM ${idx + 1}:`, itemDetails);
              console.log(`[Test] 📦 ➕ ADDED ITEM ${idx + 1} (FULL):`, JSON.stringify(item, null, 2));
            });
          }
          
          if (removedItems.length > 0) {
            console.log('[Test] 📦 ➖ REMOVED ITEMS:', removedItems.map((item: any) => ({
              id: item.id || item.product_id || item.product_group_id,
              slug: item.slug || item.product_slug,
              quantity: item.quantity,
              name: item.name || item.product_name,
            })));
          }
          
          if (modifiedItems.length > 0) {
            console.log(`[Test] 📦 ✏️ MODIFIED ITEMS (${modifiedItems.length}):`);
            modifiedItems.forEach((item: any, idx: number) => {
              const id = item.id || item.product_id || item.product_group_id;
              const beforeItem = beforeItems.find((bi: any) => (bi.id || bi.product_id || bi.product_group_id) === id);
              const itemDetails = {
                id,
                slug: item.slug || item.product_slug,
                quantityBefore: beforeItem?.quantity,
                quantityAfter: item.quantity,
                quantityChange: item.quantity - (beforeItem?.quantity || 0),
                name: item.name || item.product_name,
                priceBefore: beforeItem?.price || beforeItem?.unit_price,
                priceAfter: item.price || item.unit_price,
              };
              console.log(`[Test] 📦 ✏️ MODIFIED ITEM ${idx + 1}:`, itemDetails);
              console.log(`[Test] 📦 ✏️ MODIFIED ITEM ${idx + 1} BEFORE:`, JSON.stringify(beforeItem, null, 2));
              console.log(`[Test] 📦 ✏️ MODIFIED ITEM ${idx + 1} AFTER:`, JSON.stringify(item, null, 2));
            });
          }
          
          console.log('[Test] 📦 FULL CART DATA:');
          console.log('[Test] 📦 Cart Summary:', {
            cartId: currentCartData?.cartId,
            orderId: currentCartData?.orderId,
            itemsCount: currentCartData?.items?.length || 0,
            starts_at: currentCartData?.starts_at,
            stops_at: currentCartData?.stops_at,
            deposit: currentCartData?.deposit,
            couponDiscount: currentCartData?.couponDiscount,
            toBePaid: currentCartData?.toBePaid,
            total: currentCartData?.total || currentCartData?.total_price,
          });
          if (currentCartData?.items && currentCartData.items.length > 0) {
            console.log(`[Test] 📦 Cart Items (${currentCartData.items.length}):`);
            currentCartData.items.forEach((item: any, idx: number) => {
              console.log(`[Test] 📦 Item ${idx + 1} Summary:`, {
                id: item.id || item.product_id || item.product_group_id,
                slug: item.slug || item.product_slug,
                quantity: item.quantity,
                name: item.name || item.product_name,
                price: item.price || item.unit_price,
                total: item.total || item.subtotal,
              });
              console.log(`[Test] 📦 Item ${idx + 1} (FULL JSON):`, JSON.stringify(item, null, 2));
            });
          }
          console.log('[Test] 📦 Full Cart Data (JSON):', JSON.stringify(currentCartData, null, 2));
          console.log('[Test] 📦 ========================================');
          
          lastCartData = currentCartData ? JSON.parse(JSON.stringify(currentCartData)) : null;
          lastCartDataString = currentCartDataString;
        }
      }
    }, 300); // Check every 300ms for faster detection

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

    // Track DOM mutations in the cart widget and date inputs
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
            
            // Check for date inputs in the widget
            Array.from(mutation.addedNodes).forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                // Look for date inputs
                const dateInputs = element.querySelectorAll?.('input[type="date"], input[type="datetime-local"], input[name*="date"], input[name*="start"], input[name*="stop"], input[id*="date"], input[id*="start"], input[id*="stop"]');
                if (dateInputs && dateInputs.length > 0) {
                  console.log('[Test] 📅 Found date inputs in cart widget:', Array.from(dateInputs).map((input: any) => ({
                    type: input.type,
                    name: input.name,
                    id: input.id,
                    value: input.value,
                    className: input.className,
                  })));
                  
                  // Track changes to date inputs
                  dateInputs.forEach((input: any) => {
                    input.addEventListener('change', (e: Event) => {
                      console.log('[Test] 📅 Date input changed:', {
                        target: (e.target as HTMLInputElement).name || (e.target as HTMLInputElement).id,
                        value: (e.target as HTMLInputElement).value,
                        timestamp: new Date().toISOString(),
                      });
                    });
                    input.addEventListener('input', (e: Event) => {
                      console.log('[Test] 📅 Date input value changed:', {
                        target: (e.target as HTMLInputElement).name || (e.target as HTMLInputElement).id,
                        value: (e.target as HTMLInputElement).value,
                        timestamp: new Date().toISOString(),
                      });
                    });
                  });
                }
              }
            });
          }
          
          // Track attribute changes (like value changes on inputs)
          if (mutation.type === 'attributes') {
            const target = mutation.target as HTMLElement;
            if (target.tagName === 'INPUT' && (target as HTMLInputElement).type?.includes('date')) {
              console.log('[Test] 📅 Date input attribute changed:', {
                attribute: mutation.attributeName,
                value: (target as HTMLInputElement).value,
                name: (target as HTMLInputElement).name,
                id: target.id,
              });
            }
          }
        });
      });

      // Remove rush order elements as soon as they appear
      const rushOrderObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                
                // Check if this element or its children are rush order related
                const rushSelectors = [
                  '[data-rush]',
                  '.rush-order',
                  'input[type="checkbox"][name*="rush"]',
                  'input[type="checkbox"][id*="rush"]',
                  '*[class*="rush"]',
                  '*[class*="Rush"]',
                ];
                
                let rushElement: HTMLElement | null = null;
                for (const selector of rushSelectors) {
                  if (element.matches?.(selector)) {
                    rushElement = element;
                    break;
                  }
                  const found = element.querySelector?.(selector);
                  if (found) {
                    rushElement = found as HTMLElement;
                    break;
                  }
                }
                
                if (rushElement) {
                  // Find parent container and remove it
                  const parent = rushElement.closest('label, div, li, tr, .form-group, .checkbox, .form-check');
                  const elementToRemove = parent && parent !== cartWidget ? parent : rushElement;
                  
                  if (elementToRemove && elementToRemove.parentNode) {
                    elementToRemove.parentNode.removeChild(elementToRemove);
                    console.log('[Test] 🚫 Removed rush order element from DOM (MutationObserver):', {
                      tagName: elementToRemove.tagName,
                      className: elementToRemove.className,
                      textContent: elementToRemove.textContent?.substring(0, 100),
                    });
                  }
                }
              }
            });
          }
        });
      });

      rushOrderObserver.observe(cartWidget, {
        childList: true,
        subtree: true,
      });

      cartObserver.observe(cartWidget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value', 'data-value'],
      });

      console.log('[Test] ✅ Watching cart widget DOM for changes, date inputs, and rush order elements');

      // Also watch for date-related elements periodically
      const dateCheckInterval = setInterval(() => {
        const dateInputs = cartWidget.querySelectorAll('input[type="date"], input[type="datetime-local"], input[name*="date"], input[name*="start"], input[name*="stop"]');
        if (dateInputs.length > 0) {
          dateInputs.forEach((input: any) => {
            const currentValue = input.value;
            const storedValue = (input as any).__lastTrackedValue;
            if (currentValue !== storedValue) {
              console.log('[Test] 📅 Date input value detected:', {
                name: input.name,
                id: input.id,
                value: currentValue,
                previousValue: storedValue,
              });
              (input as any).__lastTrackedValue = currentValue;
            }
          });
        }
        
        // Remove rush order toggles/checkboxes from DOM
        const rushElements = cartWidget.querySelectorAll('[data-rush], .rush-order, input[type="checkbox"][name*="rush"], input[type="checkbox"][id*="rush"], *[class*="rush"], *[class*="Rush"]');
        rushElements.forEach((el: any) => {
          // Find parent container (label, div, etc.) and remove it entirely
          const parent = el.closest('label, div, li, tr, .form-group, .checkbox, .form-check');
          const elementToRemove = parent && parent !== cartWidget ? parent : el;
          
          if (elementToRemove && elementToRemove.parentNode) {
            elementToRemove.parentNode.removeChild(elementToRemove);
            console.log('[Test] 🚫 Removed rush order element from DOM:', {
              tagName: elementToRemove.tagName,
              className: elementToRemove.className,
              name: el.name,
              id: el.id,
            });
          }
        });
      }, 500);

      // Cleanup
      return () => {
        clearInterval(cartDataCheckInterval);
        clearInterval(dateCheckInterval);
        cartObserver.disconnect();
        rushOrderObserver.disconnect();
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

  // Helper to get a snapshot of the cart for logging
  const getCartSnapshot = useCallback(() => {
    const api = getBooqableApi();
    const items = api?.cartData?.items || [];
    return {
      itemsCount: items.length,
      items: items.map((item: any) => ({
        id: item.id || item.product_id || item.product_group_id,
        slug: item.slug || item.product_slug,
        quantity: item.quantity,
        name: item.name || item.product_name,
        price: item.price || item.unit_price,
        fullItem: item,
      })),
      starts_at: api?.cartData?.starts_at,
      stops_at: api?.cartData?.stops_at,
      total: api?.cartData?.total || api?.cartData?.total_price,
      timestamp: new Date().toISOString(),
      fullCartData: api?.cartData,
    };
  }, []);

  // Core function to pass rental dates to Booqable cart
  const passRentalDatesToCart = useCallback((startsAt: string, stopsAt: string): { success: boolean; methodsUsed: string[] } => {
    // Store target dates for re-application if they get cleared
    targetDatesRef.current = { startsAt, stopsAt };
    
    const api = getBooqableApi();
    if (!api) {
      console.log('[Test] 📅 ⚠️ Booqable API not available');
      return { success: false, methodsUsed: [] };
    }

    // Store target dates for re-application if they get cleared
    targetDatesRef.current = { startsAt, stopsAt };

    console.log('[Test] 📅 ========================================');
    console.log('[Test] 📅 PASSING RENTAL DATES TO CART');
    console.log('[Test] 📅 ========================================');
    console.log('[Test] 📅 Target dates:', { startsAt, stopsAt });

    const cart = api?.cart;
    const methodsUsed: string[] = [];

    // Method 1: URL parameters (most reliable - widget reads from URL)
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('starts_at', startsAt);
      url.searchParams.set('stops_at', stopsAt);
      window.history.replaceState({}, '', url.toString());
      methodsUsed.push('url-params');
      console.log('[Test] 📅 ✅ Set URL parameters');
    } catch (e) {
      console.error('[Test] 📅 ❌ Failed to set URL params:', e);
    }

    // Method 2: api.setCartData (ONLY when cart is empty - it clears items otherwise)
    const hasItems = api.cartData?.items && Array.isArray(api.cartData.items) && api.cartData.items.length > 0;
    if (typeof api.setCartData === 'function' && !hasItems) {
      try {
        api.setCartData({
          starts_at: startsAt,
          stops_at: stopsAt,
        });
        methodsUsed.push('api.setCartData');
        console.log('[Test] 📅 ✅ Called api.setCartData({starts_at, stops_at}) - cart is empty');
      } catch (e) {
        console.warn('[Test] 📅 ❌ api.setCartData failed:', e);
      }
    } else if (hasItems) {
      console.log('[Test] 📅 ⚠️ Skipped api.setCartData - cart has items, would clear them');
    }

    // Method 3: Direct cartData assignment (fallback)
    if (api.cartData) {
      try {
        api.cartData.starts_at = startsAt;
        api.cartData.stops_at = stopsAt;
        methodsUsed.push('cartData-direct');
        console.log('[Test] 📅 ✅ Set cartData directly');
      } catch (e) {
        console.warn('[Test] 📅 ❌ Could not set cartData directly:', e);
      }
    }

    // Method 4: Cart API methods (try known methods)
    const cartMethods = [
      { name: 'cart.setTimespan', fn: cart?.setTimespan },
      { name: 'cart.setTimeSpan', fn: cart?.setTimeSpan },
      { name: 'cart.setPeriod', fn: cart?.setPeriod },
      { name: 'cart.setDates', fn: cart?.setDates },
    ];

    for (const method of cartMethods) {
      if (typeof method.fn === 'function') {
        try {
          method.fn(startsAt, stopsAt);
          methodsUsed.push(method.name);
          console.log(`[Test] 📅 ✅ Called ${method.name}`);
          break;
        } catch (e) {
          try {
            method.fn({ starts_at: startsAt, stops_at: stopsAt });
            methodsUsed.push(`${method.name}:object`);
            console.log(`[Test] 📅 ✅ Called ${method.name} (object)`);
            break;
          } catch (e2) {
            // continue
          }
        }
      }
    }

    // Refresh widget to pick up changes
    booqableRefresh();
    methodsUsed.push('refresh');

    // Verify dates were set
    setTimeout(() => {
      const finalCartData = api.cartData;
      if (finalCartData) {
        const datesMatch = finalCartData.starts_at === startsAt && finalCartData.stops_at === stopsAt;
        console.log('[Test] 📅 Verification:', {
          methodsUsed,
          datesMatch,
          cartDataDates: {
            starts_at: finalCartData.starts_at,
            stops_at: finalCartData.stops_at,
          },
        });
      }
    }, 500);

    console.log('[Test] 📅 ========================================');
    return { success: methodsUsed.length > 0, methodsUsed };
  }, []);

  const handleAddToCart = useCallback(async () => {
    if (!startDate || !endDate) {
      setStatus('Please select both start and end dates');
      return;
    }

    // Format dates in ISO format with timezone
    const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

    // Update target dates ref immediately so monitoring system knows to maintain these dates
    targetDatesRef.current = { startsAt, stopsAt };

    setStatus('Setting rental period and adding product...');
    console.log('[Test] ========================================');
    console.log('[Test] 🛒 ADD TO CART PROCESS');
    console.log('[Test] ========================================');
    console.log('[Test] Dates from date pickers:', { startDate, endDate, startsAt, stopsAt });

    // STEP 1: Pass rental dates to cart FIRST (before adding product) - with multiple retries
    console.log('[Test] 📅 STEP 1: Setting rental dates (with retries)...');
    const dateResult = passRentalDatesToCart(startsAt, stopsAt);
    console.log('[Test] 📅 Date setting result:', dateResult);
    
    // Apply dates multiple times with delays to catch cart creation
    const applyDatesWithRetries = async () => {
      const api = getBooqableApi();
      if (!api) return;

      // Retry dates at multiple intervals to catch cart creation
      const retryDelays = [100, 300, 500, 1000, 2000];
      for (const delay of retryDelays) {
        setTimeout(() => {
          console.log(`[Test] 📅 Retrying date application after ${delay}ms...`);
          
          // Method 1: URL params
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('starts_at', startsAt);
            url.searchParams.set('stops_at', stopsAt);
            window.history.replaceState({}, '', url.toString());
          } catch (e) {
            // ignore
          }
          
          // Method 2: api.setCartData (ONLY when cart is empty - it clears items otherwise)
          const hasItems = api.cartData?.items && Array.isArray(api.cartData.items) && api.cartData.items.length > 0;
          if (typeof api.setCartData === 'function' && !hasItems) {
            try {
              api.setCartData({
                starts_at: startsAt,
                stops_at: stopsAt,
              });
            } catch (e) {
              // ignore
            }
          }
          
          // Method 3: Direct cartData
          if (api.cartData) {
            try {
              api.cartData.starts_at = startsAt;
              api.cartData.stops_at = stopsAt;
            } catch (e) {
              // ignore
            }
          }
          
          // Method 4: DOM manipulation - set dates directly in widget inputs
          try {
            const dateInputs = document.querySelectorAll('#booqable-cart-widget input[type="date"], #booqable-cart-widget input[name*="start"], #booqable-cart-widget input[name*="stop"], .booqable-cart input[type="date"], input[type="date"][name*="start"], input[type="date"][name*="stop"]');
            if (dateInputs.length >= 2) {
              const startInput = dateInputs[0] as HTMLInputElement;
              const stopInput = dateInputs[1] as HTMLInputElement;
              
              // Extract date from ISO string (YYYY-MM-DD format)
              const startDateStr = startsAt.split('T')[0];
              const stopDateStr = stopsAt.split('T')[0];
              
              startInput.value = startDateStr;
              stopInput.value = stopDateStr;
              
              // Trigger change events
              startInput.dispatchEvent(new Event('change', { bubbles: true }));
              stopInput.dispatchEvent(new Event('change', { bubbles: true }));
              startInput.dispatchEvent(new Event('input', { bubbles: true }));
              stopInput.dispatchEvent(new Event('input', { bubbles: true }));
              
              console.log(`[Test] 📅 ✅ Set dates in DOM inputs (retry ${delay}ms):`, { startDateStr, stopDateStr });
            }
          } catch (e) {
            // ignore
          }
          
          // Refresh widget
          booqableRefresh();
        }, delay);
      }
    };
    
    applyDatesWithRetries();
    
    // Wait a moment for dates to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // STEP 2: Add product to cart
    console.log('[Test] 🛒 STEP 2: Adding product to cart...');
    const api = getBooqableApi();
    if (!api) {
      setStatus('Booqable API not available. Please refresh and try again.');
      return;
    }

    const productSlug = 'sander';
    const beforeCartSnapshot = getCartSnapshot();
    console.log('[Test] 🛒 Cart BEFORE adding product:', beforeCartSnapshot);

    // Method 1: Try to click the Booqable button programmatically
    const button = document.querySelector(`.booqable-product-button[data-id="${productSlug}"], .booqable-product-button[data-product-slug="${productSlug}"]`) as HTMLElement;
    if (button) {
      const clickableElement = button.querySelector('button, [role="button"], .bq-button') as HTMLElement;
      const elementToClick = clickableElement || button;
      
      console.log('[Test] 🛒 Found Booqable button, clicking...');
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      elementToClick.dispatchEvent(clickEvent);
      console.log('[Test] 🛒 ✅ Dispatched click event');
    } else {
      // Method 2: Try API methods
      const cart = api?.cart;
      if (cart) {
        const apiMethods = [
          { name: 'cart.addItem', fn: cart.addItem },
          { name: 'cart.addProductGroup', fn: cart.addProductGroup },
          { name: 'cart.add', fn: cart.add },
        ];
        
        for (const method of apiMethods) {
          if (typeof method.fn === 'function') {
            try {
              method.fn(productSlug, 1);
              console.log(`[Test] 🛒 ✅ Added via ${method.name}`);
              break;
            } catch (e) {
              try {
                method.fn({ product_group_id: productSlug, quantity: 1 });
                console.log(`[Test] 🛒 ✅ Added via ${method.name} (object)`);
                break;
              } catch (e2) {
                // continue
              }
            }
          }
        }
      }
    }

    // Verify cart was updated and aggressively re-apply dates if they were cleared
    await new Promise(resolve => setTimeout(resolve, 1500));
    let afterCartSnapshot = getCartSnapshot();
    console.log('[Test] 🛒 Cart AFTER adding product:', afterCartSnapshot);

    // ALWAYS re-apply dates after product is added (Booqable often clears them)
    console.log('[Test] 📅 ⚠️ Re-applying dates after product added (Booqable may have cleared them)...');
    
    // Set up MutationObserver to watch for date inputs appearing in the widget
    const setupDateInputObserver = () => {
      const widgetContainer = document.getElementById('booqable-cart-widget') || document.body;
      const observer = new MutationObserver((mutations) => {
        // Look for date inputs that were added
        const dateInputs = document.querySelectorAll<HTMLInputElement>(
          'input[type="date"], input[name*="start"], input[name*="stop"], input[id*="start"], input[id*="stop"]'
        );
        
        if (dateInputs.length >= 2) {
          const startInput = dateInputs[0];
          const stopInput = dateInputs[1];
          const startDateStr = startsAt.split('T')[0];
          const stopDateStr = stopsAt.split('T')[0];
          
          // Only set if values don't match
          if (startInput.value !== startDateStr || stopInput.value !== stopDateStr) {
            console.log('[Test] 📅 🔍 MutationObserver: Found date inputs, setting values...');
            startInput.value = startDateStr;
            stopInput.value = stopDateStr;
            startInput.setAttribute('value', startDateStr);
            stopInput.setAttribute('value', stopDateStr);
            
            // Trigger events
            ['change', 'input'].forEach(eventType => {
              startInput.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
              stopInput.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
            });
            
            console.log('[Test] 📅 ✅ MutationObserver: Set dates in inputs');
          }
        }
      });
      
      observer.observe(widgetContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value']
      });
      
      // Disconnect after 10 seconds
      setTimeout(() => {
        observer.disconnect();
        console.log('[Test] 📅 MutationObserver disconnected');
      }, 10000);
      
      return observer;
    };
    
    // Start watching for date inputs
    const dateObserver = setupDateInputObserver();
    
    // Aggressive date re-application with multiple methods and retries
    const applyDatesAggressively = (attempt: number, maxAttempts: number) => {
      if (attempt > maxAttempts) return;
      
      console.log(`[Test] 📅 Re-applying dates (attempt ${attempt}/${maxAttempts})...`);
      
      const api = getBooqableApi();
      if (!api) {
        console.log(`[Test] 📅 ⚠️ Booqable API not available (attempt ${attempt})`);
        return;
      }
      
      // Method 1: URL params
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('starts_at', startsAt);
        url.searchParams.set('stops_at', stopsAt);
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // ignore
      }
      
      // Method 2: api.setCartData (ONLY when cart is empty - it clears items otherwise)
      const hasItems = api.cartData?.items && Array.isArray(api.cartData.items) && api.cartData.items.length > 0;
      if (typeof api.setCartData === 'function' && !hasItems) {
        try {
          api.setCartData({
            starts_at: startsAt,
            stops_at: stopsAt,
          });
        } catch (e) {
          // ignore
        }
      }
      
      // Method 3: Direct cartData
      if (api.cartData) {
        try {
          api.cartData.starts_at = startsAt;
          api.cartData.stops_at = stopsAt;
        } catch (e) {
          // ignore
        }
      }
      
      // Method 4: Cart API methods
      const cart = api?.cart;
      if (cart) {
        const cartMethods = [
          { name: 'cart.setTimespan', fn: cart.setTimespan },
          { name: 'cart.setTimeSpan', fn: cart.setTimeSpan },
          { name: 'cart.setPeriod', fn: cart.setPeriod },
          { name: 'cart.setDates', fn: cart.setDates },
          { name: 'cart.setRentalPeriod', fn: cart.setRentalPeriod },
        ];
        
        for (const method of cartMethods) {
          if (typeof method.fn === 'function') {
            try {
              method.fn(startsAt, stopsAt);
              console.log(`[Test] 📅 ✅ Called ${method.name} (attempt ${attempt})`);
              break;
            } catch (e) {
              try {
                method.fn({ starts_at: startsAt, stops_at: stopsAt });
                console.log(`[Test] 📅 ✅ Called ${method.name} (object, attempt ${attempt})`);
                break;
              } catch (e2) {
                // continue
              }
            }
          }
        }
      }
      
      // Method 5: DOM manipulation - find and set date inputs (CRITICAL - widget reads from DOM)
      console.log(`[Test] 📅 🔍 Starting DOM manipulation (attempt ${attempt})...`);
      try {
        // Try multiple comprehensive selectors to find date inputs
        const selectors = [
          '#booqable-cart-widget input[type="date"]',
          '#booqable-cart-widget input[type="text"][name*="start"]',
          '#booqable-cart-widget input[type="text"][name*="stop"]',
          '#booqable-cart-widget input[name*="start"]',
          '#booqable-cart-widget input[name*="stop"]',
          '.booqable-cart input[type="date"]',
          '.booqable-cart input[name*="start"]',
          '.booqable-cart input[name*="stop"]',
          'input[type="date"]',
          'input[name*="start"]',
          'input[name*="stop"]',
          '[data-booqable-date-start]',
          '[data-booqable-date-stop]',
          '[id*="start"]',
          '[id*="stop"]',
        ];
        
        let dateInputs: HTMLInputElement[] = [];
        let foundSelector = '';
        
        for (const selector of selectors) {
          const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
          if (inputs.length >= 2) {
            dateInputs = inputs;
            foundSelector = selector;
            console.log(`[Test] 📅 🔍 Found ${inputs.length} date inputs using selector: ${selector}`);
            break;
          }
        }
        
        if (dateInputs.length >= 2) {
          const startInput = dateInputs[0];
          const stopInput = dateInputs[1];
          const startDateStr = startsAt.split('T')[0];
          const stopDateStr = stopsAt.split('T')[0];
          
          console.log(`[Test] 📅 🔧 Setting dates in DOM inputs (attempt ${attempt}):`, {
            startInput: { 
              tagName: startInput.tagName, 
              type: startInput.type, 
              name: startInput.name, 
              id: startInput.id,
              currentValue: startInput.value,
              newValue: startDateStr
            },
            stopInput: { 
              tagName: stopInput.tagName, 
              type: stopInput.type, 
              name: stopInput.name, 
              id: stopInput.id,
              currentValue: stopInput.value,
              newValue: stopDateStr
            },
            selector: foundSelector
          });
          
          // Method 1: Direct value assignment
          startInput.value = startDateStr;
          stopInput.value = stopDateStr;
          
          // Method 2: Set attribute
          startInput.setAttribute('value', startDateStr);
          stopInput.setAttribute('value', stopDateStr);
          
          // Method 3: Use native value setter (triggers React updates)
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(startInput, startDateStr);
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(stopInput, stopDateStr);
          
          // Method 4: Trigger multiple event types in sequence
          const eventTypes = ['focus', 'input', 'change', 'blur'];
          eventTypes.forEach((eventType, idx) => {
            setTimeout(() => {
              const startEvent = new Event(eventType, { bubbles: true, cancelable: true });
              const stopEvent = new Event(eventType, { bubbles: true, cancelable: true });
              startInput.dispatchEvent(startEvent);
              stopInput.dispatchEvent(stopEvent);
              
              // Also try native events
              if (eventType === 'change') {
                const nativeStartEvent = new Event('change', { bubbles: true, cancelable: true });
                const nativeStopEvent = new Event('change', { bubbles: true, cancelable: true });
                startInput.dispatchEvent(nativeStartEvent);
                stopInput.dispatchEvent(nativeStopEvent);
              }
            }, idx * 10);
          });
          
          // Verify values were set
          setTimeout(() => {
            const actualStartValue = startInput.value;
            const actualStopValue = stopInput.value;
            console.log(`[Test] 📅 ✅ DOM dates set (attempt ${attempt}):`, {
              start: { expected: startDateStr, actual: actualStartValue, match: actualStartValue === startDateStr },
              stop: { expected: stopDateStr, actual: actualStopValue, match: actualStopValue === stopDateStr }
            });
          }, 100);
        } else {
          console.log(`[Test] 📅 ⚠️ No date inputs found in DOM (attempt ${attempt})`);
          console.log(`[Test] 📅 🔍 Searched ${selectors.length} selectors, found 0-1 inputs`);
          
          // Inspect the widget container structure
          const widgetContainer = document.getElementById('booqable-cart-widget');
          if (widgetContainer) {
            console.log(`[Test] 📅 🔍 Widget container found:`, {
              id: widgetContainer.id,
              className: widgetContainer.className,
              innerHTML: widgetContainer.innerHTML.substring(0, 500), // First 500 chars
              children: Array.from(widgetContainer.children).map(child => ({
                tagName: child.tagName,
                id: child.id,
                className: child.className,
                hasShadowRoot: !!child.shadowRoot,
                isIframe: child.tagName === 'IFRAME'
              })),
              allInputs: Array.from(widgetContainer.querySelectorAll('input')).map(inp => ({
                tagName: inp.tagName,
                type: inp.type,
                name: inp.name,
                id: inp.id,
                value: inp.value,
                className: inp.className
              }))
            });
            
            // Check for iframes
            const iframes = widgetContainer.querySelectorAll('iframe');
            if (iframes.length > 0) {
              console.log(`[Test] 📅 🔍 Found ${iframes.length} iframe(s) in widget - dates may be in iframe (not accessible)`);
            }
            
            // Check for shadow DOM
            const shadowRoots: ShadowRoot[] = [];
            widgetContainer.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) {
                shadowRoots.push(el.shadowRoot);
              }
            });
            if (shadowRoots.length > 0) {
              console.log(`[Test] 📅 🔍 Found ${shadowRoots.length} shadow root(s) in widget - dates may be in shadow DOM`);
              shadowRoots.forEach((shadow, idx) => {
                const shadowInputs = shadow.querySelectorAll('input');
                console.log(`[Test] 📅 🔍 Shadow root ${idx} has ${shadowInputs.length} input(s):`, 
                  Array.from(shadowInputs).map(inp => ({
                    tagName: inp.tagName,
                    type: inp.type,
                    name: inp.name,
                    id: inp.id,
                    value: inp.value
                  }))
                );
              });
            }
          } else {
            console.log(`[Test] 📅 ⚠️ Widget container #booqable-cart-widget not found in DOM`);
          }
          
          // Log all inputs found with each selector for debugging
          selectors.forEach(selector => {
            const inputs = document.querySelectorAll<HTMLInputElement>(selector);
            if (inputs.length > 0) {
              console.log(`[Test] 📅 🔍 Selector "${selector}" found ${inputs.length} input(s):`, 
                Array.from(inputs).map(inp => ({ 
                  tagName: inp.tagName, 
                  type: inp.type, 
                  name: inp.name, 
                  id: inp.id,
                  value: inp.value,
                  className: inp.className
                }))
              );
            }
          });
        }
      } catch (e) {
        console.error(`[Test] 📅 ❌ DOM manipulation failed (attempt ${attempt}):`, e);
      }
      
      // Refresh widget - try multiple refresh methods
      if (api) {
        // Method 1: Standard refresh
        booqableRefresh();
        
        // Method 2: Direct API refresh
        if (typeof api.refresh === 'function') {
          try {
            api.refresh();
            console.log(`[Test] 📅 ✅ Called api.refresh() (attempt ${attempt})`);
          } catch (e) {
            // ignore
          }
        }
        
        // Method 3: Trigger multiple events
        if (typeof api.trigger === 'function') {
          try {
            api.trigger('page-change');
            api.trigger('refresh');
            api.trigger('dom-change');
            api.trigger('cart:update');
            api.trigger('cart:change');
            api.trigger('date-change');
            console.log(`[Test] 📅 ✅ Triggered multiple events (attempt ${attempt})`);
          } catch (e) {
            // ignore
          }
        }
        
        // Method 4: Force URL change event (widget might listen to this)
        try {
          window.dispatchEvent(new PopStateEvent('popstate'));
          window.dispatchEvent(new Event('hashchange'));
          console.log(`[Test] 📅 ✅ Dispatched URL change events (attempt ${attempt})`);
        } catch (e) {
          // ignore
        }
      }
      
      // Schedule next attempt if dates still don't match
      setTimeout(() => {
        const currentCartData = api.cartData;
        const datesMatch = currentCartData?.starts_at === startsAt && currentCartData?.stops_at === stopsAt;
        
        if (!datesMatch && attempt < maxAttempts) {
          applyDatesAggressively(attempt + 1, maxAttempts);
        } else if (datesMatch) {
          console.log(`[Test] 📅 ✅ Dates successfully set after ${attempt} attempts!`);
          // Disconnect observer when dates are set
          if (dateObserver) {
            dateObserver.disconnect();
            console.log('[Test] 📅 MutationObserver disconnected (dates set)');
          }
        }
      }, 500);
    };
    
    // Start aggressive date application (10 attempts over 5 seconds)
    applyDatesAggressively(1, 10);
    
    // Wait for some attempts to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    afterCartSnapshot = getCartSnapshot();
    console.log('[Test] 🛒 Cart AFTER aggressive date re-application:', afterCartSnapshot);

    // Check if product was added - check both snapshot and cartData directly
    const finalCartData = api?.cartData;
    const cartItems = finalCartData?.items || [];
    
    // Check if product was added by looking for the item in cartData
    // The item might be identified by slug, id, item_id, or product_id
    const productAdded = cartItems.some((item: any) => {
      const itemSlug = item.slug || item.product_slug || item.item_slug;
      const itemId = item.id || item.item_id || item.product_id || item.product_group_id;
      return itemSlug === productSlug || 
             itemId === productSlug ||
             item.item_name?.toLowerCase().includes('sander') ||
             item.name?.toLowerCase().includes('sander');
    });

    if (productAdded) {
      // Verify dates are set
      const datesStillSet = finalCartData?.starts_at === startsAt && finalCartData?.stops_at === stopsAt;
      
      if (datesStillSet) {
        setStatus(`✅ Product added and rental dates set!\nDates: ${startsAt} → ${stopsAt}\nMethods: ${dateResult.methodsUsed.join(', ')}`);
      } else if (finalCartData?.starts_at || finalCartData?.stops_at) {
        setStatus(`✅ Product added. Dates partially set.\nActual: ${finalCartData?.starts_at || 'N/A'} → ${finalCartData?.stops_at || 'N/A'}\nTarget: ${startsAt} → ${stopsAt}\nContinuing to apply dates...`);
        
        // Continue trying to set dates even after status is set
        setTimeout(() => {
          passRentalDatesToCart(startsAt, stopsAt);
          
          // Try DOM manipulation one more time
          try {
            const dateInputs = document.querySelectorAll('#booqable-cart-widget input[type="date"], #booqable-cart-widget input[name*="start"], #booqable-cart-widget input[name*="stop"], .booqable-cart input[type="date"], input[type="date"][name*="start"], input[type="date"][name*="stop"]');
            if (dateInputs.length >= 2) {
              const startInput = dateInputs[0] as HTMLInputElement;
              const stopInput = dateInputs[1] as HTMLInputElement;
              const startDateStr = startsAt.split('T')[0];
              const stopDateStr = stopsAt.split('T')[0];
              
              startInput.value = startDateStr;
              stopInput.value = stopDateStr;
              startInput.dispatchEvent(new Event('change', { bubbles: true }));
              stopInput.dispatchEvent(new Event('change', { bubbles: true }));
              startInput.dispatchEvent(new Event('input', { bubbles: true }));
              stopInput.dispatchEvent(new Event('input', { bubbles: true }));
              console.log('[Test] 📅 ✅ Final DOM date setting attempt');
            }
          } catch (e) {
            // ignore
          }
          
          booqableRefresh();
        }, 1000);
      } else {
        setStatus(`✅ Product added, but dates not set. Attempted methods: ${dateResult.methodsUsed.join(', ')}\nContinuing to apply dates...`);
        
        // Continue trying to set dates
        setTimeout(() => {
          passRentalDatesToCart(startsAt, stopsAt);
          booqableRefresh();
        }, 1000);
      }
    } else {
      // Check one more time after a delay - sometimes cart takes time to update
      setTimeout(async () => {
        const delayedApi = getBooqableApi();
        const delayedCartData = delayedApi?.cartData;
        const delayedItems = delayedCartData?.items || [];
        const delayedProductAdded = delayedItems.some((item: any) => {
          const itemSlug = item.slug || item.product_slug || item.item_slug;
          const itemId = item.id || item.item_id || item.product_id || item.product_group_id;
          return itemSlug === productSlug || 
                 itemId === productSlug ||
                 item.item_name?.toLowerCase().includes('sander') ||
                 item.name?.toLowerCase().includes('sander');
        });
        
        if (delayedProductAdded) {
          setStatus(`✅ Product added (delayed detection)!\nDates: ${delayedCartData?.starts_at || 'Not set'} → ${delayedCartData?.stops_at || 'Not set'}`);
        } else {
          setStatus(`⚠️ Product may not have been added. Check console for details.\nCart items: ${delayedItems.length}`);
        }
      }, 2000);
    }

    console.log('[Test] ========================================');
  }, [startDate, endDate, passRentalDatesToCart, getCartSnapshot]);

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

