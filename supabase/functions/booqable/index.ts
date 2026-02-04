import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BOOQABLE_API_KEY = Deno.env.get('BOOQABLE_API_KEY');
const BOOQABLE_COMPANY_ID = 'feeebb8b-2583-4689-b2f6-d488f8220b65';
const BOOQABLE_BASE_URL = `https://${BOOQABLE_COMPANY_ID}.booqable.com/api/1`;

// Actions that require authentication
const AUTH_REQUIRED_ACTIONS = ['create-order', 'add-line', 'book-order', 'reserve-order', 'get-checkout-url'];

interface BooqableProduct {
  id: string;
  type: string;
  attributes: {
    name: string;
    slug: string;
    description?: string;
    photo_url?: string;
    base_price_in_cents: number;
    deposit_in_cents?: number;
    stock_count?: number;
    trackable?: boolean;
    archived?: boolean;
  };
}

interface BooqableResponse {
  data: BooqableProduct[];
  meta?: {
    total_count: number;
    page: number;
    per_page: number;
  };
}

function getSlug(p: any): string | undefined {
  return p?.slug ?? p?.attributes?.slug;
}

function getId(p: any): string | undefined {
  return p?.id;
}

async function verifyAuth(req: Request): Promise<{ userId: string | null; error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      userId: null,
      error: new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  
  if (error || !user) {
    console.error('[Booqable] Auth verification failed:', error?.message);
    return {
      userId: null,
      error: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { userId: user.id, error: null };
}

async function findProductGroupIdBySlug(slug: string): Promise<string | null> {
  const per = 100;
  const maxPages = 25;

  for (let page = 1; page <= maxPages; page++) {
    const endpoint = `/product_groups?per=${per}&page=${page}&filter[archived]=false`;
    const resp = await booqableRequest(endpoint);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('[Booqable] Error fetching product_groups during slug lookup:', errorText);
      break;
    }

    const payload: any = await resp.json();
    const products: any[] = payload?.product_groups ?? payload?.data ?? [];

    if (!Array.isArray(products) || products.length === 0) {
      break;
    }

    const matched = products.find((p) => getSlug(p) === slug);
    if (matched) {
      const id = getId(matched);
      return id ?? null;
    }

    const meta = payload?.meta;
    if (meta?.total_count && meta?.per_page && meta?.page) {
      const totalPages = Math.ceil(Number(meta.total_count) / Number(meta.per_page));
      if (page >= totalPages) break;
    }
  }

  return null;
}

async function fetchAllProductGroups(): Promise<any[]> {
  const per = 100;
  const maxPages = 25;
  const all: any[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const resp = await booqableRequest(`/product_groups?per=${per}&page=${page}&filter[archived]=false`);
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('[Booqable] Error fetching product_groups:', errorText);
      break;
    }

    const payload: any = await resp.json();
    const products: any[] = payload?.product_groups ?? payload?.data ?? [];
    if (!Array.isArray(products) || products.length === 0) break;

    all.push(...products);

    const meta = payload?.meta;
    if (meta?.total_count && meta?.per_page && meta?.page) {
      const totalPages = Math.ceil(Number(meta.total_count) / Number(meta.per_page));
      if (page >= totalPages) break;
    }

    if (products.length < per) break;
  }

  return all;
}

async function booqableRequest(
  endpoint: string, 
  method: string = 'GET', 
  body?: Record<string, unknown>
): Promise<Response> {
  const url = `${BOOQABLE_BASE_URL}${endpoint}`;
  
  console.log(`[Booqable] ${method} ${url}`);
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${BOOQABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  console.log(`[Booqable] Response status: ${response.status}`);
  
  return response;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!BOOQABLE_API_KEY) {
      console.error('[Booqable] API key not configured');
      return new Response(
        JSON.stringify({ error: 'Booqable API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = await req.json();
    console.log(`[Booqable] Action: ${action}`, params);

    // Check authentication for protected actions
    if (AUTH_REQUIRED_ACTIONS.includes(action)) {
      const { userId, error } = await verifyAuth(req);
      if (error) {
        console.log(`[Booqable] Authentication failed for action: ${action}`);
        return error;
      }
      console.log(`[Booqable] Authenticated user ${userId} for action: ${action}`);
    }

      switch (action) {
      case 'debug-product': {
        // Debug action to see raw Booqable data for a specific product
        const { slug } = params;
        const data = await fetchAllProductGroups();
        const product = data.find((p: any) => (p.slug || p.attributes?.slug) === slug);
        
        // Also fetch products (variants) for this product group if it has variations
        let variants: any[] = [];
        if (product?.id) {
          const varResp = await booqableRequest(`/products?filter[product_group_id]=${product.id}`);
          if (varResp.ok) {
            const varData = await varResp.json();
            variants = varData.products || varData.data || [];
          }
        }
        
        console.log(`[Booqable] Debug product ${slug}:`, JSON.stringify({ product, variants }, null, 2));
        return new Response(
          JSON.stringify({ raw: product, variants }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
        
      case 'get-products': {
        const data = await fetchAllProductGroups();
        console.log(`[Booqable] Raw product_groups fetched: ${data.length}`);
        console.log(`[Booqable] Fetched ${Array.isArray(data) ? data.length : 0} products`);

        if (!Array.isArray(data) || data.length === 0) {
          console.log('[Booqable] No products found, returning empty array');
          return new Response(
            JSON.stringify({ products: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const products: any[] = [];
        
        for (const product of data) {
          const std = product as Record<string, unknown>;
          const productType = String(std.product_type || 'rental');
          const isSalesItem = productType === 'consumable' || productType === 'service';
          
          // Parse price structure for tiered pricing
          const priceStructure = std.price_structure as { day?: number; hour?: number } | undefined;
          const basePriceInCents = Number(std.base_price_in_cents) || 0;
          const flatFee = Number(std.flat_fee_in_cents) || 0;
          
          // For sales items, use flat_fee if available
          const salePrice = (flatFee > 0 ? flatFee : basePriceInCents) / 100;
          const rentalFirstDayRate = basePriceInCents / 100;
          
          // price_structure values are already in whole dollars
          const dayRateFromStructure = priceStructure?.day ?? rentalFirstDayRate;
          
          // Add the product group itself
          products.push({
            booqableId: String(std.id || ''),
            slug: String(std.slug || ''),
            name: String(std.name || ''),
            description: String(std.description || ''),
            imageUrl: String(std.photo_url || ''),
            firstDayRate: isSalesItem ? salePrice : rentalFirstDayRate,
            dailyRate: isSalesItem ? salePrice : dayRateFromStructure,
            depositAmount: (Number(std.deposit_in_cents) || 0) / 100,
            stockCount: Number(std.stock_count) || 0,
            trackable: Boolean(std.trackable),
            hasVariations: Boolean(std.has_variations),
            productType,
            isSalesItem,
          });
          
          // Also add individual variants if they exist
          // This ensures variant IDs can be matched in the frontend
          const productVariants = std.products as any[] | undefined;
          if (Array.isArray(productVariants) && productVariants.length > 0) {
            for (const variant of productVariants) {
              const variantBasePriceInCents = Number(variant.base_price_in_cents) || 0;
              const variantFlatFee = Number(variant.flat_fee_price_in_cents) || Number(variant.flat_fee_in_cents) || 0;
              
              const variantSalePrice = (variantFlatFee > 0 ? variantFlatFee : variantBasePriceInCents) / 100;
              const variantFirstDayRate = isSalesItem ? variantSalePrice : (variantBasePriceInCents / 100);
              
              products.push({
                booqableId: String(variant.id || ''),
                slug: String(std.slug || ''), // Use parent slug for matching
                name: String(variant.name || std.name || ''),
                description: String(std.description || ''),
                imageUrl: String(variant.photo_url || std.photo_url || ''),
                firstDayRate: variantFirstDayRate,
                dailyRate: variantFirstDayRate, // Variants typically have flat pricing
                depositAmount: (Number(std.deposit_in_cents) || 0) / 100,
                stockCount: Number(variant.stock_count || std.stock_count) || 0,
                trackable: Boolean(std.trackable),
                hasVariations: false,
                productType,
                isSalesItem, // Inherit isSalesItem from parent product group
                isVariant: true,
                parentId: String(std.id || ''),
              });
            }
          }
        }

        return new Response(
          JSON.stringify({ products }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-product-details': {
        const { product_id } = params;
        
        if (!product_id) {
          return new Response(
            JSON.stringify({ error: 'product_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[Booqable] Fetching product details for: ${product_id}`);
        const response = await booqableRequest(`/product_groups/${product_id}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error fetching product details:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch product details', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const pg = data.product_group || data;
        
        const productType = String(pg.product_type || 'rental');
        const isSalesItem = productType === 'consumable' || productType === 'service';
        
        // Parse group-level pricing
        const groupBasePriceInCents = Number(pg.base_price_in_cents) || 0;
        const groupFlatFeeInCents = Number(pg.flat_fee_in_cents) || Number(pg.flat_fee_price_in_cents) || 0;
        
        // Get price_tiles for tiered pricing (day 1, day 2+, etc.)
        const groupPriceTiles = pg.price_tiles as Array<{ period?: string; quantity?: number; price?: number; multiplier?: number }> | undefined;
        
        // Extract day 1 and day 2+ rates from price_tiles if available
        let groupDay1Rate = 0;
        let groupDay2PlusRate = 0;
        
        if (Array.isArray(groupPriceTiles) && groupPriceTiles.length > 0) {
          // Sort by quantity to get day 1 and day 2+
          const sortedTiles = [...groupPriceTiles].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
          
          // First tile is typically day 1
          if (sortedTiles[0]) {
            groupDay1Rate = Number(sortedTiles[0].price) || 0;
          }
          // Second tile (if exists) is day 2+ or use multiplier from first
          if (sortedTiles[1]) {
            groupDay2PlusRate = Number(sortedTiles[1].price) || 0;
          } else if (sortedTiles[0]?.multiplier) {
            groupDay2PlusRate = (Number(sortedTiles[0].price) || 0) * (Number(sortedTiles[0].multiplier) || 1);
          }
          
          console.log(`[Booqable] Group price_tiles found: day1=${groupDay1Rate}, day2+=${groupDay2PlusRate}`);
        }
        
        // For sales items, use flat_fee if available, otherwise base_price
        const groupSalePrice = (groupFlatFeeInCents > 0 ? groupFlatFeeInCents : groupBasePriceInCents) / 100;
        
        // For rentals, use price_tiles if available, otherwise fall back to base_price
        const effectiveDay1Rate = isSalesItem ? groupSalePrice : (groupDay1Rate > 0 ? groupDay1Rate : (groupBasePriceInCents / 100));
        const effectiveDay2PlusRate = isSalesItem ? groupSalePrice : (groupDay2PlusRate > 0 ? groupDay2PlusRate : effectiveDay1Rate);
        
        // Map variants with their own pricing
        const variants = (pg.products || []).map((p: Record<string, unknown>) => {
          const variantBasePriceInCents = Number(p.base_price_in_cents) || 0;
          // Note: Booqable uses "flat_fee_price_in_cents" for variants (not "flat_fee_in_cents")
          const variantFlatFeeInCents = Number(p.flat_fee_price_in_cents) || Number(p.flat_fee_in_cents) || 0;
          
          // Get variant-level price_tiles
          const variantPriceTiles = p.price_tiles as Array<{ period?: string; quantity?: number; price?: number; multiplier?: number }> | undefined;
          
          let variantDay1Rate = 0;
          let variantDay2PlusRate = 0;
          
          if (Array.isArray(variantPriceTiles) && variantPriceTiles.length > 0) {
            const sortedTiles = [...variantPriceTiles].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
            
            if (sortedTiles[0]) {
              variantDay1Rate = Number(sortedTiles[0].price) || 0;
            }
            if (sortedTiles[1]) {
              variantDay2PlusRate = Number(sortedTiles[1].price) || 0;
            } else if (sortedTiles[0]?.multiplier) {
              variantDay2PlusRate = (Number(sortedTiles[0].price) || 0) * (Number(sortedTiles[0].multiplier) || 1);
            }
            
            console.log(`[Booqable] Variant ${p.id} price_tiles: day1=${variantDay1Rate}, day2+=${variantDay2PlusRate}`);
          }
          
          // For sales items, use flat_fee if available, otherwise base_price
          const variantSalePrice = (variantFlatFeeInCents > 0 ? variantFlatFeeInCents : variantBasePriceInCents) / 100;
          
          // For rentals, prefer price_tiles, then base_price
          const effectiveVarDay1Rate = isSalesItem ? variantSalePrice : (variantDay1Rate > 0 ? variantDay1Rate : (variantBasePriceInCents / 100));
          const effectiveVarDay2PlusRate = isSalesItem ? variantSalePrice : (variantDay2PlusRate > 0 ? variantDay2PlusRate : effectiveVarDay1Rate);
          
          console.log(`[Booqable] Variant ${p.id}: base_price_in_cents=${variantBasePriceInCents}, flat_fee_price_in_cents=${variantFlatFeeInCents}, day1Rate=${effectiveVarDay1Rate}, day2PlusRate=${effectiveVarDay2PlusRate}`);
          
          return {
            id: String(p.id || ''),
            name: String(p.name || ''),
            sku: String(p.sku || ''),
            variationValues: Array.isArray(p.variation_values) ? p.variation_values : [],
            quantity: Number(p.quantity) || 0,
            // Tiered pricing
            day1Rate: effectiveVarDay1Rate,
            day2PlusRate: effectiveVarDay2PlusRate,
            // Keep dailyRate for backwards compatibility (use day1 rate)
            dailyRate: effectiveVarDay1Rate,
            imageUrl: String(p.photo_url || ''),
          };
        });
        
        const productDetails = {
          booqableId: String(pg.id || ''),
          slug: String(pg.slug || ''),
          name: String(pg.name || ''),
          description: String(pg.description || ''),
          imageUrl: String(pg.photo_url || ''),
          // Tiered pricing
          day1Rate: effectiveDay1Rate,
          day2PlusRate: effectiveDay2PlusRate,
          // Keep dailyRate for backwards compatibility
          dailyRate: effectiveDay1Rate,
          depositAmount: (Number(pg.deposit_in_cents) || 0) / 100,
          stockCount: Number(pg.stock_count) || 0,
          trackable: Boolean(pg.trackable),
          hasVariations: Boolean(pg.has_variations),
          variationFields: Array.isArray(pg.variation_fields) ? pg.variation_fields : [],
          variants,
          productType,
          isSalesItem,
        };

        console.log(`[Booqable] Product has ${variants.length} variants, hasVariations: ${productDetails.hasVariations}, day1Rate: ${productDetails.day1Rate}, day2PlusRate: ${productDetails.day2PlusRate}`);

        return new Response(
          JSON.stringify({ product: productDetails }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-order': {
        const { starts_at, stops_at, customer_id } = params;
        
        const orderData: Record<string, unknown> = {
          order: {
            starts_at,
            stops_at,
          },
        };

        if (customer_id) {
          (orderData.order as Record<string, unknown>).customer_id = customer_id;
        }

        const response = await booqableRequest('/orders', 'POST', orderData);
        const responseText = await response.text();
        
        if (!response.ok) {
          console.error('[Booqable] Error creating order:', responseText);
          return new Response(
            JSON.stringify({ error: 'Failed to create order', details: responseText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = JSON.parse(responseText);
        const order = data.order || data.data;
        console.log(`[Booqable] Order created: ${order?.id}`, JSON.stringify(order).slice(0, 200));

        return new Response(
          JSON.stringify({ order }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add-line': {
        const { order_id, product_id, quantity } = params;
        
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id);
        
        let actualProductId = product_id;
        
        if (!isUUID) {
          console.log(`[Booqable] Looking up product by slug: ${product_id}`);

          const foundId = await findProductGroupIdBySlug(String(product_id));
          if (foundId) {
            actualProductId = foundId;
            console.log(`[Booqable] Found product ID: ${actualProductId} for slug: ${product_id}`);
          } else {
            console.log(`[Booqable] No product found for slug after paged lookup: ${product_id}`);
            return new Response(
              JSON.stringify({
                error: `Product not found: ${product_id}`,
                hint: 'This usually means your local booqableId does not match the product group slug in Booqable.',
              }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        const lineData = {
          line: {
            product_group_id: actualProductId,
            quantity: quantity || 1,
          }
        };

        const response = await booqableRequest(`/orders/${order_id}/lines`, 'POST', lineData);
        const responseText = await response.text();
        
        if (!response.ok) {
          console.error('[Booqable] Error adding line:', responseText);
          return new Response(
            JSON.stringify({ error: 'Failed to add line item', details: responseText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = JSON.parse(responseText);
        const line = data.line || data.data;
        console.log(`[Booqable] Line added: ${line?.id}`);

        return new Response(
          JSON.stringify({ line }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'book-order': {
        const { order_id } = params;
        
        const response = await booqableRequest(`/orders/${order_id}/book`, 'POST', {});
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error booking order:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to book order', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log(`[Booqable] Order booked: ${order_id}`);

        return new Response(
          JSON.stringify({ order: data.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reserve-order': {
        const { order_id } = params;
        
        const response = await booqableRequest(`/orders/${order_id}/reserve`, 'POST', {});
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error reserving order:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to reserve order', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log(`[Booqable] Order reserved: ${order_id}`);

        return new Response(
          JSON.stringify({ order: data.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-checkout-url': {
        const { order_id, book_order } = params;
        
        // Per Booqable guidance:
        // 1. Create order with rental period (done prior)
        // 2. Add lines (done prior)
        // 3. Book the order to reserve stock and enable checkout
        // 4. Redirect to checkout widget
        
        const fallbackShopUrl = `https://${BOOQABLE_COMPANY_ID}.booqableshop.com`;

        // Step 1: Book the order if requested (reserves stock, may generate checkout URL)
        if (book_order) {
          console.log(`[Booqable] Booking order ${order_id} before fetching checkout URL...`);
          const bookResponse = await booqableRequest(`/orders/${order_id}/reserve`, 'POST', {});
          if (bookResponse.ok) {
            const bookData = await bookResponse.json();
            console.log(`[Booqable] Order reserved successfully:`, JSON.stringify(bookData).slice(0, 300));
          } else {
            const errorText = await bookResponse.text();
            console.warn(`[Booqable] Could not reserve order (may already be reserved):`, errorText.slice(0, 200));
            // Continue anyway - the order might already be in a valid state
          }
        }

        // Step 2: Fetch order to get checkout URL or construct it
        const orderResponse = await booqableRequest(`/orders/${order_id}`);
        let orderNumber: number | null = null;
        let checkoutUrl: string | null = null;
        let orderToken: string | null = null;

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          console.log(`[Booqable] Order response keys: ${Object.keys(orderData).join(', ')}`);

          const order = orderData.order || orderData.data || orderData;
          console.log(`[Booqable] Full order object keys: ${Object.keys(order || {}).join(', ')}`);

          orderNumber = typeof order?.number === 'number' ? order.number : null;
          orderToken = order?.token || order?.checkout_token || order?.public_token || null;

          // Try explicit checkout URL fields
          const candidateUrls: Array<string | undefined | null> = [
            order?.checkout_url,
            order?.checkoutUrl,
            order?.public_url,
            order?.publicUrl,
            order?.customer_url,
            order?.customerUrl,
            order?.url,
          ];

          checkoutUrl = candidateUrls.find((u) => typeof u === 'string' && u.startsWith('http')) ?? null;

          // If no explicit URL but we have an order number or token, try to construct one
          if (!checkoutUrl) {
            // Common Booqable checkout URL patterns:
            // Pattern 1: /checkout/{order_id}
            // Pattern 2: /orders/{order_id}
            // Pattern 3: /cart?order={order_id}
            // Pattern 4: /checkout?token={token}
            
            if (orderNumber) {
              // Try order-number based URL (most common for public checkout)
              checkoutUrl = `${fallbackShopUrl}/checkout/${order_id}`;
              console.log(`[Booqable] Constructed checkout URL from order ID: ${checkoutUrl}`);
            } else if (orderToken) {
              checkoutUrl = `${fallbackShopUrl}/checkout?token=${orderToken}`;
              console.log(`[Booqable] Constructed checkout URL from token: ${checkoutUrl}`);
            }
          }

          console.log(`[Booqable] Order ${order_id}: number=${orderNumber}, token=${orderToken}, checkoutUrl=${checkoutUrl ?? 'null'}`);
        } else {
          console.log(`[Booqable] Failed to fetch order ${order_id}: ${orderResponse.status}`);
        }

        return new Response(
          JSON.stringify({
            checkoutUrl: checkoutUrl ?? fallbackShopUrl,
            checkoutUrlSource: checkoutUrl ? 'constructed' : 'fallback',
            orderId: order_id,
            orderNumber,
            orderToken,
            message: checkoutUrl
              ? 'Order created and reserved. Redirecting to checkout.'
              : 'Order created. Redirecting to shop (checkout URL not available).'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        console.error(`[Booqable] Unknown action: ${action}`);
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[Booqable] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
