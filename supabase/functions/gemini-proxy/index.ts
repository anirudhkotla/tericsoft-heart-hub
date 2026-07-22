// Generic passthrough to Gemini's generateContent REST endpoint. Used by the
// client-side call sites (dashboards.functions.ts, offers.functions.ts,
// expenses.functions.ts) that previously called Gemini directly with
// VITE_GEMINI_API_KEY — a real API key that Vite would bake straight into the
// public JS bundle. GEMINI_API_KEY here is a Supabase function secret and
// never reaches the browser. Requires a valid caller JWT (default verify_jwt)
// so an anonymous visitor can't just spend the project's Gemini quota.
import { corsHeaders, handleOptions, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json(req, { error: "GEMINI_API_KEY is not configured" }, 500);

    const { model, contents, generationConfig, systemInstruction } = await req.json();
    if (!contents) return json(req, { error: "contents is required" }, 400);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model ?? "gemini-2.5-flash"}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, generationConfig, systemInstruction }),
      },
    );

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return json(req, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
