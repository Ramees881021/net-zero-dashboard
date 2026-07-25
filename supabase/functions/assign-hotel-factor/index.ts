import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { country, roomNights } = await req.json();
    if (!country || !roomNights) {
      return new Response(JSON.stringify({ error: "country and roomNights required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert carbon emissions analyst specialising in hotel accommodation emissions for GHG Protocol Scope 3 Category 6 (Business Travel).

Your task: assign an accurate emission factor (tCO₂e per room-night) for hotel stays in a specific country.

Use these references:
- DEFRA 2025: UK = 0.01038, International average = 0.01350 tCO₂e/night
- HCMI (Hotel Carbon Measurement Initiative) country-specific factors
- IEA country grid intensity affects hotel energy consumption

Guidelines:
- Countries with high grid carbon intensity → higher hotel factors
- Countries with low grid intensity (e.g. France, Norway) → lower hotel factors
- Tropical countries may have higher cooling loads
- Developed countries generally have better energy efficiency
- Return factor in tCO₂e per room-night

You MUST respond using the provided tool.`;

    const userPrompt = `Assign a hotel stay emission factor for ${roomNights} room-nights in ${country}. Provide the factor per room-night in tCO₂e.`;

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
                name: "assign_hotel_factor",
                description: "Assign hotel stay emission factor for a country",
                parameters: {
                  type: "object",
                  properties: {
                    emission_factor: {
                      type: "number",
                      description: "Emission factor in tCO₂e per room-night",
                    },
                    source: {
                      type: "string",
                      description: "Source reference e.g. 'DEFRA 2025' or 'HCMI / IEA 2025'",
                    },
                    reasoning: {
                      type: "string",
                      description: "Brief explanation of why this factor was chosen for this country",
                    },
                  },
                  required: ["emission_factor", "source", "reasoning"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "assign_hotel_factor" },
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

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assign-hotel-factor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
