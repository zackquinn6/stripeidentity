import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BOOQABLE_API_KEY = Deno.env.get('BOOQABLE_API_KEY');
const BOOQABLE_COMPANY_ID = 'feeebb8b-2583-4689-b2f6-d488f8220b65';
const BOOQABLE_BASE_URL = `https://${BOOQABLE_COMPANY_ID}.booqable.com/api/1`;

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

    switch (action) {
      case 'get-products': {
        // Fetch all product groups from Booqable
        const response = await booqableRequest('/product_groups?per=100&filter[archived]=false');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error fetching products:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch products from Booqable', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const responseData = await response.json();
        console.log('[Booqable] Raw response structure:', JSON.stringify(Object.keys(responseData)));
        
        // Handle different response formats
        const data = responseData.data || responseData.product_groups || [];
        console.log(`[Booqable] Fetched ${Array.isArray(data) ? data.length : 0} products`);

        // Handle case where API returns no products or empty response
        if (!Array.isArray(data) || data.length === 0) {
          console.log('[Booqable] No products found, returning empty array');
          return new Response(
            JSON.stringify({ products: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Map Booqable products to our format - handle both JSON:API and standard formats
        const products = data.map((product: BooqableProduct | Record<string, unknown>) => {
          // JSON:API format
          if ('attributes' in product) {
            const p = product as BooqableProduct;
            return {
              booqableId: p.id,
              slug: p.attributes.slug,
              name: p.attributes.name,
              description: p.attributes.description || '',
              imageUrl: p.attributes.photo_url || '',
              dailyRate: p.attributes.base_price_in_cents / 100,
              depositAmount: (p.attributes.deposit_in_cents || 0) / 100,
              stockCount: p.attributes.stock_count || 0,
              trackable: p.attributes.trackable || false,
            };
          }
          // Standard format
          const std = product as Record<string, unknown>;
          return {
            booqableId: String(std.id || ''),
            slug: String(std.slug || ''),
            name: String(std.name || ''),
            description: String(std.description || ''),
            imageUrl: String(std.photo_url || ''),
            dailyRate: (Number(std.base_price_in_cents) || 0) / 100,
            depositAmount: (Number(std.deposit_in_cents) || 0) / 100,
            stockCount: Number(std.stock_count) || 0,
            trackable: Boolean(std.trackable),
          };
        });

        return new Response(
          JSON.stringify({ products }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-order': {
        const { starts_at, stops_at, customer_id } = params;
        
        // Booqable v1 API uses a simpler structure
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
        // Handle both v1 (data.order) and JSON:API (data.data) formats
        const order = data.order || data.data;
        console.log(`[Booqable] Order created: ${order?.id}`, JSON.stringify(order).slice(0, 200));

        return new Response(
          JSON.stringify({ order }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add-line': {
        const { order_id, product_id, quantity } = params;
        
        // First, check if product_id is a UUID or a slug
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id);
        
        let actualProductId = product_id;
        
        // If it's a slug, look up the actual product ID
        if (!isUUID) {
          console.log(`[Booqable] Looking up product by slug: ${product_id}`);
          // Fetch all products and find exact slug match (API filter may not be exact)
          const lookupResponse = await booqableRequest(`/product_groups?per=100&filter[archived]=false`);
          
          if (lookupResponse.ok) {
            const lookupData = await lookupResponse.json();
            const products = lookupData.product_groups || lookupData.data || [];
            // Find exact slug match
            const matchedProduct = products.find((p: { slug: string }) => p.slug === product_id);
            
            if (matchedProduct) {
              actualProductId = matchedProduct.id;
              console.log(`[Booqable] Found product ID: ${actualProductId} for slug: ${product_id}`);
            } else {
              console.log(`[Booqable] No product found for slug: ${product_id}. Available slugs: ${products.slice(0, 5).map((p: { slug: string }) => p.slug).join(', ')}...`);
              return new Response(
                JSON.stringify({ error: `Product not found: ${product_id}` }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }
        
        // Booqable v1 API: add line via POST to /orders/{id}/lines
        const lineData = {
          line: {
            item_id: actualProductId,
            item_type: 'ProductGroup',
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
        
        // Booqable checkout URL format
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
