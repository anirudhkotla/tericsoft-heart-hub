// Roam Research has no public hosted MCP+OAuth server (its official MCP talks
// to a local HTTP server the desktop app exposes on the user's own machine,
// unreachable from a hosted function). This wraps Roam's actual reachable
// surface — the per-graph REST API — behind the same {listTools, callTool}
// shape McpClient exposes, so mcp-proxy/agent-chat can treat a Roam
// datasource identically to a real MCP server.
//
// API: https://api.roamresearch.com/api/graph/{graph}/{q|pull|write}
// Auth header confirmed live: `X-Authorization: Bearer <token>`.
import type { McpResult, McpTool } from "./mcp-client.ts";

export const ROAM_TOOLS: McpTool[] = [
  {
    name: "roam_query_datalog",
    description: "Run a Datalog query against the graph. Args: { query: string, args?: unknown[] }",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, args: { type: "array" } },
      required: ["query"],
    },
  },
  {
    name: "roam_pull_block",
    description: "Pull a block/page by entity id or uid. Args: { eid: string, selector?: string }",
    inputSchema: {
      type: "object",
      properties: { eid: { type: "string" }, selector: { type: "string" } },
      required: ["eid"],
    },
  },
  {
    name: "roam_search_blocks",
    description: "Full-text search block contents. Args: { text: string, limit?: number }",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, limit: { type: "number" } },
      required: ["text"],
    },
  },
  {
    name: "roam_create_block",
    description:
      "Create a new block under a parent (page or block) uid. Args: { parentUid: string, text: string, order?: number }",
    inputSchema: {
      type: "object",
      properties: {
        parentUid: { type: "string" },
        text: { type: "string" },
        order: { type: "number" },
      },
      required: ["parentUid", "text"],
    },
  },
];

export class RoamAdapter {
  constructor(
    private graphName: string,
    private apiToken: string,
  ) {}

  private get base(): string {
    return `https://api.roamresearch.com/api/graph/${encodeURIComponent(this.graphName)}`;
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${this.apiToken}`,
    };
  }

  listTools(): Promise<McpTool[]> {
    return Promise.resolve(ROAM_TOOLS);
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Roam API error [${res.status}]: ${text.slice(0, 500)}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    return contentType.includes("application/json") ? res.json() : res.text();
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpResult> {
    try {
      switch (name) {
        case "roam_query_datalog": {
          const result = await this.post("/q", { query: args.query, args: args.args ?? [] });
          return { ok: true, content: result };
        }
        case "roam_pull_block": {
          const result = await this.post("/pull", {
            eid: args.eid,
            selector: args.selector ?? "[*]",
          });
          return { ok: true, content: result };
        }
        case "roam_search_blocks": {
          const text = String(args.text ?? "");
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const query = `[:find (pull ?b [:block/uid :block/string]) :in $ ?needle :where [?b :block/string ?s] [(clojure.string/includes? ?s ?needle)]]`;
          const result = await this.post("/q", { query, args: [text] });
          const rows = Array.isArray(result) ? result.slice(0, limit) : result;
          return { ok: true, content: rows };
        }
        case "roam_create_block": {
          const result = await this.post("/write", {
            action: "create-block",
            location: { "parent-uid": args.parentUid, order: args.order ?? "last" },
            block: { string: args.text },
          });
          return { ok: true, content: result };
        }
        default:
          return { ok: false, error: `Unknown Roam tool: ${name}` };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  discoverSchema(): Promise<string> {
    return Promise.resolve(ROAM_TOOLS.map((t) => `  - ${t.name}: ${t.description}`).join("\n"));
  }
}
