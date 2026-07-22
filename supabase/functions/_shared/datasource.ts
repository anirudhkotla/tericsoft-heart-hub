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
  const secret = (secretRow?.secret ?? {}) as {
    authToken?: string;
    headers?: Record<string, string>;
    apiToken?: string;
  };

  const client = buildToolClient(
    ds.type,
    ds.provider,
    ds.config as { serverUrl?: string; graphName?: string },
    secret,
  );

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
  secret: { authToken?: string; headers?: Record<string, string>; apiToken?: string },
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
