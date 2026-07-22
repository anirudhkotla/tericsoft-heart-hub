import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { McpTool } from "./mcp-client.ts";
import type { ToolClient } from "./datasource.ts";

const TOOL_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getCachedTools(
  admin: SupabaseClient,
  datasourceId: string,
  client: ToolClient,
): Promise<McpTool[]> {
  const { data: cached } = await admin
    .from("datasource_tool_cache")
    .select("tools, cached_at")
    .eq("datasource_id", datasourceId)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.cached_at).getTime() < TOOL_CACHE_TTL_MS) {
    return cached.tools as McpTool[];
  }
  const tools = await client.listTools();
  await admin
    .from("datasource_tool_cache")
    .upsert(
      { datasource_id: datasourceId, tools, cached_at: new Date().toISOString() },
      { onConflict: "datasource_id" },
    );
  return tools;
}
