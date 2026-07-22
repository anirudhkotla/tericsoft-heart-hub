import { supabase } from "@/integrations/supabase/client";

export type DatasourceProvider = "airtable" | "notion" | "roam" | "custom";

export interface Datasource {
  id: string;
  name: string;
  type: "mcp" | "rest";
  provider: DatasourceProvider;
  config: DatasourceConfig;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Non-secret connection info — safe to read back from the client.
export interface DatasourceConfig {
  serverUrl?: string; // mcp datasources (airtable/notion/custom)
  graphName?: string; // roam
}

// Write-only: stored in datasource_secrets, never selectable by the client.
export interface DatasourceSecret {
  authToken?: string;
  headers?: Record<string, string>;
  apiToken?: string; // roam
}

export interface DatasourceSchema {
  id: string;
  name: string;
  type: string;
  tools: string;
  resources: string;
  schemas: { table: string; fields: string }[];
}

export async function fetchDatasources(): Promise<Datasource[]> {
  const { data, error } = await supabase
    .from("datasources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  return data as unknown as Datasource[];
}

export async function fetchDatasource(id: string): Promise<Datasource | null> {
  const { data, error } = await supabase.from("datasources").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  return data as unknown as Datasource | null;
}

export async function createDatasource(
  name: string,
  type: "mcp" | "rest",
  provider: DatasourceProvider,
  config: DatasourceConfig,
  secret?: DatasourceSecret,
): Promise<Datasource> {
  const { data, error } = await supabase
    .from("datasources")
    .insert({ name, type, provider, config: config as never })
    .select("*")
    .single();
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  const ds = data as unknown as Datasource;

  if (secret && Object.keys(secret).length > 0) {
    const { error: secretError } = await supabase
      .from("datasource_secrets")
      .insert({ datasource_id: ds.id, secret: secret as never });
    if (secretError) {
      await supabase.from("datasources").delete().eq("id", ds.id);
      throw new Error(secretError.message ?? JSON.stringify(secretError));
    }
  }

  return ds;
}

export async function updateDatasource(
  id: string,
  name: string,
  config: DatasourceConfig,
  secret?: DatasourceSecret,
): Promise<void> {
  const { error } = await supabase
    .from("datasources")
    .update({ name, config: config as never })
    .eq("id", id);
  if (error) throw new Error(error.message ?? JSON.stringify(error));

  if (secret && Object.keys(secret).length > 0) {
    const { error: secretError } = await supabase
      .from("datasource_secrets")
      .upsert({ datasource_id: id, secret: secret as never }, { onConflict: "datasource_id" });
    if (secretError) throw new Error(secretError.message ?? JSON.stringify(secretError));
  }
}

export async function deleteDatasource(id: string): Promise<void> {
  const { error } = await supabase.from("datasources").delete().eq("id", id);
  if (error) throw new Error(error.message ?? JSON.stringify(error));
}

export function buildDatasourceContext(schemas: DatasourceSchema[]): string {
  if (!schemas.length) return "";
  const lines: string[] = ["=== External Datasources ==="];
  for (const s of schemas) {
    lines.push(`Datasource: ${s.name} (${s.type})`);
    lines.push(`  Tables:`);
    for (const t of s.schemas) {
      lines.push(`    - ${t.table} {${t.fields}}`);
    }
  }
  return lines.join("\n");
}
