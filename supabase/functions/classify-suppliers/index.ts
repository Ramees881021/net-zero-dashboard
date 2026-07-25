import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCOPE3_CATEGORY_CODES = [
  "purchased_goods", "capital_goods", "fuel_energy", "upstream_transport",
  "waste", "business_travel", "employee_commuting", "upstream_leased",
  "downstream_transport", "processing_sold", "use_sold", "end_of_life",
  "downstream_leased", "franchises", "investments",
];

const SCOPE3_CATEGORY_LABELS: Record<string, string> = {
  purchased_goods: "1. Purchased Goods & Services",
  capital_goods: "2. Capital Goods",
  fuel_energy: "3. Fuel & Energy-Related Activities",
  upstream_transport: "4. Upstream Transportation & Distribution",
  waste: "5. Waste Generated in Operations",
  business_travel: "6. Business Travel",
  employee_commuting: "7. Employee Commuting",
  upstream_leased: "8. Upstream Leased Assets",
  downstream_transport: "9. Downstream Transportation",
  processing_sold: "10. Processing of Sold Products",
  use_sold: "11. Use of Sold Products",
  end_of_life: "12. End-of-Life Treatment",
  downstream_leased: "13. Downstream Leased Assets",
  franchises: "14. Franchises",
  investments: "15. Investments",
};

const BATCH_SIZE = 50;
const SAVE_BATCH_SIZE = 100;

const SYSTEM_PROMPT = `You are a GHG Protocol Scope 3 carbon accounting classifier. Classify each supplier into exactly one of these 15 Scope 3 categories based on the supplier's name, description, and typical business activity:

${Object.entries(SCOPE3_CATEGORY_LABELS).map(([code, label]) => `- "${code}" = ${label}`).join("\n")}
- "review_queue" = Cannot confidently classify

Classification guidance:
- Category 1 (purchased_goods): Raw materials, components, consumables, office supplies, SaaS/software licenses, professional services, consulting, cleaning, catering, IT services
- Category 2 (capital_goods): Machinery, vehicles, buildings, hardware infrastructure, major equipment, furniture with long lifespan, servers
- Category 3 (fuel_energy): Fuel suppliers, energy brokers, gas/electricity not in Scope 1/2
- Category 4 (upstream_transport): Freight, logistics, shipping, warehousing, courier services
- Category 5 (waste): Waste management, recycling services, hazardous waste disposal
- Category 6 (business_travel): Travel agencies, airlines, car rental, hotels, rail services
- Category 7 (employee_commuting): Shuttle services, bike schemes, commute programs
- Category 8 (upstream_leased): Leased office space, equipment rental, co-working
- Category 9 (downstream_transport): Outbound distribution, last-mile delivery
- Category 10 (processing_sold): Contract manufacturers processing your intermediate products
- Category 11 (use_sold): Energy consumed by your products during use
- Category 12 (end_of_life): Product take-back, disposal services
- Category 13 (downstream_leased): Property/assets you lease to others
- Category 14 (franchises): Franchise operations
- Category 15 (investments): Financial investments, equity stakes

For each supplier, provide your confidence (0.0-1.0). Be decisive.`;

async function classifyBatch(
  suppliers: any[],
  batchOffset: number,
  apiKey: string
): Promise<any[]> {
  const supplierList = suppliers
    .map((s, i) => `${i + 1}. Name: "${s.supplier_name}", Description: "${s.description || ""}"`)
    .join("\n");

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Classify these ${suppliers.length} suppliers:\n${supplierList}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "classify_suppliers",
          description: "Classify each supplier into one of the 15 Scope 3 categories or review_queue",
          parameters: {
            type: "object",
            properties: {
              classifications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "integer" },
                    category: { type: "string", enum: [...SCOPE3_CATEGORY_CODES, "review_queue"] },
                    confidence: { type: "number" },
                  },
                  required: ["index", "category", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["classifications"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "classify_suppliers" } },
    }),
  });

  if (!aiResponse.ok) {
    const status = aiResponse.status;
    const text = await aiResponse.text();
    console.error(`AI batch error (offset ${batchOffset}):`, status, text);
    if (status === 429 || status === 402) {
      throw { status, message: status === 429 ? "Rate limit exceeded. Please try again shortly." : "AI credits exhausted. Please add funds." };
    }
    throw new Error(`AI classification failed for batch at offset ${batchOffset}`);
  }

  const aiData = await aiResponse.json();
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  let classifications: any[] = [];

  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    classifications = parsed.classifications || [];
  }

  return suppliers.map((s, i) => {
    const match = classifications.find((c: any) => c.index === i + 1);
    const category = match?.category || "review_queue";
    const confidence = match?.confidence || 0;
    const autoRouted = confidence >= 0.85 && category !== "review_queue";

    return {
      supplier_name: s.supplier_name,
      description: s.description || "",
      optional_spend: s.optional_spend || "",
      optional_contact: s.optional_contact || "",
      ai_category: category,
      ai_confidence: confidence,
      current_category: autoRouted ? category : "review_queue",
      auto_routed: autoRouted,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action } = body;

    // ── ACTION: classify ──────────────────────────────────────────────
    if (action === "classify") {
      const { suppliers } = body;
      if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
        throw new Error("No suppliers provided");
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Split into batches of BATCH_SIZE
      const batches: any[][] = [];
      for (let i = 0; i < suppliers.length; i += BATCH_SIZE) {
        batches.push(suppliers.slice(i, i + BATCH_SIZE));
      }

      console.log(`Classifying ${suppliers.length} suppliers in ${batches.length} batch(es) of up to ${BATCH_SIZE}`);

      const allResults: any[] = [];
      for (let b = 0; b < batches.length; b++) {
        const batchResults = await classifyBatch(batches[b], b * BATCH_SIZE, LOVABLE_API_KEY);
        allResults.push(...batchResults);
        // Small delay between batches to avoid rate limits
        if (b < batches.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      const classified = allResults.filter((r) => r.auto_routed);
      const reviewQueue = allResults.filter((r) => !r.auto_routed);

      const categoryStats: Record<string, number> = {};
      for (const code of SCOPE3_CATEGORY_CODES) {
        const count = allResults.filter((r) => r.current_category === code).length;
        if (count > 0) categoryStats[code] = count;
      }

      return new Response(
        JSON.stringify({
          classified,
          review_queue: reviewQueue,
          stats: {
            total: allResults.length,
            auto_classified: classified.length,
            needs_review: reviewQueue.length,
            category_breakdown: categoryStats,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: save ──────────────────────────────────────────────────
    if (action === "save") {
      const { suppliers } = body;
      if (!suppliers || !Array.isArray(suppliers)) throw new Error("No suppliers");

      console.log(`Saving ${suppliers.length} suppliers in batches of ${SAVE_BATCH_SIZE}`);

      const allResults: any[] = [];

      // Process in batches for performance
      for (let i = 0; i < suppliers.length; i += SAVE_BATCH_SIZE) {
        const batch = suppliers.slice(i, i + SAVE_BATCH_SIZE);
        const upsertRows = batch.map((s: any) => ({
          user_id: user.id,
          name_normalized: s.supplier_name.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " "),
          name_display: s.supplier_name.trim(),
          description: s.description || null,
          ai_category: s.ai_category,
          ai_confidence: s.ai_confidence,
          user_override_category: s.user_override_category || null,
          current_category: s.user_override_category || s.current_category || s.ai_category,
          last_classified_at: new Date().toISOString(),
        }));

        const { data, error } = await supabase
          .from("suppliers_master")
          .upsert(upsertRows, { onConflict: "user_id,name_normalized" })
          .select();

        if (error) {
          console.error("Batch save error:", error);
          batch.forEach((s: any) => allResults.push({ name: s.supplier_name, error: error.message }));
        } else {
          (data || []).forEach((d: any) => allResults.push({ name: d.name_display, id: d.id, saved: true }));
        }
      }

      return new Response(
        JSON.stringify({
          saved: allResults.filter((r) => r.saved).length,
          errors: allResults.filter((r) => r.error),
          results: allResults,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: generate-template ─────────────────────────────────────
    if (action === "generate-template") {
      const { category } = body;
      if (!SCOPE3_CATEGORY_CODES.includes(category)) throw new Error("Invalid category");

      const { data: suppliers, error } = await supabase
        .from("suppliers_master")
        .select("*")
        .eq("user_id", user.id)
        .eq("current_category", category)
        .order("name_display", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ suppliers: suppliers || [], category }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: reimport ──────────────────────────────────────────────
    if (action === "reimport") {
      const { entries, category } = body;
      if (!entries || !Array.isArray(entries)) throw new Error("No entries");
      if (!SCOPE3_CATEGORY_CODES.includes(category)) throw new Error("Invalid category");

      const { data: masterSuppliers } = await supabase
        .from("suppliers_master")
        .select("*")
        .eq("user_id", user.id);

      const master = masterSuppliers || [];
      const imported: any[] = [];
      const mismatches: any[] = [];
      const newClassified: any[] = [];

      for (const entry of entries) {
        const nameNormalized = entry.supplier_name.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
        const existing = master.find((m: any) => m.name_normalized === nameNormalized);

        if (existing) {
          if (existing.current_category === category) {
            let saveError = null;
            if (category === "purchased_goods") {
              const { error } = await supabase.from("supplier_data_pg").insert({
                supplier_id: existing.id, user_id: user.id,
                reporting_year: entry.reporting_year || new Date().getFullYear(),
                spend_usd: entry.spend_usd || null, quantity: entry.quantity || null,
                unit: entry.unit || null, emission_factor_id: entry.emission_factor_id || null,
                tco2e: entry.tco2e || null,
              });
              saveError = error;
            } else if (category === "capital_goods") {
              const { error } = await supabase.from("supplier_data_cg").insert({
                supplier_id: existing.id, user_id: user.id,
                reporting_year: entry.reporting_year || new Date().getFullYear(),
                asset_value_usd: entry.asset_value_usd || null,
                lifespan_years: entry.lifespan_years || null,
                purchase_date: entry.purchase_date || null,
                emission_factor_id: entry.emission_factor_id || null,
                tco2e: entry.tco2e || null,
              });
              saveError = error;
            }

            if (!saveError) imported.push({ supplier_name: entry.supplier_name, status: "imported" });
            else imported.push({ supplier_name: entry.supplier_name, status: "error", error: saveError.message });
          } else {
            mismatches.push({ supplier_name: entry.supplier_name, expected: existing.current_category, got: category });
          }
        } else {
          const { data: newSup } = await supabase
            .from("suppliers_master")
            .insert({
              user_id: user.id, name_normalized: nameNormalized,
              name_display: entry.supplier_name.trim(),
              description: entry.description || null, ai_category: category,
              ai_confidence: 0, current_category: category,
              last_classified_at: new Date().toISOString(),
            })
            .select().single();

          if (newSup) {
            newClassified.push({ supplier_name: entry.supplier_name, category });
            if (category === "purchased_goods") {
              await supabase.from("supplier_data_pg").insert({
                supplier_id: newSup.id, user_id: user.id,
                reporting_year: entry.reporting_year || new Date().getFullYear(),
                spend_usd: entry.spend_usd || null, quantity: entry.quantity || null,
                unit: entry.unit || null, tco2e: entry.tco2e || null,
              });
            } else if (category === "capital_goods") {
              await supabase.from("supplier_data_cg").insert({
                supplier_id: newSup.id, user_id: user.id,
                reporting_year: entry.reporting_year || new Date().getFullYear(),
                asset_value_usd: entry.asset_value_usd || null,
                lifespan_years: entry.lifespan_years || null,
                purchase_date: entry.purchase_date || null,
                tco2e: entry.tco2e || null,
              });
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          imported: imported.filter((i: any) => i.status === "imported").length,
          mismatches, new_classified: newClassified.length,
          details: { imported, mismatches, newClassified },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: any) {
    console.error("classify-suppliers error:", e);
    if (e.status === 429 || e.status === 402) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : e?.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
