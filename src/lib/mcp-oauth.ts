// Thin client for the oauth-connect edge function, which does the actual
// OAuth 2.1 + PKCE + Dynamic Client Registration dance server-to-server.
// Moving this off the browser fixes two real bugs the old client-side flow
// had: an RFC 8414 well-known URL bug, and the fact that Airtable's
// /register and /token endpoints send no CORS headers at all (a browser can
// never complete that exchange directly, bug-fixed or not).
import { supabase } from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/lib/edge-function-error";

export interface McpProvider {
  id: string;
  name: string;
  serverUrl: string;
}

// Prefilled quick-connect tiles for providers with a real hosted MCP+OAuth
// server. Roam Research has no such server (see datasources/new.tsx for its
// token-based connect form instead) — any other MCP server can still be
// connected via the "Custom server" form using this same OAuth flow.
export const KNOWN_PROVIDERS: McpProvider[] = [
  { id: "airtable", name: "Airtable", serverUrl: "https://mcp.airtable.com/mcp" },
  { id: "notion", name: "Notion", serverUrl: "https://mcp.notion.com/mcp" },
];

export async function startOAuthConnect(
  provider: string,
  dsName: string,
  serverUrl: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("oauth-connect", {
    body: { provider, dsName, serverUrl },
  });
  if (error) throw new Error(await functionErrorMessage(error, "Could not start OAuth connect"));
  if (data?.error) throw new Error(data.error);
  if (!data?.authorizationUrl) throw new Error("No authorization URL returned");
  window.location.href = data.authorizationUrl;
}
