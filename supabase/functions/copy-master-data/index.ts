import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_ACCOUNT_ID = "0fe57d1f-2bf8-45ba-86ce-18b139a6b195";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create user client to verify auth
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    if (userId === MASTER_ACCOUNT_ID) {
      return new Response(JSON.stringify({ message: "Master account, skipping" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has emissions data (using admin client to bypass RLS)
    const { count } = await supabaseAdmin
      .from("emissions_data")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count && count > 0) {
      return new Response(JSON.stringify({ message: "User already has data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all master data using admin client
    const [emissions, clients, netzero, budgets, credentials] = await Promise.all([
      supabaseAdmin.from("emissions_data").select("*").eq("user_id", MASTER_ACCOUNT_ID),
      supabaseAdmin.from("clients").select("*").eq("user_id", MASTER_ACCOUNT_ID),
      supabaseAdmin.from("netzero_targets").select("*").eq("user_id", MASTER_ACCOUNT_ID),
      supabaseAdmin.from("carbon_budgets").select("*").eq("user_id", MASTER_ACCOUNT_ID),
      supabaseAdmin.from("sustainability_credentials").select("*").eq("user_id", MASTER_ACCOUNT_ID),
    ]);

    // Copy data using admin client
    const results: string[] = [];

    if (emissions.data?.length) {
      const rows = emissions.data.map(({ id, user_id, organization_id, ...rest }) => ({
        ...rest,
        user_id: userId,
      }));
      const { error } = await supabaseAdmin.from("emissions_data").insert(rows);
      if (error) console.error("emissions insert error:", error);
      else results.push(`emissions: ${rows.length}`);
    }

    if (clients.data?.length) {
      const rows = clients.data.map(({ id, user_id, organization_id, ...rest }) => ({
        ...rest,
        user_id: userId,
      }));
      const { error } = await supabaseAdmin.from("clients").insert(rows);
      if (error) console.error("clients insert error:", error);
      else results.push(`clients: ${rows.length}`);
    }

    if (netzero.data?.length) {
      const rows = netzero.data.map(({ id, user_id, organization_id, ...rest }) => ({
        ...rest,
        user_id: userId,
      }));
      const { error } = await supabaseAdmin.from("netzero_targets").insert(rows);
      if (error) console.error("netzero insert error:", error);
      else results.push(`netzero: ${rows.length}`);
    }

    if (budgets.data?.length) {
      const rows = budgets.data.map(({ id, user_id, organization_id, ...rest }) => ({
        ...rest,
        user_id: userId,
      }));
      const { error } = await supabaseAdmin.from("carbon_budgets").insert(rows);
      if (error) console.error("budgets insert error:", error);
      else results.push(`budgets: ${rows.length}`);
    }

    if (credentials.data?.length) {
      const rows = credentials.data.map(({ id, user_id, organization_id, ...rest }) => ({
        ...rest,
        user_id: userId,
      }));
      const { error } = await supabaseAdmin.from("sustainability_credentials").insert(rows);
      if (error) console.error("credentials insert error:", error);
      else results.push(`credentials: ${rows.length}`);
    }

    return new Response(JSON.stringify({ message: "Data copied", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
