import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PricingComparison {
  comparison_level: 'exact' | 'professional' | 'diy' | 'used';
  model_name: string;
  retailer: string;
  price: number;
  url?: string;
}

interface PricingResult {
  comparisons: PricingComparison[];
  average_price: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { item_name, item_description, section_item_id } = await req.json();

    if (!item_name || !section_item_id) {
      return new Response(
        JSON.stringify({ error: 'item_name and section_item_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[find-pricing] Finding pricing for: ${item_name}`);

    // Call Lovable AI to estimate market prices
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a market research assistant specializing in tool and equipment pricing. 
Your job is to provide realistic market price estimates for tools and equipment across different quality levels and retailers.

For each product, provide pricing at these levels:
1. EXACT: The exact product model if identifiable, or the closest equivalent
2. PROFESSIONAL: 3 professional-grade alternatives (DeWalt, Milwaukee, Makita, Bosch, Festool)
3. DIY: 3 consumer/DIY-grade alternatives (Ryobi, Black+Decker, Craftsman, Harbor Freight, Kobalt)
4. USED: Estimated used market prices for Facebook Marketplace/Craigslist

Retailers to include: Home Depot, Amazon, Harbor Freight (for DIY), Facebook Marketplace (for used)

Always provide realistic 2024-2025 market prices in USD.`
          },
          {
            role: 'user',
            content: `Provide market pricing analysis for this tool/equipment:

Product: ${item_name}
${item_description ? `Description: ${item_description}` : ''}

Return pricing data for all comparison levels.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_pricing_data',
              description: 'Return structured pricing comparison data',
              parameters: {
                type: 'object',
                properties: {
                  comparisons: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        comparison_level: {
                          type: 'string',
                          enum: ['exact', 'professional', 'diy', 'used'],
                          description: 'The quality/market tier of this comparison'
                        },
                        model_name: {
                          type: 'string',
                          description: 'Full model name including brand (e.g., "DeWalt DCD771C2 20V MAX Drill")'
                        },
                        retailer: {
                          type: 'string',
                          description: 'Retailer name (Home Depot, Amazon, Harbor Freight, Facebook Marketplace)'
                        },
                        price: {
                          type: 'number',
                          description: 'Estimated price in USD'
                        }
                      },
                      required: ['comparison_level', 'model_name', 'retailer', 'price']
                    }
                  }
                },
                required: ['comparisons']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_pricing_data' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('[find-pricing] AI gateway error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI gateway error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('[find-pricing] AI response received');

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error('[find-pricing] No tool call in response');
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI pricing response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pricingData = JSON.parse(toolCall.function.arguments) as PricingResult;
    const comparisons = pricingData.comparisons || [];

    console.log(`[find-pricing] Got ${comparisons.length} pricing comparisons`);

    // Delete existing comparisons for this item
    const { error: deleteError } = await supabaseClient
      .from('pricing_comparisons')
      .delete()
      .eq('section_item_id', section_item_id);

    if (deleteError) {
      console.error('[find-pricing] Error deleting old comparisons:', deleteError);
    }

    // Insert new comparisons
    if (comparisons.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('pricing_comparisons')
        .insert(
          comparisons.map((c: PricingComparison) => ({
            section_item_id,
            comparison_level: c.comparison_level,
            model_name: c.model_name,
            retailer: c.retailer,
            price: c.price,
            url: c.url || null,
          }))
        );

      if (insertError) {
        console.error('[find-pricing] Error inserting comparisons:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save pricing data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate average price
    const totalPrice = comparisons.reduce((sum: number, c: PricingComparison) => sum + c.price, 0);
    const averagePrice = comparisons.length > 0 ? totalPrice / comparisons.length : 0;

    // Update section_item with average price
    const { error: updateError } = await supabaseClient
      .from('section_items')
      .update({ average_market_price: averagePrice })
      .eq('id', section_item_id);

    if (updateError) {
      console.error('[find-pricing] Error updating average price:', updateError);
    }

    console.log(`[find-pricing] Success - ${comparisons.length} comparisons, avg: $${averagePrice.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        comparisons,
        average_price: averagePrice,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[find-pricing] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
