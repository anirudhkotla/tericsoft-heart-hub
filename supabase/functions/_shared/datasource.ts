import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { McpClient } from "./mcp-client.ts";
import { RoamAdapter } from "./roam-adapter.ts";

export interface ToolClient {
  listTools(): Promise<import("./mcp-client.ts").McpTool[]>;
  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<import("./mcp-client.ts").McpResult>;
  discoverSchema(): Promise<string>;
  listResources?(): Promise<import("./mcp-client.ts").McpResource[]>;
  readResource?(uri: string): Promise<import("./mcp-client.ts").McpResourceContent[]>;
}

export function serviceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function callerClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

export interface ResolvedDatasource {
  id: string;
  name: string;
  type: "mcp" | "rest";
  provider: string;
  ownerId: string;
  client: ToolClient;
}

interface StoredSecret {
  authToken?: string;
  headers?: Record<string, string>;
  apiToken?: string;
  refreshToken?: string | null;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string | null;
}

function isAuthError(message: string): boolean {
  return /unauthor|invalid_token|invalid_grant|expired/i.test(message);
}

// OAuth access tokens (Airtable's included) are typically short-lived. Rather
// than tracking expiry, refresh lazily: try the call, and if the server
// rejects it as an auth failure, use the stored refresh_token to get a new
// access token, persist it, and retry once.
async function refreshOAuthToken(
  admin: SupabaseClient,
  datasourceId: string,
  secret: StoredSecret,
): Promise<string | null> {
  if (!secret.refreshToken || !secret.tokenEndpoint || !secret.clientId) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: secret.refreshToken,
    client_id: secret.clientId,
  });
  if (secret.clientSecret) body.set("client_secret", secret.clientSecret);

  const res = await fetch(secret.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.access_token) return null;

  const nextSecret: StoredSecret = {
    ...secret,
    authToken: json.access_token,
    refreshToken: json.refresh_token ?? secret.refreshToken,
  };
  await admin
    .from("datasource_secrets")
    .update({ secret: nextSecret })
    .eq("datasource_id", datasourceId);
  return json.access_token as string;
}

// Wraps an MCP-backed ToolClient so a token expiry mid-call silently
// refreshes and retries once, instead of surfacing "UNAUTHORIZED" to the
// user for something the server can fix on its own.
function withAutoRefresh(
  client: ToolClient,
  admin: SupabaseClient,
  datasourceId: string,
  config: { serverUrl?: string },
  secret: StoredSecret,
): ToolClient {
  if (!secret.refreshToken) return client;

  const rebuild = async (): Promise<ToolClient | null> => {
    const newToken = await refreshOAuthToken(admin, datasourceId, secret);
    if (!newToken) return null;
    secret.authToken = newToken;
    const headers: Record<string, string> = { ...(secret.headers ?? {}), Authorization: `Bearer ${newToken}` };
    return new McpClient(config.serverUrl!, headers);
  };

  return {
    async listTools() {
      try {
        return await client.listTools();
      } catch (e) {
        if (!isAuthError(e instanceof Error ? e.message : String(e))) throw e;
        const fresh = await rebuild();
        if (!fresh) throw e;
        return fresh.listTools();
      }
    },
    async callTool(name, args) {
      const result = await client.callTool(name, args);
      if (result.ok || !isAuthError(result.error)) return result;
      const fresh = await rebuild();
      if (!fresh) return result;
      return fresh.callTool(name, args);
    },
    async discoverSchema() {
      try {
        return await client.discoverSchema();
      } catch (e) {
        if (!isAuthError(e instanceof Error ? e.message : String(e))) throw e;
        const fresh = await rebuild();
        if (!fresh) throw e;
        return fresh.discoverSchema();
      }
    },
    listResources: client.listResources?.bind(client),
    readResource: client.readResource?.bind(client),
  };
}

// Verifies the caller owns the datasource, then resolves its secret with the
// service-role key (datasource_secrets has no client SELECT policy at all)
// and builds the right tool client for it.
export async function loadDatasourceForCaller(
  req: Request,
  datasourceId: string,
): Promise<ResolvedDatasource> {
  const caller = callerClient(req);
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = serviceRoleClient();
  const { data: ds, error: dsError } = await admin
    .from("datasources")
    .select("*")
    .eq("id", datasourceId)
    .maybeSingle();
  if (dsError) throw new Error(dsError.message);
  if (!ds) throw new Error("Datasource not found");
  if (ds.created_by !== user.id) throw new Error("Not authorized for this datasource");

  const { data: secretRow } = await admin
    .from("datasource_secrets")
    .select("secret")
    .eq("datasource_id", datasourceId)
    .maybeSingle();
  const secret = (secretRow?.secret ?? {}) as StoredSecret;
  const config = ds.config as { serverUrl?: string; graphName?: string };

  let client = buildToolClient(ds.type, ds.provider, config, secret);
  if (secret.refreshToken) {
    client = withAutoRefresh(client, admin, datasourceId, config, secret);
  }

  return {
    id: ds.id,
    name: ds.name,
    type: ds.type,
    provider: ds.provider,
    ownerId: ds.created_by,
    client,
  };
}

export function buildToolClient(
  type: "mcp" | "rest",
  provider: string,
  config: { serverUrl?: string; graphName?: string },
  secret: StoredSecret,
): ToolClient {
  if (provider === "roam" || type === "rest") {
    if (!config.graphName || !secret.apiToken) {
      throw new Error("Roam datasource is missing graphName or apiToken");
    }
    return new RoamAdapter(config.graphName, secret.apiToken);
  }
  if (!config.serverUrl) throw new Error("MCP datasource is missing serverUrl");
  const headers: Record<string, string> = { ...(secret.headers ?? {}) };
  if (secret.authToken) headers["Authorization"] = `Bearer ${secret.authToken}`;
  return new McpClient(config.serverUrl, headers);
}
