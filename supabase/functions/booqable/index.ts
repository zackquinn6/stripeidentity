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

        const products = data.map((product: BooqableProduct | Record<string, unknown>) => {
          if ('attributes' in product) {
            const p = product as BooqableProduct;
            const attrs = p.attributes as Record<string, unknown>;
            const productType = String(attrs.product_type || 'rental');
            const isSalesItem = productType === 'consumable' || productType === 'service';
            
            // Parse price structure for tiered pricing
            const priceStructure = attrs.price_structure as { day?: number; hour?: number } | undefined;
            const basePriceInCents = Number(attrs.base_price_in_cents) || 0;
            const dailyRate = basePriceInCents / 100;
            
            // First day rate = base_price_in_cents (includes delivery/setup)
            // Daily rate after = price_structure.day (flat daily rate)
            // If no price_structure, fall back to base price for both
            const dayRateFromStructure = priceStructure?.day ? priceStructure.day / 100 : dailyRate;
            
            return {
              booqableId: p.id,
              slug: p.attributes.slug,
              name: p.attributes.name,
              description: p.attributes.description || '',
              imageUrl: p.attributes.photo_url || '',
              firstDayRate: dailyRate, // Day 1 includes delivery/setup
              dailyRate: dayRateFromStructure, // Day 2+ flat rate
              depositAmount: (p.attributes.deposit_in_cents || 0) / 100,
              stockCount: p.attributes.stock_count || 0,
              trackable: p.attributes.trackable || false,
              hasVariations: false,
              productType,
              isSalesItem,
            };
          }
          const std = product as Record<string, unknown>;
          const productType = String(std.product_type || 'rental');
          const isSalesItem = productType === 'consumable' || productType === 'service';
          
          // Parse price structure for tiered pricing
          const priceStructure = std.price_structure as { day?: number; hour?: number } | undefined;
          const basePriceInCents = Number(std.base_price_in_cents) || 0;
          const dailyRate = basePriceInCents / 100;
          const dayRateFromStructure = priceStructure?.day ? priceStructure.day / 100 : dailyRate;
          
          return {
            booqableId: String(std.id || ''),
            slug: String(std.slug || ''),
            name: String(std.name || ''),
            description: String(std.description || ''),
            imageUrl: String(std.photo_url || ''),
            firstDayRate: dailyRate, // Day 1 includes delivery/setup
            dailyRate: dayRateFromStructure, // Day 2+ flat rate
            depositAmount: (Number(std.deposit_in_cents) || 0) / 100,
            stockCount: Number(std.stock_count) || 0,
            trackable: Boolean(std.trackable),
            hasVariations: Boolean(std.has_variations),
            productType,
            isSalesItem,
          };
        });

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
        
        const variants = (pg.products || []).map((p: Record<string, unknown>) => ({
          id: String(p.id || ''),
          name: String(p.name || ''),
          sku: String(p.sku || ''),
          variationValues: Array.isArray(p.variation_values) ? p.variation_values : [],
          quantity: Number(p.quantity) || 0,
        }));

        const productType = String(pg.product_type || 'rental');
        const isSalesItem = productType === 'consumable' || productType === 'service';
        
        const productDetails = {
          booqableId: String(pg.id || ''),
          slug: String(pg.slug || ''),
          name: String(pg.name || ''),
          description: String(pg.description || ''),
          imageUrl: String(pg.photo_url || ''),
          dailyRate: (Number(pg.base_price_in_cents) || 0) / 100,
          depositAmount: (Number(pg.deposit_in_cents) || 0) / 100,
          stockCount: Number(pg.stock_count) || 0,
          trackable: Boolean(pg.trackable),
          hasVariations: Boolean(pg.has_variations),
          variationFields: Array.isArray(pg.variation_fields) ? pg.variation_fields : [],
          variants,
          productType,
          isSalesItem,
        };

        console.log(`[Booqable] Product has ${variants.length} variants, hasVariations: ${productDetails.hasVariations}`);

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
        const { order_id } = params;
        
        const checkoutUrl = `https://${BOOQABLE_COMPANY_ID}.booqable.shop/checkout/${order_id}`;
        
        return new Response(
          JSON.stringify({ checkoutUrl }),
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
