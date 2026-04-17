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

interface TierAverages {
  exact: number;
  professional: number;
  diy: number;
  used: number;
}

interface PricingResult {
  comparisons: PricingComparison[];
  tier_averages: TierAverages;
  recommended_comparison: number; // The most relevant retail price for rental comparison
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
            content: `You are a market research assistant specializing in tool and equipment pricing for home improvement projects.
Your job is to provide realistic NEW retail market prices that a typical DIY homeowner would encounter when shopping for tools.

COMPARISON LEVELS (provide pricing for each):

1. EXACT: The exact product model if identifiable from the name/description. If not identifiable, skip this level.

2. PROFESSIONAL: 3 professional-grade tool options. These are contractor/tradesperson quality brands:
   - Brands: DeWalt, Milwaukee, Makita, Bosch, Festool, Hilti, Metabo
   - Retailers: Home Depot, Lowe's, Amazon
   - These are premium-priced, built for daily commercial use

3. DIY: 3 consumer/homeowner-grade tool options. These are weekend warrior quality brands:
   - Brands: Ryobi, Black+Decker, Craftsman, Kobalt, Wen, Skil, Hart, Bauer (Harbor Freight)
   - Retailers: Home Depot, Lowe's, Amazon, Harbor Freight
   - Note: Harbor Freight is a RETAILER that sells DIY-grade tools, NOT a professional brand

4. USED: 2-3 typical used market prices from Facebook Marketplace or Craigslist
   - Mix of professional and DIY brands in used condition
   - Retailer should be "Facebook Marketplace" or "Craigslist"
   - Prices should reflect typical 30-60% discount from new retail

IMPORTANT:
- Use realistic 2024-2025 NEW retail prices in USD
- Include the full model name with brand (e.g., "DeWalt DWE7491RS 10" Table Saw")
- For each comparison, specify which major retailer typically stocks it
- Harbor Freight tools are DIY-grade, never professional`
          },
          {
            role: 'user',
            content: `Provide market pricing analysis for this tool/equipment that a homeowner might rent instead of buy:

Product: ${item_name}
${item_description ? `Description: ${item_description}` : ''}

Return pricing for all applicable comparison levels. This data will help customers understand the value of renting vs buying.`
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

    // Calculate tier-specific averages
    const tierAverages: TierAverages = { exact: 0, professional: 0, diy: 0, used: 0 };
    const tierCounts: TierAverages = { exact: 0, professional: 0, diy: 0, used: 0 };
    
    for (const c of comparisons) {
      const level = c.comparison_level as keyof TierAverages;
      if (level in tierAverages) {
        tierAverages[level] += c.price;
        tierCounts[level] += 1;
      }
    }
    
    // Calculate averages per tier
    for (const level of ['exact', 'professional', 'diy', 'used'] as const) {
      if (tierCounts[level] > 0) {
        tierAverages[level] = Math.round((tierAverages[level] / tierCounts[level]) * 100) / 100;
      }
    }
    
    // Recommended comparison: use DIY average if available, otherwise professional, then exact
    // This represents what a typical homeowner would actually buy
    const recommendedComparison = tierAverages.diy > 0 
      ? tierAverages.diy 
      : tierAverages.professional > 0 
        ? tierAverages.professional 
        : tierAverages.exact;

    // Update section_item with DIY average (most relevant for rental comparison)
    const { error: updateError } = await supabaseClient
      .from('section_items')
      .update({ average_market_price: recommendedComparison })
      .eq('id', section_item_id);

    if (updateError) {
      console.error('[find-pricing] Error updating average price:', updateError);
    }

    console.log(`[find-pricing] Success - ${comparisons.length} comparisons, tier avgs: Pro=$${tierAverages.professional}, DIY=$${tierAverages.diy}, Used=$${tierAverages.used}`);

    return new Response(
      JSON.stringify({
        success: true,
        comparisons,
        tier_averages: tierAverages,
        recommended_comparison: recommendedComparison,
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
