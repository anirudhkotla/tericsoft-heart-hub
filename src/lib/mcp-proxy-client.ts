// Client-side stand-in for McpClient that never touches the MCP server (or its
// secrets) directly. Every call goes through the `mcp-proxy` Supabase Edge
// Function, which resolves the datasource's server URL + auth token
// server-side (datasource_secrets is not readable by the browser) and makes
// the actual MCP request from Deno — sidestepping both the CORS gap that
// broke this in production and the plaintext-secret exposure it used to have.
import { supabase } from "@/integrations/supabase/client";
import type { McpResource, McpResourceContent, McpResult, McpTool } from "@/lib/mcp";
import { functionErrorMessage } from "@/lib/edge-function-error";

type ProxyAction =
  "list_tools" | "call_tool" | "list_resources" | "read_resource" | "discover_schema";

async function invoke<T>(
  datasourceId: string,
  action: ProxyAction,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("mcp-proxy", {
    body: { datasourceId, action, params: params ?? {} },
  });
  if (error) throw new Error(await functionErrorMessage(error, "mcp-proxy request failed"));
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export class McpProxyClient {
  constructor(private datasourceId: string) {}

  async listTools(): Promise<McpTool[]> {
    const { tools } = await invoke<{ tools: McpTool[] }>(this.datasourceId, "list_tools");
    return tools;
  }

  async listResources(): Promise<McpResource[]> {
    const { resources } = await invoke<{ resources: McpResource[] }>(
      this.datasourceId,
      "list_resources",
    );
    return resources;
  }

  async readResource(uri: string): Promise<McpResourceContent[]> {
    const { contents } = await invoke<{ contents: McpResourceContent[] }>(
      this.datasourceId,
      "read_resource",
      { uri },
    );
    return contents;
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<McpResult> {
    return invoke<McpResult>(this.datasourceId, "call_tool", { name, arguments: args ?? {} });
  }

  async discoverSchema(): Promise<string> {
    const { schema } = await invoke<{ schema: string }>(this.datasourceId, "discover_schema");
    return schema;
  }
}

const clientCache = new Map<string, McpProxyClient>();

export function getMcpProxyClient(datasourceId: string): McpProxyClient {
  let client = clientCache.get(datasourceId);
  if (!client) {
    client = new McpProxyClient(datasourceId);
    clientCache.set(datasourceId, client);
  }
  return client;
}

export function evictMcpProxyClient(datasourceId: string): void {
  clientCache.delete(datasourceId);
}

export async function clearToolCache(datasourceId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("mcp-proxy", {
    body: { datasourceId, action: "clear_cache" },
  });
  if (error) throw new Error(await functionErrorMessage(error, "Failed to clear cache"));
  evictMcpProxyClient(datasourceId);
}
