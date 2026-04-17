import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BOOQABLE_API_KEY = Deno.env.get('BOOQABLE_API_KEY');
const BOOQABLE_COMPANY_ID = 'feeebb8b-2583-4689-b2f6-d488f8220b65';
// API v1 for product lookups (legacy), v4 for orders (per Booqable guidance)
const BOOQABLE_BASE_URL_V1 = `https://${BOOQABLE_COMPANY_ID}.booqable.com/api/1`;
const BOOQABLE_BASE_URL_V4 = `https://${BOOQABLE_COMPANY_ID}.booqable.com/api/4`;
const BOOQABLE_SHOP_URL = `https://toolio-inc.booqableshop.com`;

// Actions that require authentication (order creation and checkout work for guests)
const AUTH_REQUIRED_ACTIONS = ['add-line', 'book-order', 'reserve-order'];

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

async function verifyAuth(req: Request, requireAuth: boolean = true): Promise<{ userId: string | null; error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  
  // If no auth header and auth is not required, return null userId (guest checkout)
  if (!authHeader?.startsWith('Bearer ')) {
    if (requireAuth) {
      return {
        userId: null,
        error: new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      };
    }
    // Guest checkout allowed - no auth header
    return { userId: null, error: null };
  }

  // If auth header exists but auth is not required, try to verify but don't fail if invalid
  if (!requireAuth) {
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error } = await supabaseClient.auth.getUser();
      
      if (!error && user) {
        // Valid authenticated user
        return { userId: user.id, error: null };
      }
      // Invalid token but guest checkout allowed - return null userId
      return { userId: null, error: null };
    } catch (e) {
      // Any error during verification - allow guest checkout
      return { userId: null, error: null };
    }
  }

  // Auth is required - verify and return error if invalid
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
  body?: Record<string, unknown>,
  apiVersion: 'v1' | 'v4' = 'v1'
): Promise<Response> {
  const baseUrl = apiVersion === 'v4' ? BOOQABLE_BASE_URL_V4 : BOOQABLE_BASE_URL_V1;
  const url = `${baseUrl}${endpoint}`;
  
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

    // CRITICAL: For guest checkout actions, completely skip ALL auth checks
    // This prevents any 401 errors from being returned, even if invalid tokens are sent
    const isGuestCheckoutAction = action === 'create-order' || action === 'get-checkout-url';
    
    if (isGuestCheckoutAction) {
      // Guest checkout - log auth status but NEVER return errors
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
          );
          const { data: { user }, error } = await supabaseClient.auth.getUser();
          if (!error && user) {
            console.log(`[Booqable] Authenticated user ${user.id} for ${action} (guest checkout also allowed)`);
          } else {
            console.log(`[Booqable] Guest checkout for ${action} - invalid/expired token ignored`);
          }
        } catch (e) {
          console.log(`[Booqable] Guest checkout for ${action} - auth check failed, proceeding as guest`);
        }
      } else {
        console.log(`[Booqable] Guest checkout for ${action} - no auth header`);
      }
      // Continue to switch statement - do NOT check AUTH_REQUIRED_ACTIONS
    } else if (AUTH_REQUIRED_ACTIONS.includes(action)) {
      // Actions that require authentication
      const { userId, error } = await verifyAuth(req, true);
      if (error) {
        console.log(`[Booqable] Authentication failed for action: ${action}`);
        return error;
      }
      console.log(`[Booqable] Authenticated user ${userId} for action: ${action}`);
    } else if (AUTH_REQUIRED_ACTIONS.includes(action)) {
      // Actions that require authentication
      const { userId, error } = await verifyAuth(req, true);
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
        // Per Booqable guidance: Create order with all items and rental period
        // Then book items and redirect to checkout
        const { starts_at, stops_at, customer_id, lines } = params;
        
        // Build order payload for API v4
        // lines should be: [{ product_id: UUID, quantity: number }, ...]
        const orderPayload: Record<string, unknown> = {
          data: {
            type: 'orders',
            attributes: {
              starts_at,
              stops_at,
            },
          },
        };

        if (customer_id) {
          (orderPayload.data as Record<string, unknown>).relationships = {
            customer: {
              data: { type: 'customers', id: customer_id },
            },
          };
        }

        console.log(`[Booqable] Creating order via API v4:`, JSON.stringify(orderPayload).slice(0, 500));
        const response = await booqableRequest('/orders', 'POST', orderPayload, 'v4');
        const responseText = await response.text();
        
        if (!response.ok) {
          console.error('[Booqable] Error creating order (v4):', responseText);
          return new Response(
            JSON.stringify({ error: 'Failed to create order', details: responseText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = JSON.parse(responseText);
        const order = data.data || data.order;
        const orderId = order?.id;
        console.log(`[Booqable] Order created (v4): ${orderId}`, JSON.stringify(order).slice(0, 300));

        // If lines were provided, add them to the order
        // Per Booqable guidance: Book items to the order using the booking endpoint
        if (Array.isArray(lines) && lines.length > 0) {
          console.log(`[Booqable] Adding ${lines.length} items to order ${orderId}...`);
          let successCount = 0;
          let failCount = 0;

          for (const line of lines) {
            const { product_id, quantity } = line;
            if (!product_id || !quantity) {
              console.warn(`[Booqable] Skipping invalid line:`, line);
              failCount++;
              continue;
            }

            // Resolve slug to UUID if needed
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id);
            let actualProductId = product_id;

            if (!isUUID) {
              console.log(`[Booqable] Looking up product by slug: ${product_id}`);
              const foundId = await findProductGroupIdBySlug(String(product_id));
              if (foundId) {
                actualProductId = foundId;
                console.log(`[Booqable] Found product ID: ${actualProductId} for slug: ${product_id}`);
              } else {
                console.warn(`[Booqable] No product found for slug: ${product_id}`);
                failCount++;
                continue;
              }
            }

            // Add line using API v1 (booking endpoint)
            const lineData = {
              line: {
                product_group_id: actualProductId,
                quantity: quantity || 1,
              }
            };

            const lineResponse = await booqableRequest(`/orders/${orderId}/lines`, 'POST', lineData, 'v1');
            const lineResponseText = await lineResponse.text();

            if (!lineResponse.ok) {
              console.error(`[Booqable] Error adding line for product ${actualProductId}:`, lineResponseText);
              failCount++;
            } else {
              successCount++;
              console.log(`[Booqable] Added line: product ${actualProductId}, quantity ${quantity}`);
            }
          }

          console.log(`[Booqable] Added ${successCount} items, ${failCount} failed to order ${orderId}`);
        }

        return new Response(
          JSON.stringify({ order: { id: orderId, ...order?.attributes, ...order } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add-line': {
        // Use API v4 to add a line/booking to an order
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
        
        // Use API v1 for adding lines (v4 bookings endpoint format differs)
        const lineData = {
          line: {
            product_group_id: actualProductId,
            quantity: quantity || 1,
          }
        };

        console.log(`[Booqable] Adding line via v1: order=${order_id}, product=${actualProductId}, qty=${quantity}`);
        const response = await booqableRequest(`/orders/${order_id}/lines`, 'POST', lineData, 'v1');
        const responseText = await response.text();
        
        if (!response.ok) {
          console.error('[Booqable] Error adding booking (v4):', responseText);
          return new Response(
            JSON.stringify({ error: 'Failed to add line item', details: responseText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = JSON.parse(responseText);
        const booking = data.data || data.booking;
        console.log(`[Booqable] Booking added: ${booking?.id}`);

        return new Response(
          JSON.stringify({ line: booking }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'book-order': {
        // Reserve the order (lock stock) using API v4
        const { order_id } = params;
        
        // API v4: PATCH the order status to 'reserved' or use actions endpoint
        const response = await booqableRequest(`/orders/${order_id}/actions/reserve`, 'POST', {}, 'v4');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error booking order (v4):', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to book order', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log(`[Booqable] Order booked (v4): ${order_id}`);

        return new Response(
          JSON.stringify({ order: data.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reserve-order': {
        const { order_id } = params;
        
        const response = await booqableRequest(`/orders/${order_id}/actions/reserve`, 'POST', {}, 'v4');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error reserving order (v4):', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to reserve order', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log(`[Booqable] Order reserved (v4): ${order_id}`);

        return new Response(
          JSON.stringify({ order: data.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-order-lines': {
        // Get line items from an order so they can be added to the cart widget
        const { order_id } = params;
        
        if (!order_id) {
          return new Response(
            JSON.stringify({ error: 'order_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const orderResponse = await booqableRequest(`/orders/${order_id}`, 'GET', undefined, 'v4');
        if (!orderResponse.ok) {
          const errorText = await orderResponse.text();
          return new Response(
            JSON.stringify({ error: 'Failed to fetch order', details: errorText }),
            { status: orderResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const orderData = await orderResponse.json();
        const order = orderData.data;
        
        // Extract line items/bookings from the order
        // Booqable v4 API structure: order.relationships.bookings or order.attributes.bookings
        const bookings = order?.relationships?.bookings?.data || 
                        order?.attributes?.bookings || 
                        orderData.included?.filter((item: any) => item.type === 'bookings') || [];
        
        const lines = bookings.map((booking: any) => {
          const bookingData = booking.attributes || booking;
          return {
            product_group_id: bookingData.product_group_id || booking.relationships?.product_group?.data?.id,
            product_id: bookingData.product_id || booking.relationships?.product?.data?.id,
            quantity: bookingData.quantity || 1,
          };
        }).filter((line: any) => line.product_group_id || line.product_id);

        console.log(`[Booqable] Extracted ${lines.length} line items from order ${order_id}`);

        return new Response(
          JSON.stringify({ lines, order_id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-checkout-url': {
        const { order_id, book_order, starts_at, stops_at } = params;
        
        // Per Booqable guidance:
        // 1. Create order with rental period (done prior)
        // 2. Add bookings (done prior)
        // 3. Book/reserve the order to lock stock
        // 4. Redirect to checkout widget which shows the pre-populated order
        
        // Step 1: Book the order if requested (reserves stock)
        if (book_order) {
          console.log(`[Booqable] Reserving order ${order_id} before checkout...`);
          const bookResponse = await booqableRequest(`/orders/${order_id}/actions/reserve`, 'POST', {}, 'v4');
          if (bookResponse.ok) {
            const bookData = await bookResponse.json();
            console.log(`[Booqable] Order reserved successfully:`, JSON.stringify(bookData).slice(0, 300));
          } else {
            const errorText = await bookResponse.text();
            console.warn(`[Booqable] Could not reserve order (may already be reserved):`, errorText.slice(0, 200));
            // Continue anyway - the order might already be in a valid state
          }
        }

        // Step 2: Fetch order to get checkout URL or token
        const orderResponse = await booqableRequest(`/orders/${order_id}`, 'GET', undefined, 'v4');
        let orderNumber: number | null = null;
        let checkoutUrl: string | null = null;
        let orderToken: string | null = null;
        let rentalStartsAt: string | null = null;
        let rentalStopsAt: string | null = null;

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          console.log(`[Booqable] Order response (v4) keys: ${Object.keys(orderData).join(', ')}`);

          const order = orderData.data;
          const attrs = order?.attributes || {};
          console.log(`[Booqable] Order attributes keys: ${Object.keys(attrs).join(', ')}`);

          orderNumber = typeof attrs.number === 'number' ? attrs.number : null;
          orderToken = attrs.token || attrs.checkout_token || attrs.public_token || order?.id || null;

          // Extract rental period dates from order attributes (or use explicitly passed dates)
          rentalStartsAt = starts_at || attrs.starts_at || attrs.startsAt || null;
          rentalStopsAt = stops_at || attrs.stops_at || attrs.stopsAt || null;

          // Try explicit checkout URL fields from attributes
          const candidateUrls: Array<string | undefined | null> = [
            attrs.checkout_url,
            attrs.public_url,
            attrs.customer_url,
          ];

          checkoutUrl = candidateUrls.find((u) => typeof u === 'string' && u.startsWith('http')) ?? null;

          // If no explicit URL, construct the checkout URL
          // Booqable checkout pattern: /checkout?order_id={order_id}&starts_at={date}&stops_at={date}
          // Per Booqable: customers will see all items pre-loaded at checkout with rental period
          if (!checkoutUrl && order_id) {
            const urlParams = new URLSearchParams();
            urlParams.set('order_id', order_id);
            
            // Add rental period dates to URL so checkout widget displays them correctly
            if (rentalStartsAt) {
              urlParams.set('starts_at', rentalStartsAt);
            }
            if (rentalStopsAt) {
              urlParams.set('stops_at', rentalStopsAt);
            }
            
            checkoutUrl = `${BOOQABLE_SHOP_URL}/checkout?${urlParams.toString()}`;
            console.log(`[Booqable] Constructed checkout URL with rental period: ${checkoutUrl}`);
          } else if (checkoutUrl && (rentalStartsAt || rentalStopsAt)) {
            // If we got an explicit URL from Booqable, still add dates as parameters
            try {
              const url = new URL(checkoutUrl);
              if (rentalStartsAt) {
                url.searchParams.set('starts_at', rentalStartsAt);
              }
              if (rentalStopsAt) {
                url.searchParams.set('stops_at', rentalStopsAt);
              }
              checkoutUrl = url.toString();
              console.log(`[Booqable] Added rental period to checkout URL: ${checkoutUrl}`);
            } catch (e) {
              console.warn(`[Booqable] Could not parse checkout URL to add dates:`, e);
            }
          }

          console.log(`[Booqable] Order ${order_id}: number=${orderNumber}, token=${orderToken}, checkoutUrl=${checkoutUrl ?? 'null'}`);
        } else {
          const errorText = await orderResponse.text();
          console.log(`[Booqable] Failed to fetch order ${order_id}: ${orderResponse.status}`, errorText.slice(0, 200));
        }

        return new Response(
          JSON.stringify({
            checkoutUrl: checkoutUrl ?? `${BOOQABLE_SHOP_URL}/checkout`,
            checkoutUrlSource: checkoutUrl ? 'constructed' : 'fallback',
            orderId: order_id,
            orderNumber,
            orderToken,
            message: checkoutUrl
              ? 'Order created and reserved. Redirecting to checkout.'
              : 'Order created. Redirecting to shop checkout.'
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
