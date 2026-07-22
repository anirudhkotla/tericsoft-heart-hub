// Signs in (or signs up, first run) the one shared dev account server-side —
// this app has no login UI, but the browser must never hold the account's
// real password (Vite bakes any VITE_-prefixed var straight into the public
// bundle). The password lives only as a Supabase function secret here;
// the client gets back a session token pair, nothing else.
import { handleOptions, json } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const email = Deno.env.get("DEV_ACCOUNT_EMAIL");
    const password = Deno.env.get("DEV_ACCOUNT_PASSWORD");
    if (!email || !password) {
      return json(req, { error: "DEV_ACCOUNT_EMAIL / DEV_ACCOUNT_PASSWORD not configured" }, 500);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
    });

    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.data.session) {
      return json(req, {
        access_token: signIn.data.session.access_token,
        refresh_token: signIn.data.session.refresh_token,
      });
    }

    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.data.session) {
      return json(req, {
        access_token: signUp.data.session.access_token,
        refresh_token: signUp.data.session.refresh_token,
      });
    }

    return json(req, { error: "Could not establish the shared dev session (may need email confirmation)." }, 500);
  } catch (e) {
    return json(req, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
