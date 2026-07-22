// Shared helpers for browsing an MCP-backed datasource's data (bases/tables/records).
// Extracted from the dashboard AI builder so the datasource detail page's "Browse
// data" view can reuse the exact same Airtable-shaped-tool parsing.
import type { McpResult } from "@/lib/mcp";

export type Row = Record<string, unknown>;

export interface McpToolCaller {
  callTool(name: string, args?: Record<string, unknown>): Promise<McpResult>;
}

export interface TableInfo {
  id: string;
  name: string;
  baseId: string;
  baseName: string;
}

export interface BaseInfo {
  id: string;
  name: string;
  tables: TableInfo[];
  expanded: boolean;
  loading: boolean;
}

export function extractMcpData(result: { ok: boolean; content?: unknown } | null): unknown {
  if (!result?.ok) return null;
  if (!Array.isArray(result.content)) return result.content;
  const texts = result.content
    .filter(
      (c: unknown): c is { type?: string; text?: string } =>
        typeof c === "object" && c !== null && "text" in (c as Record<string, unknown>),
    )
    .map((c) => c.text)
    .filter(Boolean);
  if (texts.length === 0) return result.content;
  const joined = texts.join("");
  try {
    return JSON.parse(joined);
  } catch {
    return joined;
  }
}

// MCP tools may return a bare array or wrap it under a named key (e.g. { tables: [...] }, { records: [...], nextCursor }).
export function unwrapArray<T = unknown>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    for (const k of keys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

// Airtable returns singleSelect/multipleSelects field values as {id,name,color} objects
// (or arrays of them) rather than plain strings — unwrap to name(s) so downstream
// comparisons work on real strings, not "[object Object]".
export function flattenValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(flattenValue).join(", ");
  if (v && typeof v === "object" && "name" in v) return (v as { name?: unknown }).name ?? v;
  return v;
}

export function flattenRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k] = flattenValue(v);
  return out;
}

export async function listBases(client: McpToolCaller): Promise<BaseInfo[]> {
  const result = await client.callTool("list_bases");
  if (!result.ok) throw new Error(result.error);
  const rawBases = unwrapArray<{ id?: string; name?: string }>(extractMcpData(result), [
    "bases",
    "records",
    "items",
  ]);
  return rawBases.map((b) => ({
    id: b.id ?? b.name ?? "Unknown",
    name: b.name ?? b.id ?? "Unknown",
    tables: [],
    expanded: true,
    loading: false,
  }));
}

export async function listTablesForBase(
  client: McpToolCaller,
  baseId: string,
  baseName: string,
): Promise<TableInfo[]> {
  const result = await client.callTool("list_tables_for_base", { baseId }).catch(() => null);
  const rawTables = unwrapArray<{ id?: string; name?: string }>(extractMcpData(result), ["tables"]);
  return rawTables.map((t) => ({
    id: t.id ?? t.name ?? "Unknown",
    name: t.name ?? t.id ?? "Unknown",
    baseId,
    baseName,
  }));
}

export interface RecordPage {
  rows: Row[];
  nextCursor?: string;
}

export async function fetchRecordPage(
  client: McpToolCaller,
  baseId: string,
  tableId: string,
  cursor?: string,
  pageSize = 100,
): Promise<RecordPage> {
  const result = await client
    .callTool("list_records_for_table", {
      baseId,
      tableId,
      pageSize,
      ...(cursor ? { cursor } : {}),
    })
    .catch(() => null);
  const parsed = extractMcpData(result) as { nextCursor?: string } | unknown;
  const records = unwrapArray<{ fields?: Row }>(parsed, ["records"]);
  const rows = records.map((rec) => flattenRow(rec.fields ?? (rec as unknown as Row)));
  const nextCursor =
    parsed && typeof parsed === "object"
      ? (parsed as { nextCursor?: string }).nextCursor
      : undefined;
  return { rows, nextCursor };
}

const MAX_PAGES = 10;

export async function fetchAllRecords(
  client: McpToolCaller,
  baseId: string,
  tableId: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchRecordPage(client, baseId, tableId, cursor, 1000);
    rows.push(...result.rows);
    if (!result.nextCursor || result.rows.length === 0) break;
    cursor = result.nextCursor;
  }
  return rows;
}
