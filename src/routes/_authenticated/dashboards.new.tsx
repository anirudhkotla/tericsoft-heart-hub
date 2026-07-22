import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  Paperclip,
  Send,
  Sparkles,
  Save,
  X,
  Loader2,
  Cable,
  ChevronDown,
  ChevronRight,
  Database,
  Table2,
  RefreshCw,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateDashboard } from "@/lib/dashboards.functions";
import type { DashboardConfig } from "@/lib/dashboards";
import { PageHeader } from "@/components/workspace/PageHeader";
import { DashboardView } from "@/components/workspace/DashboardView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useDatasources } from "@/lib/datasource-store";
import { getMcpProxyClient } from "@/lib/mcp-proxy-client";
import { listBases, listTablesForBase, fetchAllRecords, extractMcpData } from "@/lib/mcp-browse";
import type { Row } from "@/lib/mcp-browse";

export const Route = createFileRoute("/_authenticated/dashboards/new")({
  head: () => ({ meta: [{ title: "Create dashboard — Tericsoft HR OS" }] }),
  component: NewDashboard,
});

interface Attached {
  name: string;
  mimeType: string;
  base64: string;
}

interface AssistantMsg {
  role: "assistant";
  config: DashboardConfig;
}
interface UserMsg {
  role: "user";
  text: string;
  files: string[];
}
type Msg = UserMsg | AssistantMsg;

interface TableInfo {
  id: string;
  name: string;
  baseId: string;
  baseName: string;
  dsId: string;
  dsName: string;
}

interface BaseInfo {
  id: string;
  name: string;
  dsId: string;
  dsName: string;
  tables: TableInfo[];
  expanded: boolean;
  loading: boolean;
}

function readFile(file: File): Promise<Attached> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({
        name: file.name,
        mimeType: file.type || "text/plain",
        base64: result.split(",")[1] ?? "",
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function NewDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { datasources: connectedDatasources } = useDatasources();
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<Attached[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bases, setBases] = useState<BaseInfo[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [fetchingData, setFetchingData] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const latest = [...messages].reverse().find((m) => m.role === "assistant") as
    AssistantMsg | undefined;

  const pickDatasource = useCallback(async () => {
    if (connectedDatasources.length === 0) {
      toast.error("No datasources connected. Go to Integrations > Datasources first.");
      return;
    }
    setBrowsing(true);
    setBases([]);
    // Fan out to every connected datasource at once instead of awaiting them
    // one by one — with N datasources this is one round trip, not N.
    const perDatasource = await Promise.all(
      connectedDatasources.map(async (ds): Promise<BaseInfo[]> => {
        try {
          const client = getMcpProxyClient(ds.id);
          const rawBases = await listBases(client);
          if (rawBases.length === 0) {
            toast.error(`${ds.name}: no bases found`);
            return [];
          }
          return rawBases.map((b) => ({
            id: b.id,
            name: b.name,
            dsId: ds.id,
            dsName: ds.name,
            tables: [] as TableInfo[],
            expanded: b.expanded,
            loading: b.loading,
          }));
        } catch (e) {
          toast.error(`${ds.name}: ${e instanceof Error ? e.message : "Connection error"}`);
          return [];
        }
      }),
    );
    const newBases = perDatasource.flat();
    setBases(newBases);
    setBrowsing(false);
    if (newBases.length === 0) toast.info("No bases found in connected datasources");
  }, [connectedDatasources]);

  const toggleBase = async (baseId: string) => {
    const base = bases.find((b) => b.id === baseId);
    if (!base) return;
    if (base.tables.length > 0) {
      setBases((prev) => prev.map((b) => (b.id === baseId ? { ...b, expanded: !b.expanded } : b)));
      return;
    }
    setBases((prev) =>
      prev.map((b) => (b.id === baseId ? { ...b, loading: true, expanded: true } : b)),
    );
    try {
      const client = getMcpProxyClient(base.dsId);
      const rawTables = await listTablesForBase(client, baseId, base.name);
      const tableList: TableInfo[] = rawTables.map((t) => ({
        ...t,
        dsId: base.dsId,
        dsName: base.dsName,
      }));
      setBases((prev) =>
        prev.map((b) => (b.id === baseId ? { ...b, tables: tableList, loading: false } : b)),
      );
    } catch {
      setBases((prev) => prev.map((b) => (b.id === baseId ? { ...b, loading: false } : b)));
    }
  };

  const toggleTable = (tableKey: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) next.delete(tableKey);
      else next.add(tableKey);
      return next;
    });
  };

  const selectedTableList = bases
    .flatMap((b) => b.tables.map((t) => ({ ...t, baseId: b.id })))
    .filter((t) => selectedTables.has(`${t.baseId}:${t.id}`));

  const buildContext = async (): Promise<{
    context: string;
    externalTables: Record<string, Row[]>;
  }> => {
    const tables = selectedTableList;
    if (tables.length === 0) return { context: "", externalTables: {} };
    setFetchingData(true);
    try {
      // Schema + records for every selected table are independent of each other,
      // so fetch all tables concurrently rather than one at a time — this is the
      // dominant cost of dashboard generation once more than one table is picked.
      const perTable = await Promise.all(
        tables.map(async (t, i) => {
          const key = `T${i + 1}`;
          const ds = connectedDatasources.find((d) => d.id === t.dsId);
          if (!ds) return null;
          const client = getMcpProxyClient(ds.id);

          const [schemaResult, rows] = await Promise.all([
            client
              .callTool("get_table_schema", { baseId: t.baseId, tableIds: [t.id] })
              .catch(() => null),
            fetchAllRecords(client, t.baseId, t.id),
          ]);
          const schema = extractMcpData(schemaResult);

          const lines = [`${key}: ${ds.name} / ${t.baseName} / ${t.name}`];
          if (schema) lines.push(`  Schema: ${JSON.stringify(schema)}`);
          lines.push(
            `  Total records: ${rows.length} (real full dataset, already loaded — do not sample or estimate)`,
          );
          if (rows.length > 0) {
            lines.push(`  Example records (for field names only, not for computing values):`);
            for (const rec of rows.slice(0, 3)) lines.push(`    ${JSON.stringify(rec)}`);
          }
          return { key, lines, rows };
        }),
      );

      const lines: string[] = ["=== External tables ==="];
      const externalTables: Record<string, Row[]> = {};
      for (const entry of perTable) {
        if (!entry) continue;
        lines.push(...entry.lines);
        externalTables[entry.key] = entry.rows;
      }
      return { context: lines.join("\n"), externalTables };
    } finally {
      setFetchingData(false);
    }
  };

  const send = async () => {
    if (!prompt.trim()) return;
    const text = prompt.trim();
    const fileNames = files.map((f) => f.name);
    setMessages([{ role: "user", text, files: fileNames }]);
    setBusy(true);
    setPrompt("");
    try {
      const { context: datasourceContext, externalTables } = await buildContext();
      const config = await generateDashboard({
        prompt: text,
        files,
        datasourceContext: datasourceContext || undefined,
        externalTables: Object.keys(externalTables).length ? externalTables : undefined,
      });
      setMessages([
        { role: "user", text, files: fileNames },
        { role: "assistant", config },
      ]);
      setFiles([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
      setMessages([]);
      setPrompt(text);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!latest) return;
    setSaving(true);
    try {
      const { config } = latest;
      const { data, error } = await supabase
        .from("dashboards")
        .insert({
          name: config.title,
          description: config.description ?? null,
          config: { widgets: config.widgets } as never,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Dashboard saved");
      router.navigate({ to: "/dashboards/$dashboardId", params: { dashboardId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => router.navigate({ to: "/dashboards" })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Dashboards
      </Button>
      <PageHeader
        eyebrow="AI Builder"
        title="Create a dashboard"
        description="Pick tables from your connected datasources, then describe the dashboard you want."
      />

      <div className="space-y-4">
        {connectedDatasources.length > 0 && (
          <Card className="rounded-2xl p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cable className="h-4 w-4 text-primary" />
                Data sources
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={pickDatasource}
                disabled={browsing}
              >
                {browsing ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Database className="mr-1 h-3 w-3" />
                )}
                Browse tables
              </Button>
            </div>

            {bases.length > 0 && (
              <div className="space-y-1">
                {bases.map((base) => (
                  <div key={base.id}>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => toggleBase(base.id)}
                    >
                      {base.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : base.expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <Database className="h-3.5 w-3.5 text-brand" />
                      <span className="font-medium">{base.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {base.tables.length} table(s)
                      </span>
                    </button>
                    {base.expanded && base.tables.length > 0 && (
                      <div className="ml-5 space-y-0.5 border-l pl-3">
                        {base.tables.map((t) => {
                          const key = `${base.id}:${t.id}`;
                          const checked = selectedTables.has(key);
                          return (
                            <button
                              key={key}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-accent"
                              onClick={() => toggleTable(key)}
                            >
                              {checked ? (
                                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Square className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <Table2 className="h-3 w-3 text-muted-foreground" />
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedTableList.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
                <CheckSquare className="h-3 w-3 text-primary" />
                {selectedTableList.length} table(s) selected:
                {selectedTableList.map((t) => (
                  <Badge
                    key={`${t.baseId}:${t.id}`}
                    variant="secondary"
                    className="rounded-md text-[10px]"
                  >
                    {t.baseName}/{t.name}
                    <button className="ml-1" onClick={() => toggleTable(`${t.baseId}:${t.id}`)}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        )}

        {messages.length === 0 && (
          <Card className="rounded-2xl border-dashed p-6 text-sm text-muted-foreground shadow-soft">
            <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Try asking for:
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>"Recruitment funnel with candidates per stage and open roles by department"</li>
              <li>"Monthly expense breakdown by category, highlight pending approvals"</li>
              <li>"Attrition summary from the attached HR report"</li>
            </ul>
          </Card>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.text}
                {m.files.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.files.map((f) => (
                      <Badge key={f} variant="secondary" className="rounded-md text-[10px]">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> {m.config.title}
              </div>
              {m.config.description && (
                <p className="text-sm text-muted-foreground">{m.config.description}</p>
              )}
              <DashboardView config={m.config} />
              {latest === m && (
                <Button onClick={save} disabled={saving} className="rounded-xl">
                  {saving ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  Save dashboard
                </Button>
              )}
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Designing your dashboard
            {fetchingData ? " (fetching data from selected tables)" : "…"}
          </div>
        )}
      </div>

      <Card className="sticky bottom-4 mt-6 rounded-2xl p-3 shadow-lift">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <Badge key={i} variant="secondary" className="rounded-md">
                {f.name}
                <button
                  className="ml-1"
                  onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                  aria-label="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".csv,.txt,.json,.md,.pdf,image/*"
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInput.current?.click()}
            aria-label="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) send();
              }
            }}
            placeholder={latest ? "Ask for another dashboard…" : "Describe the dashboard you want…"}
            rows={1}
            className="max-h-32 min-h-[42px] resize-none rounded-xl"
          />
          <Button
            onClick={send}
            disabled={busy || !prompt.trim() || fetchingData}
            size="icon"
            className="shrink-0 rounded-xl"
            aria-label="Generate"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    Promise.all(Array.from(list).slice(0, 6).map(readFile))
      .then((read) => {
        setFiles((f) => [...f, ...read].slice(0, 6));
      })
      .catch(() => toast.error("Could not read one of the files."));
  }
}
