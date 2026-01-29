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
        
        const orderData: Record<string, unknown> = {
          data: {
            type: 'orders',
            attributes: {
              starts_at,
              stops_at,
            },
          },
        };

        if (customer_id) {
          orderData.data = {
            ...(orderData.data as Record<string, unknown>),
            relationships: {
              customer: {
                data: { type: 'customers', id: customer_id }
              }
            }
          };
        }

        const response = await booqableRequest('/orders', 'POST', orderData);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error creating order:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to create order', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log(`[Booqable] Order created: ${data.data?.id}`);

        return new Response(
          JSON.stringify({ order: data.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add-line': {
        const { order_id, product_id, quantity } = params;
        
        const lineData = {
          data: {
            type: 'lines',
            attributes: {
              quantity: quantity || 1,
            },
            relationships: {
              order: {
                data: { type: 'orders', id: order_id }
              },
              item: {
                data: { type: 'product_groups', id: product_id }
              }
            }
          }
        };

        const response = await booqableRequest('/lines', 'POST', lineData);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Booqable] Error adding line:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to add line item', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log(`[Booqable] Line added: ${data.data?.id}`);

        return new Response(
          JSON.stringify({ line: data.data }),
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
