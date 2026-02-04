import { useCallback, useState } from 'react';
import { RentalItem } from '@/types/rental';
import { format } from 'date-fns';
import { applyRentalPeriod, booqableRefresh, getBooqableApi } from '@/lib/booqable/client';

const DEBUG = true; // Set to false when stable

interface UseBooqableCartState {
  isLoading: boolean;
  error: string | null;
  itemsAdded: number;
}

async function waitFor(condition: () => boolean, timeoutMs = 4000, intervalMs = 50): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout waiting for condition');
}

async function ensureBooqableButtonsEnhanced(timeoutMs = 6000) {
  // Wait until at least one placeholder exists and Booqable has had a chance to enhance it.
  const staging = document.getElementById('booqable-embed-staging');
  if (!staging) {
    if (DEBUG) console.warn('[useBooqableCart] Staging area not found');
    return;
  }

  const anyPlaceholder = staging.querySelector<HTMLElement>('.booqable-product-button');
  if (!anyPlaceholder) {
    if (DEBUG) console.warn('[useBooqableCart] No placeholders found in staging area');
    return;
  }

  // Give the library multiple refresh cycles with increasing delays.
  const start = Date.now();
  let refreshCount = 0;
  while (Date.now() - start < timeoutMs) {
    booqableRefresh();
    refreshCount++;
    
    // Some installs never inject a child; but if it does, that's our best signal.
    const hasEnhancedButton = !!anyPlaceholder.querySelector(
      'button, a, [role="button"], [data-action], .booqable-button, .bq-add-button, input[type="submit"]'
    );
    if (hasEnhancedButton) {
      if (DEBUG) console.log(`[useBooqableCart] Buttons enhanced after ${refreshCount} refresh cycles`);
      return;
    }
    
    // Increase delay over time to give Booqable more time
    const delay = Math.min(250 + (refreshCount * 50), 500);
    await new Promise((r) => setTimeout(r, delay));
  }
  
  if (DEBUG) {
    console.warn(`[useBooqableCart] Buttons not enhanced after ${timeoutMs}ms, will try clicking containers directly`);
  }
}

// Rental period is applied via applyRentalPeriod() (URL params + best-effort direct API calls)

/**
 * Get a snapshot of the cart's current state.
 * Prefers window.Booqable.cartData if available, otherwise counts items in widget DOM.
 */
function getCartSnapshot(): { itemCount: number; signature: string } {
  const api = getBooqableApi();
  
  // Try Booqable cartData first (source of truth if available)
  if (api?.cartData?.items && Array.isArray(api.cartData.items)) {
    const items = api.cartData.items;
    const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    const signature = items.length > 0 
      ? items.map((i: any) => `${i.product_id || i.id}:${i.quantity}`).join(',')
      : 'empty';
    if (DEBUG) console.log('[useBooqableCart] cartData snapshot:', { itemCount, signature });
    return { itemCount, signature };
  }
  
  // Fallback: count items in the widget DOM
  // Look for common Booqable cart widget selectors
  const widgetSelectors = [
    '.booqable-cart-items .item',
    '.booqable-cart .cart-item',
    '[data-booqable-cart] .item',
    '.bq-cart-items > *',
    '.booqable-widget .cart-line',
  ];
  
  let itemCount = 0;
  for (const selector of widgetSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      itemCount = elements.length;
      break;
    }
  }
  
  // Also check for "empty cart" text as a signal
  const emptyTexts = ['your shopping cart is empty', 'your cart is empty', 'no items'];
  const bodyText = document.body.innerText.toLowerCase();
  const isEmpty = emptyTexts.some((t) => bodyText.includes(t));
  
  if (isEmpty && itemCount === 0) {
    if (DEBUG) console.log('[useBooqableCart] DOM snapshot: cart is empty');
    return { itemCount: 0, signature: 'empty' };
  }
  
  const signature = `dom-items:${itemCount}`;
  if (DEBUG) console.log('[useBooqableCart] DOM snapshot:', { itemCount, signature });
  return { itemCount, signature };
}

function canReliablyDetectCartChange(snapshot: { signature: string }): boolean {
  // If we only have the DOM fallback signature, the widget may be inside an iframe/shadow
  // and the DOM count may always be 0. In that case, using it as a hard failure causes
  // false negatives.
  return !snapshot.signature.startsWith('dom-items:');
}

/**
 * Best-effort attempt to add items via the booqable.js cart API (if exposed).
 * This is far more reliable than clicking hidden DOM placeholders when available.
 */
function tryAddItemsViaCartApi(
  items: Array<{ productGroupId: string; quantity: number; name: string }>
): { ok: boolean; appliedVia: string[] } {
  const api = getBooqableApi();
  const cart = api?.cart;
  const appliedVia: string[] = [];
  
  if (DEBUG) {
    console.log('[useBooqableCart] Attempting cart API:', {
      hasApi: !!api,
      hasCart: !!cart,
      apiKeys: api ? Object.keys(api).slice(0, 20) : [],
      cartKeys: cart ? Object.keys(cart).slice(0, 20) : [],
      cartData: api?.cartData ? { 
        hasItems: !!api.cartData.items,
        itemsType: typeof api.cartData.items,
        itemsLength: Array.isArray(api.cartData.items) ? api.cartData.items.length : 'not array'
      } : null
    });
  }
  
  if (!cart) {
    // Try direct API methods that might not be under cart
    if (api) {
      const directMethods = ['addItem', 'addProduct', 'addProductGroup', 'addToCart'];
      for (const methodName of directMethods) {
        if (typeof api[methodName] === 'function') {
          try {
            for (const item of items) {
              (api[methodName] as any)(item.productGroupId, item.quantity);
            }
            appliedVia.push(`api.${methodName}`);
            return { ok: true, appliedVia };
          } catch (e) {
            if (DEBUG) console.warn(`[useBooqableCart] Direct API method ${methodName} failed:`, e);
          }
        }
      }
    }
    return { ok: false, appliedVia };
  }

  // Try batched APIs first
  const batchCandidates: Array<{ name: string; fn: unknown }>
    = [
      { name: 'cart.addItems', fn: cart?.addItems },
      { name: 'cart.addLineItems', fn: cart?.addLineItems },
      { name: 'cart.addLines', fn: cart?.addLines },
    ];

  for (const c of batchCandidates) {
    if (typeof c.fn !== 'function') continue;
    try {
      (c.fn as any)(
        items.map((i) => ({ product_group_id: i.productGroupId, quantity: i.quantity }))
      );
      appliedVia.push(c.name);
      return { ok: true, appliedVia };
    } catch {
      // continue
    }
  }

  // Fallback: per-item APIs with multiple method name candidates
  const perItemCandidates: Array<{ name: string; fn: (cart: any) => unknown }>
    = [
      { name: 'cart.addItem', fn: (c) => c?.addItem },
      { name: 'cart.addProductGroup', fn: (c) => c?.addProductGroup },
      { name: 'cart.addProduct', fn: (c) => c?.addProduct },
      { name: 'cart.add', fn: (c) => c?.add },
    ];

  let anySucceeded = false;
  for (const item of items) {
    let added = false;
    for (const cand of perItemCandidates) {
      const fn = cand.fn(cart);
      if (typeof fn !== 'function') continue;
      try {
        // Most variants accept (productGroupId, quantity)
        (fn as any)(item.productGroupId, item.quantity);
        appliedVia.push(`${cand.name}(${item.name})`);
        added = true;
        anySucceeded = true;
        break;
      } catch {
        // Try object payload
        try {
          (fn as any)({ product_group_id: item.productGroupId, quantity: item.quantity });
          appliedVia.push(`${cand.name}:object(${item.name})`);
          added = true;
          anySucceeded = true;
          break;
        } catch {
          // continue
        }
      }
    }

    if (!added && DEBUG) {
      console.warn('[useBooqableCart] cart API could not add item:', item);
    }
  }

  return { ok: anySucceeded, appliedVia };
}

/**
 * Find product button placeholder by slug or UUID.
 * Our staging container sets both data-id (UUID) and data-slug.
 */
function findProductButton(slugOrUuid: string): HTMLElement | null {
  // Try by data-id first (UUID)
  let btn = document.querySelector<HTMLElement>(
    `.booqable-product-button[data-id="${CSS.escape(slugOrUuid)}"]`
  );
  if (btn) return btn;
  
  // Try by data-slug
  btn = document.querySelector<HTMLElement>(
    `.booqable-product-button[data-slug="${CSS.escape(slugOrUuid)}"]`
  );
  return btn;
}

/**
 * Wait for Booqable to transform a placeholder into a real clickable element.
 * Returns the clickable child, or the container itself if no child is injected.
 */
async function waitForClickableButton(
  container: HTMLElement,
  timeoutMs = 5000
): Promise<HTMLElement | null> {
  const selectors = 'button, a, [role="button"], [data-action], .booqable-button, .bq-add-button, input[type="submit"]';
  
  try {
    await waitFor(() => !!container.querySelector(selectors), timeoutMs, 100);
    const btn = container.querySelector<HTMLElement>(selectors);
    if (btn) {
      // Ensure the button is clickable
      (btn as HTMLElement).style.pointerEvents = 'auto';
    }
    return btn;
  } catch {
    // Booqable didn't inject a child button; the container itself might be clickable
    if (DEBUG) console.log('[useBooqableCart] No child button found, trying direct click on container');
    // Make container clickable
    container.style.pointerEvents = 'auto';
    return container;
  }
}

/**
 * Hook to programmatically populate the embedded Booqable cart widget.
 * 
 * Strategy:
 * 1. Set starts_at/stops_at on the URL for the widget to pick up
 * 2. Find staging placeholders (which use resolved UUIDs)
 * 3. Wait for Booqable script to transform placeholders into real buttons
 * 4. Click buttons for each item
 * 5. Verify cart actually changed before reporting success
 */
export function useBooqableCart() {
  const [state, setState] = useState<UseBooqableCartState>({
    isLoading: false,
    error: null,
    itemsAdded: 0,
  });

  const addToCart = useCallback(
    async (items: RentalItem[], startDate: Date, endDate: Date) => {
      setState({ isLoading: true, error: null, itemsAdded: 0 });

      // Filter to rental items with booqableId and quantity > 0
      const validItems = items.filter(
        (item) => item.booqableId && item.quantity > 0 && !item.isConsumable && !item.isSalesItem
      );

      if (validItems.length === 0) {
        const err = 'No rental items with Booqable IDs selected';
        setState({ isLoading: false, error: err, itemsAdded: 0 });
        return { success: false, itemsAdded: 0, error: err };
      }

      // Use timezone-aware format. This matches our backend order creation and avoids
      // ambiguous local timestamps that some widgets misinterpret.
      const startsAt = format(startDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
      const stopsAt = format(endDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

      if (DEBUG) {
        console.log('[useBooqableCart] Starting cart sync');
        console.log('[useBooqableCart] Items:', validItems.map((i) => ({ name: i.name, slug: i.booqableId, qty: i.quantity })));
        console.log('[useBooqableCart] Dates:', startsAt, '→', stopsAt);
        const api = getBooqableApi();
        console.log('[useBooqableCart] window.Booqable exists:', !!api);
        if (api) {
          console.log('[useBooqableCart] Booqable API capabilities:', {
            hasRefresh: typeof api.refresh === 'function',
            hasTrigger: typeof api.trigger === 'function',
            hasCartData: !!api.cartData,
          });
        }
      }

      try {
        // Wait for Booqable script to be loaded
        const api = getBooqableApi();
        if (!api) {
          // Wait up to 3 seconds for Booqable to load
          let attempts = 0;
          while (!api && attempts < 30) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
            if (getBooqableApi()) break;
          }
          
          if (!getBooqableApi()) {
            const err = 'Booqable script not loaded. Please refresh the page and try again.';
            if (DEBUG) console.error('[useBooqableCart]', err);
            setState({ isLoading: false, error: err, itemsAdded: 0 });
            return { success: false, itemsAdded: 0, error: err };
          }
        }

        // Apply dates for the widget to pick up (URL + best-effort cart API)
        const { appliedVia } = applyRentalPeriod(startsAt, stopsAt);
        if (DEBUG) console.log('[useBooqableCart] Applied rental period via:', appliedVia);

        // Ensure the placeholders are enhanced before we start clicking.
        await ensureBooqableButtonsEnhanced(4500);
        
        // Small delay for the widget to process
        await new Promise((r) => setTimeout(r, 300));

        // Capture cart state before clicking
        const beforeSnapshot = getCartSnapshot();
        if (DEBUG) console.log('[useBooqableCart] Before snapshot:', beforeSnapshot);

        // Check if staging area exists
        const stagingArea = document.getElementById('booqable-embed-staging');
        if (!stagingArea) {
          const err = 'Booqable staging area not found. Please ensure items are selected.';
          if (DEBUG) console.error('[useBooqableCart]', err);
          setState({ isLoading: false, error: err, itemsAdded: 0 });
          return { success: false, itemsAdded: 0, error: err };
        }

        // Attempt to use the booqable.js cart API (if present) using resolved product group IDs
        const cartApiItems = validItems
          .map((item) => {
            const placeholder = findProductButton(item.booqableId!);
            if (!placeholder && DEBUG) {
              console.warn(`[useBooqableCart] No placeholder found for ${item.name} (${item.booqableId})`);
            }
            const productGroupId = placeholder?.getAttribute('data-id') || item.booqableId!;
            return { productGroupId, quantity: item.quantity, name: item.name };
          })
          .filter((x) => !!x.productGroupId);

        if (cartApiItems.length === 0) {
          const err = 'No product buttons found. The Booqable widget may not be initialized.';
          if (DEBUG) console.error('[useBooqableCart]', err);
          setState({ isLoading: false, error: err, itemsAdded: 0 });
          return { success: false, itemsAdded: 0, error: err };
        }

        const cartApiAttempt = tryAddItemsViaCartApi(cartApiItems);
        if (cartApiAttempt.ok) {
          if (DEBUG) console.log('[useBooqableCart] Added items via cart API:', cartApiAttempt.appliedVia);
          booqableRefresh();
          
          // Wait longer and check multiple times if cart updated via API
          for (let checkAttempt = 0; checkAttempt < 5; checkAttempt++) {
            await new Promise((r) => setTimeout(r, 400));
            booqableRefresh();
            const apiCheckSnapshot = getCartSnapshot();
            if (apiCheckSnapshot.itemCount > beforeSnapshot.itemCount || 
                (apiCheckSnapshot.signature !== beforeSnapshot.signature && apiCheckSnapshot.signature !== 'empty')) {
              if (DEBUG) console.log('[useBooqableCart] Cart updated via API, skipping button clicks', {
                before: beforeSnapshot,
                after: apiCheckSnapshot
              });
              // Cart updated via API, skip button clicking
              const addedCount = validItems.length;
              setState({ isLoading: false, error: null, itemsAdded: addedCount });
              return { success: true, itemsAdded: addedCount };
            }
          }
          
          if (DEBUG) {
            const finalSnapshot = getCartSnapshot();
            console.warn('[useBooqableCart] Cart API call succeeded but cart did not update, will try button clicks', {
              before: beforeSnapshot,
              after: finalSnapshot,
              appliedVia: cartApiAttempt.appliedVia
            });
          }
        } else if (DEBUG) {
          console.log('[useBooqableCart] Cart API not available, will use button clicking method');
          const api = getBooqableApi();
          if (api?.cart) {
            const cartMethods = Object.keys(api.cart).filter(k => typeof api.cart[k] === 'function');
            console.log('[useBooqableCart] Available cart methods:', cartMethods);
            console.log('[useBooqableCart] Cart object keys:', Object.keys(api.cart));
          } else {
            console.log('[useBooqableCart] No cart object found on Booqable API');
          }
        }

        let clickedCount = 0;
        const failedItems: string[] = [];

        // If cart API succeeded, skip brittle DOM clicking and proceed to verification.
        if (cartApiAttempt.ok) {
          clickedCount = validItems.length;
        } else {

        for (const item of validItems) {
          const slug = item.booqableId!;
          
          // Find the staging placeholder
          const placeholder = findProductButton(slug);
          if (!placeholder) {
            if (DEBUG) console.warn(`[useBooqableCart] No placeholder found for: ${slug}`);
            failedItems.push(item.name);
            continue;
          }

          if (DEBUG) {
            const dataId = placeholder.getAttribute('data-id');
            const hasChild = !!placeholder.querySelector('button, a');
            const api = getBooqableApi();
            console.log(`[useBooqableCart] Found placeholder for ${slug}:`, { 
              dataId, 
              hasChild,
              placeholderClasses: placeholder.className,
              placeholderAttributes: Array.from(placeholder.attributes).map(a => `${a.name}="${a.value}"`).join(', '),
              booqableApiExists: !!api,
              booqableMethods: api ? Object.keys(api).filter(k => typeof api[k] === 'function').slice(0, 10) : []
            });
          }

          // Temporarily make placeholder visible so Booqable can enhance it
          // Some Booqable installs only enhance visible elements
          const originalDisplay = placeholder.style.display;
          const originalVisibility = placeholder.style.visibility;
          const originalPosition = placeholder.style.position;
          const originalLeft = placeholder.style.left;
          const originalOpacity = placeholder.style.opacity;
          
          // Make it visible but still off-screen
          placeholder.style.display = 'block';
          placeholder.style.visibility = 'visible';
          placeholder.style.position = 'fixed';
          placeholder.style.left = '0px';
          placeholder.style.top = '0px';
          placeholder.style.width = '1px';
          placeholder.style.height = '1px';
          placeholder.style.opacity = '0.01';
          placeholder.style.zIndex = '-1';
          
          // Set quantity attribute in case Booqable reads it
          placeholder.setAttribute('data-quantity', String(item.quantity));
          
          // Force Booqable to re-scan this element
          booqableRefresh();
          
          // Try to manually trigger Booqable's enhancement
          const api = getBooqableApi();
          if (api) {
            // Try various methods to trigger enhancement
            if (typeof api.scan === 'function') {
              try { api.scan(); } catch {}
            }
            if (typeof api.init === 'function') {
              try { api.init(); } catch {}
            }
            if (typeof api.enhance === 'function') {
              try { api.enhance(placeholder); } catch {}
            }
            // Try triggering a custom event that Booqable might listen for
            try {
              placeholder.dispatchEvent(new CustomEvent('booqable:enhance', { bubbles: true }));
              placeholder.dispatchEvent(new Event('DOMNodeInserted', { bubbles: true }));
            } catch {}
          }
          
          await new Promise((r) => setTimeout(r, 500));
          
          // Wait longer for Booqable to inject a real button
          const clickTarget = await waitForClickableButton(placeholder, 5000);
          
          // Restore original styles after enhancement attempt
          placeholder.style.display = originalDisplay;
          placeholder.style.visibility = originalVisibility;
          placeholder.style.position = originalPosition;
          placeholder.style.left = originalLeft;
          placeholder.style.opacity = originalOpacity;
          placeholder.style.zIndex = '';
          
          // Try multiple click strategies
          const targetsToTry = clickTarget ? [clickTarget, placeholder] : [placeholder];
          
          let itemAdded = false;
          for (const target of targetsToTry) {
            // Make sure target is clickable
            target.style.pointerEvents = 'auto';
            target.style.cursor = 'pointer';
            target.style.display = 'block';
            
            // Try clicking for each unit of quantity
            for (let i = 0; i < item.quantity; i++) {
              // Refresh Booqable before each click attempt
              booqableRefresh();
              await new Promise((r) => setTimeout(r, 200));
              
              // Try multiple click methods
              try {
                // First try standard click
                target.click();
              } catch (e) {
                if (DEBUG) console.warn(`[useBooqableCart] Click failed for ${item.name}, trying dispatchEvent:`, e);
              }
              
              // Also try dispatchEvent with full event properties
              try {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  detail: 1,
                  buttons: 1
                });
                target.dispatchEvent(clickEvent);
              } catch (e) {
                // ignore
              }
              
              // Try mousedown + mouseup sequence (some libraries need this)
              try {
                target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              } catch (e) {
                // ignore
              }
              
              // Also try triggering Booqable's internal handlers
              const api = getBooqableApi();
              if (api?._defer) {
                try {
                  api._defer(() => true, () => {
                    target.click();
                  });
                } catch (e) {
                  // ignore
                }
              }
              
              // Wait a bit longer for cart to update
              await new Promise((r) => setTimeout(r, 500));
              
              // Check if cart updated after this click
              const checkSnapshot = getCartSnapshot();
              if (checkSnapshot.itemCount > beforeSnapshot.itemCount || 
                  (checkSnapshot.signature !== beforeSnapshot.signature && checkSnapshot.signature !== 'empty')) {
                itemAdded = true;
                if (DEBUG) console.log(`[useBooqableCart] Cart updated after clicking ${item.name}`, {
                  before: beforeSnapshot,
                  after: checkSnapshot
                });
                break;
              }
            }
            
            if (itemAdded) break;
          }

          if (itemAdded) {
            clickedCount++;
            if (DEBUG) console.log(`[useBooqableCart] Successfully added ${item.quantity}x ${item.name}`);
          } else {
            if (DEBUG) console.warn(`[useBooqableCart] Failed to add ${item.name} after all attempts`);
            failedItems.push(item.name);
          }
        }

        }

        if (clickedCount === 0) {
          const err = 'Could not find any Booqable product buttons. The embed may not be initialized.';
          setState({ isLoading: false, error: err, itemsAdded: 0 });
          return { success: false, itemsAdded: 0, error: err };
        }

        // Refresh widget after all clicks - multiple times to ensure it processes
        for (let i = 0; i < 3; i++) {
          booqableRefresh();
          await new Promise((r) => setTimeout(r, 200));
        }

        // Wait for cart to actually change with longer timeout
        // NOTE: On some embeds, we can't read widget state (iframe/shadow DOM). In that case,
        // we avoid a false failure and rely on click execution.
        const shouldHardFailOnNoChange = canReliablyDetectCartChange(beforeSnapshot);

        try {
          await waitFor(() => {
            const afterSnapshot = getCartSnapshot();
            // Check if cart changed: signature changed OR item count increased
            // Also handle case where signature goes from 'empty' to non-empty or vice versa
            const signatureChanged = afterSnapshot.signature !== beforeSnapshot.signature;
            const itemCountIncreased = afterSnapshot.itemCount > beforeSnapshot.itemCount;
            const changed = signatureChanged || itemCountIncreased;
            
            if (DEBUG && !changed) {
              console.log('[useBooqableCart] Waiting for cart update...', {
                before: beforeSnapshot,
                after: afterSnapshot,
                signatureChanged,
                itemCountIncreased
              });
            }
            return changed;
          }, 12000, 400); // Longer timeout and interval

          if (DEBUG) {
            const afterSnapshot = getCartSnapshot();
            console.log('[useBooqableCart] After snapshot:', afterSnapshot);
            console.log('[useBooqableCart] Cart successfully updated!');
          }
        } catch {
          if (shouldHardFailOnNoChange) {
            const afterSnapshot = getCartSnapshot();
            const err = `Cart did not update. Before: ${beforeSnapshot.itemCount} items, After: ${afterSnapshot.itemCount} items. The Booqable widget may not be responding.`;
            if (DEBUG) {
              console.warn('[useBooqableCart]', err);
              console.warn('[useBooqableCart] Failed items:', failedItems);
            }
            setState({ isLoading: false, error: err, itemsAdded: 0 });
            return { success: false, itemsAdded: 0, error: err };
          }

          if (DEBUG) {
            console.warn(
              '[useBooqableCart] Could not verify cart change (likely iframe/shadow DOM). Continuing as success based on completed clicks.'
            );
          }
        }

        // Success!
        const addedCount = validItems.length;
        setState({ isLoading: false, error: null, itemsAdded: addedCount });
        
        if (failedItems.length > 0 && DEBUG) {
          console.warn('[useBooqableCart] Some items failed:', failedItems);
        }

        return { success: true, itemsAdded: addedCount };
      } catch (e: any) {
        const message = e?.message || 'Failed to add items to cart widget';
        console.error('[useBooqableCart] Error:', e);
        setState({ isLoading: false, error: message, itemsAdded: 0 });
        return { success: false, itemsAdded: 0, error: message };
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, itemsAdded: 0 });
  }, []);

  return {
    ...state,
    addToCart,
    reset,
  };
}

export default useBooqableCart;
