import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { ResolvedDatasource } from "../_shared/datasource.ts";
import { getCachedTools } from "../_shared/tool-cache.ts";
import type { GeminiFunctionDeclaration } from "./gemini.ts";

const NAMESPACE_SEP = "__";

// Gemini's function-calling schema only understands a subset of JSON Schema —
// strip keywords it rejects (e.g. $schema, additionalProperties) rather than
// having the whole tools/list call fail because one MCP server's schema is
// too rich.
const ALLOWED_KEYS = new Set([
  "type",
  "description",
  "properties",
  "items",
  "required",
  "enum",
  "format",
  "nullable",
]);

function sanitizeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
      if (!ALLOWED_KEYS.has(k)) continue;
      out[k] =
        k === "properties" && v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [
                pk,
                sanitizeSchema(pv),
              ]),
            )
          : sanitizeSchema(v);
    }
    if (!out.type) out.type = "object";
    return out;
  }
  return schema;
}

export function namespacedName(datasourceId: string, toolName: string): string {
  // Gemini function names must match ^[a-zA-Z0-9_.-]{1,64}$ — datasource ids
  // are uuids (safe characters already), so a plain join is fine.
  return `ds_${datasourceId.replace(/-/g, "")}${NAMESPACE_SEP}${toolName}`.slice(0, 64);
}

export interface ToolDispatchEntry {
  datasourceId: string;
  toolName: string;
}

export async function buildToolDeclarations(
  admin: SupabaseClient,
  datasources: ResolvedDatasource[],
): Promise<{
  declarations: GeminiFunctionDeclaration[];
  dispatch: Map<string, ToolDispatchEntry>;
}> {
  const declarations: GeminiFunctionDeclaration[] = [];
  const dispatch = new Map<string, ToolDispatchEntry>();

  for (const ds of datasources) {
    const tools = await getCachedTools(admin, ds.id, ds.client).catch(() => []);
    for (const tool of tools) {
      const fullName = namespacedName(ds.id, tool.name);
      declarations.push({
        name: fullName,
        description: `[${ds.name}] ${tool.description ?? tool.name}`,
        parameters: sanitizeSchema(
          tool.inputSchema ?? { type: "object", properties: {} },
        ) as Record<string, unknown>,
      });
      dispatch.set(fullName, { datasourceId: ds.id, toolName: tool.name });
    }
  }

  return { declarations, dispatch };
}
