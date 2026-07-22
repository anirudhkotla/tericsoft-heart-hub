// Server-side OAuth 2.1 + PKCE + Dynamic Client Registration for MCP servers,
// per the MCP Authorization spec. Runs entirely server-to-server so it isn't
// subject to browser CORS — Airtable's /register and /token endpoints send no
// CORS headers at all, which is why the old client-side flow could never work
// there. Also fixes a real RFC 8414 bug the old client-side discovery had:
// the well-known segment must be inserted BEFORE the authorization server's
// path component, not appended after it.
import { corsHeaders, handleOptions, json } from "../_shared/cors.ts";
import { callerClient, serviceRoleClient } from "../_shared/datasource.ts";

interface AuthServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(len = 64): string {
  return base64url(crypto.getRandomValues(new Uint8Array(len)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function wellKnownCandidates(authServerBase: string): string[] {
  const u = new URL(authServerBase);
  const path = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/$/, "") : "";
  return [
    // RFC 8414-correct: well-known segment inserted BEFORE the path.
    `${u.origin}/.well-known/oauth-authorization-server${path}`,
    `${u.origin}/.well-known/openid-configuration${path}`,
    // Legacy/incorrect form some servers still serve — try as a fallback.
    `${authServerBase.replace(/\/$/, "")}/.well-known/oauth-authorization-server`,
    `${authServerBase.replace(/\/$/, "")}/.well-known/openid-configuration`,
  ];
}

async function discoverAuthServer(
  serverUrl: string,
): Promise<{ meta: AuthServerMetadata; resource?: string }> {
  const origin = new URL(serverUrl).origin;

  let authServerBase = origin;
  let resource: string | undefined;
  try {
    const res = await fetch(`${origin}/.well-known/oauth-protected-resource`);
    if (res.ok) {
      const jsonBody = await res.json();
      resource = jsonBody.resource ?? serverUrl;
      if (Array.isArray(jsonBody.authorization_servers) && jsonBody.authorization_servers[0]) {
        authServerBase = jsonBody.authorization_servers[0];
      }
    }
  } catch {
    /* no protected-resource metadata; try same-origin discovery */
  }

  for (const url of wellKnownCandidates(authServerBase)) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const meta = (await res.json()) as AuthServerMetadata;
        if (meta.authorization_endpoint && meta.token_endpoint) return { meta, resource };
      }
    } catch {
      /* try next candidate */
    }
  }
  throw new Error("This server doesn't advertise OAuth support.");
}

async function registerClient(
  meta: AuthServerMetadata,
  redirect: string,
): Promise<{ clientId: string; clientSecret?: string; authMethod: string }> {
  if (!meta.registration_endpoint) {
    throw new Error("Server has no dynamic client registration endpoint.");
  }
  const res = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Tericsoft HR OS",
      redirect_uris: [redirect],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Client registration failed (${res.status}) for redirect_uri=${redirect}: ${text.slice(0, 300)}`);
  }
  const body = await res.json();
  if (!body.client_id) throw new Error("Client registration did not return a client_id");
  return {
    clientId: body.client_id as string,
    clientSecret: body.client_secret as string | undefined,
    authMethod: (body.token_endpoint_auth_method as string) ?? "none",
  };
}

function functionBaseUrl(): string {
  // req.url reflects Supabase's internal routing (http:, no /functions/v1
  // prefix, sometimes missing the function slug) — not the public address a
  // third party can actually redirect back to. Build it from the project URL
  // instead, which is the one thing guaranteed to be externally reachable.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  return `${supabaseUrl}/functions/v1/oauth-connect`;
}

async function handleStart(req: Request): Promise<Response> {
  const caller = callerClient(req);
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return json(req, { error: "Not authenticated" }, 401);

  const { provider, dsName, serverUrl } = await req.json();
  if (!dsName || !serverUrl) return json(req, { error: "dsName and serverUrl are required" }, 400);

  const { meta, resource } = await discoverAuthServer(serverUrl);
  const redirectUri = `${functionBaseUrl()}/callback`;
  const { clientId, clientSecret, authMethod } = await registerClient(meta, redirectUri);

  const codeVerifier = randomString(64);
  const codeChallenge = await pkceChallenge(codeVerifier);
  const state = randomString(24);

  const admin = serviceRoleClient();
  const { error } = await admin.from("oauth_pending").insert({
    state,
    user_id: user.id,
    provider: provider ?? "custom",
    ds_name: dsName,
    server_url: serverUrl,
    code_verifier: codeVerifier,
    token_endpoint: meta.token_endpoint,
    client_id: clientId,
    client_secret: clientSecret ?? null,
    token_endpoint_auth_method: authMethod,
    redirect_uri: redirectUri,
    resource: resource ?? null,
  });
  if (error) return json(req, { error: error.message }, 500);

  const authUrl = new URL(meta.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  if (meta.scopes_supported?.length)
    authUrl.searchParams.set("scope", meta.scopes_supported.join(" "));
  if (resource) authUrl.searchParams.set("resource", resource);

  return json(req, { authorizationUrl: authUrl.toString() });
}

function appRedirect(req: Request, params: Record<string, string>): Response {
  const appUrl = Deno.env.get("APP_URL") ?? new URL(req.url).origin;
  const url = new URL(`${appUrl.replace(/\/$/, "")}/datasources/oauth-callback`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders(req), Location: url.toString() },
  });
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError)
    return appRedirect(req, { error: url.searchParams.get("error_description") ?? oauthError });
  if (!state || !code) return appRedirect(req, { error: "Missing state or code" });

  const admin = serviceRoleClient();
  const { data: pending, error: fetchError } = await admin
    .from("oauth_pending")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (fetchError || !pending)
    return appRedirect(req, { error: "No pending connection found — please try again." });
  await admin.from("oauth_pending").delete().eq("state", state);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: pending.redirect_uri,
    client_id: pending.client_id,
    code_verifier: pending.code_verifier,
  });
  if (pending.client_secret) body.set("client_secret", pending.client_secret);

  const tokenRes = await fetch(pending.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    return appRedirect(req, {
      error: `Token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`,
    });
  }
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token)
    return appRedirect(req, { error: "Token endpoint did not return an access_token" });

  const { data: dsRow, error: dsError } = await admin
    .from("datasources")
    .insert({
      name: pending.ds_name,
      type: "mcp",
      provider: pending.provider,
      config: { serverUrl: pending.server_url },
      created_by: pending.user_id,
    })
    .select("id")
    .single();
  if (dsError) return appRedirect(req, { error: dsError.message });

  await admin.from("datasource_secrets").insert({
    datasource_id: dsRow.id,
    secret: { authToken: tokenJson.access_token },
  });

  return appRedirect(req, { ds: dsRow.id, name: pending.ds_name });
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.pathname.endsWith("/callback"))
      return await handleCallback(req);
    if (req.method === "POST") return await handleStart(req);
    return json(req, { error: "Not found" }, 404);
  } catch (e) {
    return json(req, { error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
