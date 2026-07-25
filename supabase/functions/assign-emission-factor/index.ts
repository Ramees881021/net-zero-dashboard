import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  entries: {
    supplier: string;
    description: string;
    method: "average" | "spend";
    quantity?: number;
    totalSpend?: number;
    category: "purchased_goods" | "capital_goods";
  }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { entries } = (await req.json()) as RequestBody;
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ error: "No entries provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entrySummaries = entries
      .map(
        (e, i) =>
          `Entry ${i + 1}: Category=${e.category === "purchased_goods" ? "Purchased Goods & Services" : "Capital Goods"}, Supplier="${e.supplier}", Description="${e.description}", Method=${e.method}, ${e.method === "average" ? `Quantity=${e.quantity} units` : `TotalSpend=$${e.totalSpend}`}`
      )
      .join("\n");

    const systemPrompt = `You are an expert carbon emissions analyst specializing in GHG Protocol Scope 3 emissions accounting. Your job is to assign accurate emission factors based on DEFRA 2025, IEA 2025, and EPA standards.

For each entry, you must determine the appropriate emission factor:
- For "average" method: provide emission factor in kg CO₂e per unit
- For "spend" method: provide emission factor in kg CO₂e per USD spent

Use the following guidelines:
- Consider the industry, product type, and supplier description
- Use DEFRA 2025 emission factors as primary reference
- For capital goods, consider embodied carbon of manufactured equipment
- For purchased goods, consider lifecycle emissions of products/materials
- Be conservative but realistic in your estimates
- If the description is vague, use a reasonable industry average

You MUST respond using the provided tool.`;

    const userPrompt = `Assign emission factors for the following ${entries.length} Scope 3 entries:\n\n${entrySummaries}`;

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
                name: "assign_emission_factors",
                description:
                  "Assign emission factors to each entry and calculate tCO2e",
                parameters: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          entry_index: {
                            type: "number",
                            description: "0-based index of the entry",
                          },
                          emission_factor: {
                            type: "number",
                            description:
                              "Emission factor in kg CO₂e per unit (average method) or kg CO₂e per USD (spend method)",
                          },
                          emission_factor_source: {
                            type: "string",
                            description:
                              "Source reference, e.g. 'DEFRA 2025 - Manufacturing' or 'EPA - Office supplies'",
                          },
                          reasoning: {
                            type: "string",
                            description:
                              "Brief explanation of why this factor was chosen",
                          },
                        },
                        required: [
                          "entry_index",
                          "emission_factor",
                          "emission_factor_source",
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
            function: { name: "assign_emission_factors" },
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

    // Calculate tCO2e for each entry
    const finalResults = entries.map((entry, i) => {
      const aiResult = aiResults.find((r: any) => r.entry_index === i);
      if (!aiResult) {
        return {
          emission_factor: 0,
          tco2e: 0,
          emission_factor_source: "Not determined",
          reasoning: "AI did not provide a factor for this entry",
        };
      }

      const ef = aiResult.emission_factor;
      let tco2e = 0;

      if (entry.method === "average" && entry.quantity) {
        tco2e = (entry.quantity * ef) / 1000; // kg to tonnes
      } else if (entry.method === "spend" && entry.totalSpend) {
        tco2e = (entry.totalSpend * ef) / 1000; // kg to tonnes
      }

      return {
        emission_factor: ef,
        tco2e: parseFloat(tco2e.toFixed(6)),
        emission_factor_source: aiResult.emission_factor_source,
        reasoning: aiResult.reasoning,
      };
    });

    return new Response(JSON.stringify({ results: finalResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assign-emission-factor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
