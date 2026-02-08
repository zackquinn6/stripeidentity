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
              
              // Check cart after a short delay
              setTimeout(() => {
                const api = getBooqableApi();
                const afterCart = getCartSnapshot();
                const changed = JSON.stringify(beforeCart.items) !== JSON.stringify(afterCart.items);
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

    // Track cartData changes with detailed diff
    let lastCartData: any = null;
    let lastCartDataString = '';
    const cartDataCheckInterval = setInterval(() => {
      const currentCartData = api.cartData;
      const currentCartDataString = JSON.stringify(currentCartData);
      
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

      cartObserver.observe(cartWidget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value', 'data-value'],
      });

      console.log('[Test] ✅ Watching cart widget DOM for changes and date inputs');

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
        
        // Hide rush order toggles dynamically as they appear
        const rushElements = cartWidget.querySelectorAll('[data-rush], .rush-order, input[type="checkbox"][name*="rush"], input[type="checkbox"][id*="rush"], *[class*="rush"], *[class*="Rush"]');
        rushElements.forEach((el: any) => {
          if (el.style.display !== 'none') {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.height = '0';
            el.style.width = '0';
            el.style.margin = '0';
            el.style.padding = '0';
            console.log('[Test] 🚫 Hidden rush order element:', {
              tagName: el.tagName,
              className: el.className,
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

    // Method 2: Try Booqable API methods (with retries) - Enhanced with comprehensive tracing
    const setDatesViaApi = () => {
      const api = getBooqableApi();
      if (!api) {
        console.log('[Test] 📅 Booqable API not ready, will retry...');
        return;
      }
      
      console.log('[Test] 📅 ========================================');
      console.log('[Test] 📅 SETTING RENTAL DATES IN BOOQABLE CART');
      console.log('[Test] 📅 ========================================');
      console.log('[Test] 📅 Target dates:', {
        startsAt,
        stopsAt,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      });
      
      // Get initial cart state
      const initialCartData = api.cartData ? JSON.parse(JSON.stringify(api.cartData)) : null;
      console.log('[Test] 📅 Initial cart state:', {
        starts_at: initialCartData?.starts_at,
        stops_at: initialCartData?.stops_at,
        itemsCount: initialCartData?.items?.length || 0,
      });
      
      console.log('[Test] 📅 Booqable API available, setting dates...');
      console.log('[Test] 📅 API methods:', Object.keys(api).filter(k => typeof api[k] === 'function').slice(0, 20));
      console.log('[Test] 📅 API has cart:', !!api.cart);
      console.log('[Test] 📅 API has cartData:', !!api.cartData);
      if (api.cart) {
        console.log('[Test] 📅 Cart methods:', Object.keys(api.cart).filter(k => typeof api.cart[k] === 'function'));
      }
      
      const cart = api?.cart;
      const appliedMethods: string[] = [];
      
      // Method 2a: Try setCartData (available in the API)
      if (typeof api.setCartData === 'function') {
        try {
          console.log('[Test] 📅 Attempting api.setCartData...');
          const beforeData = api.cartData ? JSON.parse(JSON.stringify(api.cartData)) : null;
          api.setCartData({
            starts_at: startsAt,
            stops_at: stopsAt,
          });
          appliedMethods.push('api.setCartData');
          console.log('[Test] 📅 ✅ Called api.setCartData({starts_at, stops_at})');
          
          // Check if it worked
          setTimeout(() => {
            const afterData = api.cartData;
            console.log('[Test] 📅 api.setCartData result:', {
              before: {
                starts_at: beforeData?.starts_at,
                stops_at: beforeData?.stops_at,
              },
              after: {
                starts_at: afterData?.starts_at,
                stops_at: afterData?.stops_at,
              },
              changed: beforeData?.starts_at !== afterData?.starts_at || beforeData?.stops_at !== afterData?.stops_at,
            });
          }, 100);
        } catch (e) {
          console.warn('[Test] 📅 ❌ api.setCartData failed:', e);
        }
      }
      
      // Method 2b: Try setting cartData directly
      if (api.cartData) {
        try {
          console.log('[Test] 📅 Attempting direct cartData assignment...');
          const beforeData = {
            starts_at: api.cartData.starts_at,
            stops_at: api.cartData.stops_at,
          };
          api.cartData.starts_at = startsAt;
          api.cartData.stops_at = stopsAt;
          appliedMethods.push('cartData direct assignment');
          console.log('[Test] 📅 ✅ Set cartData.starts_at and cartData.stops_at directly');
          console.log('[Test] 📅 cartData after setting:', {
            before: beforeData,
            after: {
              starts_at: api.cartData.starts_at,
              stops_at: api.cartData.stops_at,
            },
            items: api.cartData.items?.length || 0,
            fullCartData: api.cartData
          });
        } catch (e) {
          console.warn('[Test] 📅 ❌ Could not set cartData:', e);
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
            console.log(`[Test] 📅 Attempting ${method.name}...`);
            const beforeData = api.cartData ? JSON.parse(JSON.stringify(api.cartData)) : null;
            method.fn(startsAt, stopsAt);
            appliedMethods.push(method.name);
            console.log(`[Test] 📅 ✅ Called ${method.name}(startsAt, stopsAt)`);
            
            // Check if it worked
            setTimeout(() => {
              const afterData = api.cartData;
              console.log(`[Test] 📅 ${method.name} result:`, {
                before: {
                  starts_at: beforeData?.starts_at,
                  stops_at: beforeData?.stops_at,
                },
                after: {
                  starts_at: afterData?.starts_at,
                  stops_at: afterData?.stops_at,
                },
                changed: beforeData?.starts_at !== afterData?.starts_at || beforeData?.stops_at !== afterData?.stops_at,
              });
            }, 100);
            break;
          } catch (e) {
            try {
              console.log(`[Test] 📅 ${method.name} failed with string params, trying object...`);
              const beforeData = api.cartData ? JSON.parse(JSON.stringify(api.cartData)) : null;
              method.fn({ starts_at: startsAt, stops_at: stopsAt });
              appliedMethods.push(`${method.name}:object`);
              console.log(`[Test] 📅 ✅ Called ${method.name}({starts_at, stops_at})`);
              
              // Check if it worked
              setTimeout(() => {
                const afterData = api.cartData;
                console.log(`[Test] 📅 ${method.name} (object) result:`, {
                  before: {
                    starts_at: beforeData?.starts_at,
                    stops_at: beforeData?.stops_at,
                  },
                  after: {
                    starts_at: afterData?.starts_at,
                    stops_at: afterData?.stops_at,
                  },
                  changed: beforeData?.starts_at !== afterData?.starts_at || beforeData?.stops_at !== afterData?.stops_at,
                });
              }, 100);
              break;
            } catch (e2) {
              console.log(`[Test] 📅 ❌ ${method.name} failed with both formats:`, e2);
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
          console.log('[Test] 📅 ✅ Called api.refresh()');
        } catch (e) {
          console.warn('[Test] 📅 ❌ api.refresh() failed:', e);
        }
      }
      
      if (typeof api.trigger === 'function') {
        try {
          api.trigger('refresh');
          api.trigger('dom-change');
          api.trigger('page-change');
          api.trigger('date-change');
          refreshMethods.push('api.trigger');
          console.log('[Test] 📅 ✅ Called api.trigger(refresh, dom-change, page-change, date-change)');
        } catch (e) {
          console.warn('[Test] 📅 ❌ api.trigger() failed:', e);
        }
      }
      
      // Also trigger refresh via our helper
      try {
        booqableRefresh();
        refreshMethods.push('booqableRefresh');
        console.log('[Test] 📅 ✅ Called booqableRefresh()');
      } catch (e) {
        console.warn('[Test] 📅 ❌ booqableRefresh() failed:', e);
      }
      
      // Dispatch custom events
      try {
        document.dispatchEvent(new CustomEvent('booqable:refresh'));
        window.dispatchEvent(new CustomEvent('booqable:refresh'));
        refreshMethods.push('custom events');
        console.log('[Test] 📅 ✅ Dispatched custom events');
      } catch (e) {
        console.warn('[Test] 📅 ❌ Custom events failed:', e);
      }
      
      // Check final state with multiple checks over time
      const checkFinalState = (delay: number, label: string) => {
        setTimeout(() => {
          const finalCartData = api.cartData;
          if (finalCartData) {
            const cartState = {
              starts_at: finalCartData.starts_at,
              stops_at: finalCartData.stops_at,
              hasItems: !!finalCartData.items,
              itemCount: finalCartData.items?.length || 0,
              matchesTarget: finalCartData.starts_at === startsAt && finalCartData.stops_at === stopsAt,
            };
            console.log(`[Test] 📅 Final cartData state (${label}):`, cartState);
            if (cartState.matchesTarget) {
              console.log(`[Test] 📅 ✅ Dates successfully set in cart!`);
            } else if (finalCartData.starts_at || finalCartData.stops_at) {
              console.log(`[Test] 📅 ⚠️ Dates partially set or different:`, {
                target: { starts_at: startsAt, stops_at: stopsAt },
                actual: { starts_at: finalCartData.starts_at, stops_at: finalCartData.stops_at },
              });
            } else {
              console.log(`[Test] 📅 ⚠️ Dates not set in cartData`);
            }
            setCartDataState(finalCartData);
          } else {
            setCartDataState(null);
          }
        }, delay);
      };
      
      checkFinalState(100, '100ms');
      checkFinalState(500, '500ms');
      checkFinalState(1000, '1s');
      checkFinalState(2000, '2s');
      
      // Update status
      const allMethods = ['url', ...appliedMethods, ...refreshMethods];
      let statusMsg = `Applied via: ${allMethods.join(', ')}`;
      
      setTimeout(() => {
        const finalCartData = api.cartData;
        if (finalCartData) {
          if (finalCartData.starts_at && finalCartData.stops_at) {
            if (finalCartData.starts_at === startsAt && finalCartData.stops_at === stopsAt) {
              statusMsg += `\n✅ Dates set in cartData: ${finalCartData.starts_at} → ${finalCartData.stops_at}`;
            } else {
              statusMsg += `\n⚠️ Dates in cartData differ: ${finalCartData.starts_at} → ${finalCartData.stops_at}`;
            }
          } else {
            statusMsg += `\n⚠️ Dates may not be in cartData (check console)`;
          }
        }
        setStatus(statusMsg);
      }, 1500);
      
      if (appliedMethods.length === 0 && !api.setCartData && !api.cartData) {
        console.warn('[Test] 📅 ⚠️ No date-setting methods found on Booqable API');
        setStatus('⚠️ No API methods found. Only URL params set. Check console for details.');
      }
      
      console.log('[Test] 📅 ========================================');
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

    // Add product to cart (replicating the Booqable button click functionality)
    const addProductToCart = () => {
      const api = getBooqableApi();
      if (!api) {
        console.log('[Test] ⚠️ Booqable API not ready for adding product, will retry...');
        return false;
      }

      const cart = api?.cart;
      const productSlug = 'sander'; // The product we want to add
      
      console.log('[Test] ========================================');
      console.log('[Test] Adding product to cart:', productSlug);
      console.log('[Test] ========================================');

      // Get cart state before adding
      const beforeCart = api.cartData;
      console.log('[Test] Cart BEFORE adding product:', {
        itemsCount: beforeCart?.items?.length || 0,
        items: beforeCart?.items || [],
      });

      // Method 1: Try to find and click the Booqable button programmatically
      const button = document.querySelector(`.booqable-product-button[data-id="${productSlug}"], .booqable-product-button[data-product-slug="${productSlug}"]`) as HTMLElement;
      if (button) {
        // Find the clickable child (usually a button or span with "Add to cart" text)
        const clickableElement = button.querySelector('button, [role="button"], .bq-button, button.Button') as HTMLElement;
        const elementToClick = clickableElement || button;
        
        console.log('[Test] Found Booqable button, clicking programmatically...');
        console.log('[Test] Button element:', {
          tagName: elementToClick.tagName,
          className: elementToClick.className,
          dataId: button.getAttribute('data-id'),
          dataSlug: button.getAttribute('data-product-slug'),
        });

        // Create and dispatch a click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        elementToClick.dispatchEvent(clickEvent);
        
        console.log('[Test] ✅ Dispatched click event on Booqable button');
        
        // Check if cart was updated after a delay
        setTimeout(() => {
          const afterCart = api.cartData;
          const itemsChanged = JSON.stringify(beforeCart?.items || []) !== JSON.stringify(afterCart?.items || []);
          if (itemsChanged) {
            console.log('[Test] ✅ Cart was updated after button click!');
            console.log('[Test] Cart AFTER adding product:', {
              itemsCount: afterCart?.items?.length || 0,
              items: afterCart?.items || [],
            });
            setStatus('✅ Product added to cart!');
            setCartDataState(afterCart);
          } else {
            console.log('[Test] ⚠️ Cart not yet updated, may take longer...');
          }
        }, 500);

        return true;
      }

      // Method 2: Try using Booqable API methods to add product
      if (cart) {
        console.log('[Test] Trying Booqable API methods to add product...');
        
        const apiMethods = [
          { name: 'cart.addItem', fn: cart.addItem },
          { name: 'cart.addProductGroup', fn: cart.addProductGroup },
          { name: 'cart.addProduct', fn: cart.addProduct },
          { name: 'cart.add', fn: cart.add },
        ];

        for (const method of apiMethods) {
          if (typeof method.fn === 'function') {
            try {
              // Try with slug as string
              (method.fn as any)(productSlug, 1);
              console.log(`[Test] ✅ Called ${method.name}(${productSlug}, 1)`);
              
              setTimeout(() => {
                const afterCart = api.cartData;
                const itemsChanged = JSON.stringify(beforeCart?.items || []) !== JSON.stringify(afterCart?.items || []);
                if (itemsChanged) {
                  console.log('[Test] ✅ Cart was updated via API!');
                  setStatus(`✅ Product added via ${method.name}!`);
                  setCartDataState(afterCart);
                }
              }, 500);
              
              return true;
            } catch (e) {
              try {
                // Try with object format
                (method.fn as any)({ product_group_id: productSlug, quantity: 1 });
                console.log(`[Test] ✅ Called ${method.name}({product_group_id: ${productSlug}, quantity: 1})`);
                
                setTimeout(() => {
                  const afterCart = api.cartData;
                  const itemsChanged = JSON.stringify(beforeCart?.items || []) !== JSON.stringify(afterCart?.items || []);
                  if (itemsChanged) {
                    console.log('[Test] ✅ Cart was updated via API!');
                    setStatus(`✅ Product added via ${method.name}!`);
                    setCartDataState(afterCart);
                  }
                }, 500);
                
                return true;
              } catch (e2) {
                console.log(`[Test] ❌ ${method.name} failed:`, e2);
              }
            }
          }
        }
      }

      // Method 3: Try direct API methods
      const directMethods = ['addItem', 'addProduct', 'addProductGroup', 'addToCart'];
      for (const methodName of directMethods) {
        if (typeof api[methodName] === 'function') {
          try {
            (api[methodName] as any)(productSlug, 1);
            console.log(`[Test] ✅ Called api.${methodName}(${productSlug}, 1)`);
            
            setTimeout(() => {
              const afterCart = api.cartData;
              const itemsChanged = JSON.stringify(beforeCart?.items || []) !== JSON.stringify(afterCart?.items || []);
              if (itemsChanged) {
                console.log('[Test] ✅ Cart was updated via direct API!');
                setStatus(`✅ Product added via api.${methodName}!`);
                setCartDataState(afterCart);
              }
            }, 500);
            
            return true;
          } catch (e) {
            console.log(`[Test] ❌ api.${methodName} failed:`, e);
          }
        }
      }

      console.log('[Test] ⚠️ Could not add product to cart - no working method found');
      setStatus('⚠️ Could not add product. Check console for details.');
      return false;
    };

    // Try to add product after setting dates (with delays to ensure dates are set first)
    setTimeout(() => addProductToCart(), 1000);
    setTimeout(() => addProductToCart(), 2000);
    setTimeout(() => addProductToCart(), 3000);

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

        {/* Hide rush order toggle in Booqable widget */}
        <style>{`
          #booqable-cart-widget [data-rush],
          #booqable-cart-widget .rush-order,
          #booqable-cart-widget input[type="checkbox"][name*="rush"],
          #booqable-cart-widget input[type="checkbox"][id*="rush"],
          #booqable-cart-widget label:has(input[type="checkbox"][name*="rush"]),
          #booqable-cart-widget label:has(input[type="checkbox"][id*="rush"]),
          #booqable-cart-widget *[class*="rush"],
          #booqable-cart-widget *[class*="Rush"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        `}</style>

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

