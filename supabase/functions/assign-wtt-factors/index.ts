import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FuelItem {
  source: "scope1" | "scope2";
  type: string;
  fuelLabel: string;
  quantity: number;
  unit: string;
  country?: string;
  gridRegion?: string;
  description: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { items } = (await req.json()) as { items: FuelItem[] };
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemSummaries = items
      .map(
        (item, i) =>
          `Item ${i + 1}: Source=${item.source}, Type="${item.fuelLabel}", Quantity=${item.quantity} ${item.unit}${item.country ? `, Country=${item.country}` : ""}${item.gridRegion ? `, Grid=${item.gridRegion}` : ""}, Description="${item.description}"`
      )
      .join("\n");

    const systemPrompt = `You are an expert carbon emissions analyst specialising in GHG Protocol Scope 3 Category 3: Fuel & Energy-Related Activities (not included in Scope 1 or 2).

For each item you must provide the appropriate Well-to-Tank (WTT) emission factor, and for electricity items also a Transmission & Distribution (T&D) loss factor.

Guidelines:
- For Scope 1 fuels (natural gas, diesel, petrol, coal, etc.): provide the WTT factor in the SAME unit as the input (e.g. tCO₂e per kWh, tCO₂e per litre, tCO₂e per tonne). This covers upstream extraction, refining, and transport of the fuel.
- For Scope 2 electricity: provide BOTH a WTT factor (upstream generation fuel extraction) AND a T&D factor (transmission & distribution losses), both in tCO₂e per kWh. Consider the country/grid region for T&D losses.
- Use DEFRA 2025 WTT factors as primary reference.
- For T&D losses, typical values are 5-15% of the grid factor depending on country.
- Be precise and conservative.

You MUST respond using the provided tool.`;

    const userPrompt = `Assign WTT and T&D emission factors for the following ${items.length} Scope 1/2 activity items for Category 3 calculation:\n\n${itemSummaries}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "assign_wtt_factors",
                description:
                  "Assign WTT and T&D emission factors for Category 3 calculation",
                parameters: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item_index: {
                            type: "number",
                            description: "0-based index of the item",
                          },
                          wtt_factor: {
                            type: "number",
                            description:
                              "Well-to-Tank emission factor in tCO₂e per unit (same unit as input)",
                          },
                          td_factor: {
                            type: "number",
                            description:
                              "Transmission & Distribution loss factor in tCO₂e per kWh (only for electricity, 0 for fuels)",
                          },
                          wtt_source: {
                            type: "string",
                            description:
                              "Source reference e.g. 'DEFRA 2025 - WTT Natural Gas'",
                          },
                          reasoning: {
                            type: "string",
                            description:
                              "Brief explanation of factor selection",
                          },
                        },
                        required: [
                          "item_index",
                          "wtt_factor",
                          "td_factor",
                          "wtt_source",
                          "reasoning",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["results"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "assign_wtt_factors" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return tool call results");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const aiResults = parsed.results;

    // Calculate tCO2e for each item
    const finalResults = items.map((item, i) => {
      const aiResult = aiResults.find((r: any) => r.item_index === i);
      if (!aiResult) {
        return {
          wtt_factor: 0,
          td_factor: 0,
          wtt_tco2e: 0,
          td_tco2e: 0,
          total_tco2e: 0,
          wtt_source: "Not determined",
          reasoning: "AI did not provide a factor for this item",
        };
      }

      const wttTco2e = item.quantity * aiResult.wtt_factor;
      const tdTco2e = item.source === "scope2" ? item.quantity * aiResult.td_factor : 0;

      return {
        wtt_factor: aiResult.wtt_factor,
        td_factor: aiResult.td_factor,
        wtt_tco2e: parseFloat(wttTco2e.toFixed(6)),
        td_tco2e: parseFloat(tdTco2e.toFixed(6)),
        total_tco2e: parseFloat((wttTco2e + tdTco2e).toFixed(6)),
        wtt_source: aiResult.wtt_source,
        reasoning: aiResult.reasoning,
      };
    });

    return new Response(JSON.stringify({ results: finalResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assign-wtt-factors error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
