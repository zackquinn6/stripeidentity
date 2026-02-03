import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ProductSearchRequest {
  product_name: string;
  description?: string;
}

async function verifyAdminAuth(req: Request): Promise<{ userId: string | null; error: Response | null }> {
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
    console.error('[find-retailer-products] Auth verification failed:', error?.message);
    return {
      userId: null,
      error: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const userId = user.id;

  // Verify admin role
  const { data: roleData, error: roleError } = await supabaseClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError || !roleData) {
    console.log(`[find-retailer-products] User ${userId} is not an admin`);
    return {
      userId: null,
      error: new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { userId, error: null };
}

// Use the Lovable AI Gateway to generate search-optimized queries
async function generateSearchQuery(productName: string, description: string): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!apiKey) {
    console.log('[find-retailer-products] No LOVABLE_API_KEY, using product name directly');
    return productName;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a product search assistant. Given a product name and description, output ONLY the most effective search query to find this exact product on Amazon or Home Depot. Focus on the key product type and specifications. Output just the search query, nothing else.'
          },
          {
            role: 'user',
            content: `Product: ${productName}\nDescription: ${description || 'N/A'}`
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('[find-retailer-products] AI response error:', response.status);
      return productName;
    }

    const data = await response.json();
    const query = data.choices?.[0]?.message?.content?.trim() || productName;
    console.log(`[find-retailer-products] AI generated query: "${query}" from "${productName}"`);
    return query;
  } catch (error) {
    console.error('[find-retailer-products] AI error:', error);
    return productName;
  }
}

// Build search URLs for each retailer
function buildSearchUrls(query: string): { amazon: string; homeDepot: string } {
  const encodedQuery = encodeURIComponent(query);
  return {
    amazon: `https://www.amazon.com/s?k=${encodedQuery}`,
    homeDepot: `https://www.homedepot.com/s/${encodedQuery}`
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify admin authentication
    const { userId, error: authError } = await verifyAdminAuth(req);
    if (authError) {
      return authError;
    }
    console.log(`[find-retailer-products] Authenticated admin: ${userId}`);

    const { product_name, description }: ProductSearchRequest = await req.json();

    if (!product_name) {
      return new Response(
        JSON.stringify({ error: 'product_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[find-retailer-products] Searching for: ${product_name}`);

    // Generate an optimized search query using AI
    const searchQuery = await generateSearchQuery(product_name, description || '');
    
    // Build search URLs
    const searchUrls = buildSearchUrls(searchQuery);

    // Return the search URLs and query for manual review
    const result = {
      query: searchQuery,
      searchUrls,
      suggestions: [
        {
          source: 'amazon' as const,
          searchUrl: searchUrls.amazon,
          note: 'Click to search Amazon for matching products'
        },
        {
          source: 'home_depot' as const,
          searchUrl: searchUrls.homeDepot,
          note: 'Click to search Home Depot for matching products'
        }
      ]
    };

    console.log(`[find-retailer-products] Returning search URLs for query: "${searchQuery}"`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[find-retailer-products] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
