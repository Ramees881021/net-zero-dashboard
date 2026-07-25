import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  entries: {
    productName: string;
    processDescription: string;
    massTonnes: number;
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

    const summaries = entries
      .map(
        (e, i) =>
          `Entry ${i + 1}: Product="${e.productName}", Process="${e.processDescription}", Mass=${e.massTonnes} tonnes`
      )
      .join("\n");

    const systemPrompt = `You are an expert carbon emissions analyst specialising in GHG Protocol Scope 3 Category 10: Processing of Sold Products.

Your task is to assign average process emission factors (kg CO₂e per tonne of intermediate product processed) for downstream industrial processing that the reporting company's sold products undergo.

Guidelines:
- Use DEFRA 2025, EPA, IEA, and peer-reviewed LCA data as references
- Consider the specific industrial process described (e.g. sugar refining, steel forming, chemical synthesis)
- Factor should represent the energy, fuel, and waste emissions of the downstream processing step
- Be conservative but realistic; use industry averages when specific data is unavailable
- For food processing, typical factors range 50–500 kg CO₂e/tonne depending on process intensity
- For metals/materials, typical factors range 100–2000 kg CO₂e/tonne
- For chemicals, typical factors range 200–3000 kg CO₂e/tonne

You MUST respond using the provided tool.`;

    const userPrompt = `Assign average process emission factors for the following ${entries.length} intermediate products:\n\n${summaries}`;

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
                name: "assign_process_factors",
                description:
                  "Assign process emission factors for each sold intermediate product",
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
                              "Average process emission factor in kg CO₂e per tonne of product processed",
                          },
                          source: {
                            type: "string",
                            description:
                              "Source reference, e.g. 'DEFRA 2025 - Food Processing' or 'EPA - Chemical Manufacturing'",
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
                          "source",
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
            function: { name: "assign_process_factors" },
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

    const finalResults = entries.map((entry, i) => {
      const aiResult = aiResults.find((r: any) => r.entry_index === i);
      if (!aiResult) {
        return {
          emission_factor: 0,
          tco2e: 0,
          source: "Not determined",
          reasoning: "AI did not provide a factor for this entry",
        };
      }

      const ef = aiResult.emission_factor;
      const tco2e = (entry.massTonnes * ef) / 1000; // kg to tonnes

      return {
        emission_factor: ef,
        tco2e: parseFloat(tco2e.toFixed(6)),
        source: aiResult.source,
        reasoning: aiResult.reasoning,
      };
    });

    return new Response(JSON.stringify({ results: finalResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assign-process-factor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
