// Server-side port of src/lib/mcp.ts's McpClient. Runs inside a Deno edge
// function, so it always talks to the MCP server directly (no CORS concern,
// no need for the dev-only proxyUrl param the browser version needed).

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export type McpResult =
  { ok: true; content: unknown; meta?: Record<string, unknown> } | { ok: false; error: string };

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const MCP_PROTOCOL_VERSION = "2025-11-25";

// The MCP Streamable HTTP transport allows a server to answer a POST with
// text/event-stream instead of plain JSON (Airtable's MCP server does this)
// — each SSE event frames one JSON-RPC message as one or more `data:` lines.
// Find the event whose id matches this request (skipping any notifications
// the server interleaves ahead of the actual response).
function parseSseJsonRpc(raw: string, expectedId: number): JsonRpcResponse {
  const events = raw.split(/\r?\n\r?\n/);
  let lastParsed: JsonRpcResponse | undefined;
  for (const evt of events) {
    const dataLines = evt
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) continue;
    try {
      const parsed = JSON.parse(dataLines.join("\n")) as JsonRpcResponse;
      if (parsed.id === expectedId) return parsed;
      lastParsed = parsed;
    } catch {
      /* not a JSON-RPC event (e.g. a bare progress ping) — skip it */
    }
  }
  if (lastParsed) return lastParsed;
  throw new Error(`Could not parse SSE response from MCP server: ${raw.slice(0, 200)}`);
}

export class McpClient {
  private reqId = 1;
  private sessionId: string | null = null;
  private protocolVersion: string = MCP_PROTOCOL_VERSION;
  private initialized = false;

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
  ) {
    this.headers["Content-Type"] ??= "application/json";
    this.headers["Accept"] ??= "application/json, text/event-stream";
  }

  private get reqHeaders(): Record<string, string> {
    return {
      ...this.headers,
      "MCP-Protocol-Version": this.protocolVersion,
      ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
    };
  }

  private async request(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.reqId;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const res = await fetch(this.url, { method: "POST", headers: this.reqHeaders, body });
    const sid = res.headers.get("Mcp-Session-Id");
    if (sid) this.sessionId = sid;

    const contentType = res.headers.get("content-type") ?? "";
    const raw = await res.text();
    const json = contentType.includes("text/event-stream")
      ? parseSseJsonRpc(raw, id)
      : (JSON.parse(raw) as JsonRpcResponse);

    if (json.error) {
      const code = json.error.code ?? -1;
      const msg = json.error.message ?? JSON.stringify(json.error);
      throw new Error(`MCP error [${code}]: ${msg}`);
    }
    return json.result;
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const result = (await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {}, resources: {}, sampling: {} },
      clientInfo: { name: "tericsoft-hr-os", version: "1.0.0" },
    })) as { protocolVersion?: string };
    if (result?.protocolVersion) this.protocolVersion = result.protocolVersion;
    await this.request("notifications/initialized").catch(() => {});
    this.initialized = true;
  }

  async listTools(): Promise<McpTool[]> {
    await this.ensureInitialized();
    const result = (await this.request("tools/list")) as { tools?: McpTool[] };
    return result?.tools ?? [];
  }

  async listResources(): Promise<McpResource[]> {
    await this.ensureInitialized();
    const result = (await this.request("resources/list")) as { resources?: McpResource[] };
    return result?.resources ?? [];
  }

  async readResource(uri: string): Promise<McpResourceContent[]> {
    await this.ensureInitialized();
    const result = (await this.request("resources/read", { uri })) as {
      contents?: McpResourceContent[];
    };
    return result?.contents ?? [];
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<McpResult> {
    await this.ensureInitialized();
    try {
      const result = (await this.request("tools/call", { name, arguments: args ?? {} })) as {
        content?: unknown[];
        isError?: boolean;
      };
      if (result?.isError) {
        return { ok: false, error: JSON.stringify(result.content ?? "Tool returned error") };
      }
      return { ok: true, content: result?.content ?? null };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async discoverSchema(): Promise<string> {
    const lines: string[] = [];
    try {
      const tools = await this.listTools();
      if (tools.length) {
        lines.push("Available MCP tools:");
        for (const t of tools)
          lines.push(`  - ${t.name}${t.description ? `: ${t.description}` : ""}`);
      }
    } catch {
      /* server may not support tools */
    }
    try {
      const resources = await this.listResources();
      if (resources.length) {
        lines.push("Available MCP resources:");
        for (const r of resources) {
          lines.push(
            `  - ${r.uri}${r.name ? ` (${r.name})` : ""}${r.description ? `: ${r.description}` : ""}`,
          );
        }
      }
    } catch {
      /* server may not support resources */
    }
    return lines.join("\n");
  }
}
