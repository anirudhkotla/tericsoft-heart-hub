/// Lightweight MCP (Model Context Protocol) client over JSON-RPC 2.0 + HTTP.

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
  | { ok: true; content: unknown; meta?: Record<string, unknown> }
  | { ok: false; error: string };

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const MCP_PROTOCOL_VERSION = "2025-11-25";

export class McpClient {
  private reqId = 1;
  private sessionId: string | null = null;
  private protocolVersion: string = MCP_PROTOCOL_VERSION;

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
    private proxyUrl?: string,
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

    if (this.proxyUrl) {
      const proxyBody = JSON.stringify({
        url: this.url,
        headers: this.reqHeaders,
        method,
        params,
      });
      const res = await fetch(this.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: proxyBody,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`MCP proxy error [${res.status}]: ${text.slice(0, 500)}`);
      }

      const sid = res.headers.get("X-Mcp-Session-Id");
      if (sid) this.sessionId = sid;

      const json = (await res.json()) as JsonRpcResponse;
      if (json.error) {
        const code = json.error.code ?? -1;
        const msg = json.error.message ?? JSON.stringify(json.error);
        throw new Error(`MCP error [${code}]: ${msg}`);
      }
      return json.result;
    }

    const res = await fetch(this.url, { method: "POST", headers: this.reqHeaders, body });
    const sid = res.headers.get("Mcp-Session-Id");
    if (sid) this.sessionId = sid;
    const json = (await res.json()) as JsonRpcResponse;
    if (json.error) {
      const code = json.error.code ?? -1;
      const msg = json.error.message ?? JSON.stringify(json.error);
      throw new Error(`MCP error [${code}]: ${msg}`);
    }
    return json.result;
  }

  private initialized = false;

  private isInitialize(method: string): boolean {
    // modern MCP uses per-request metadata; try initialize first
    return method === "initialize";
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const result = (await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
        resources: {},
        sampling: {},
      },
      clientInfo: { name: "tericsoft-hr-os", version: "1.0.0" },
    })) as {
      protocolVersion?: string;
      serverCapabilities?: Record<string, unknown>;
    };

    if (result?.protocolVersion) {
      this.protocolVersion = result.protocolVersion;
    }

    // per spec, send initialized notification
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
    const result = (await this.request("resources/read", { uri })) as { contents?: McpResourceContent[] };
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
        for (const t of tools) {
          lines.push(`  - ${t.name}${t.description ? `: ${t.description}` : ""}`);
        }
      }
    } catch { /* server may not support tools */ }

    try {
      const resources = await this.listResources();
      if (resources.length) {
        lines.push("Available MCP resources:");
        for (const r of resources) {
          lines.push(`  - ${r.uri}${r.name ? ` (${r.name})` : ""}${r.description ? `: ${r.description}` : ""}`);
        }
      }
    } catch { /* server may not support resources */ }

    return lines.join("\n");
  }

  async queryTable(tableName: string, limit = 100): Promise<Record<string, unknown>[]> {
    const tools = await this.listTools().catch(() => []);
    const readTool = tools.find((t) =>
      /query|read|fetch|list|select|get/i.test(t.name) &&
      t.name.toLowerCase().includes(tableName.toLowerCase())
    );
    if (readTool) {
      const result = await this.callTool(readTool.name, { limit });
      if (result.ok && Array.isArray(result.content)) {
        const rows = result.content as Record<string, unknown>[];
        return rows;
      }
    }

    const resources = await this.listResources().catch(() => []);
    const tableResource = resources.find((r) =>
      r.uri.toLowerCase().includes(tableName.toLowerCase())
    );
    if (tableResource) {
      const contents = await this.readResource(tableResource.uri);
      for (const c of contents) {
        if (c.text) {
          try {
            const parsed = JSON.parse(c.text);
            if (Array.isArray(parsed)) return parsed;
          } catch { /* not JSON */ }
        }
      }
    }

    return [];
  }
}
