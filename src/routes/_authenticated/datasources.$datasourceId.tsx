import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { fetchDatasource, updateDatasource, deleteDatasource } from "@/lib/datasources";
import { DATASOURCES_QUERY_KEY } from "@/lib/datasource-store";
import { getMcpProxyClient, evictMcpProxyClient } from "@/lib/mcp-proxy-client";
import { listBases, listTablesForBase, fetchRecordPage } from "@/lib/mcp-browse";
import type { BaseInfo, Row } from "@/lib/mcp-browse";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/datasources/$datasourceId")({
  head: () => ({ meta: [{ title: "Datasource — Tericsoft HR OS" }] }),
  component: DatasourceDetail,
});

function RecordsTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="p-3 text-xs text-muted-foreground">No records.</p>;
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).slice(0, 8);
  return (
    <div className="overflow-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-2 py-1.5 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {columns.map((c) => (
                <td key={c} className="max-w-[160px] truncate px-2 py-1.5">
                  {String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatasourceDetail() {
  const { datasourceId } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: ds, isLoading } = useQuery({
    queryKey: ["datasources", datasourceId],
    queryFn: () => fetchDatasource(datasourceId),
  });

  const [editName, setEditName] = useState("");
  const [editServerUrl, setEditServerUrl] = useState("");
  const [editGraphName, setEditGraphName] = useState("");
  const [editSecret, setEditSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const [schema, setSchema] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);

  const [bases, setBases] = useState<BaseInfo[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [openTableKey, setOpenTableKey] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loadingRows, setLoadingRows] = useState(false);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!ds) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        Datasource not found.{" "}
        <Link to="/datasources" className="text-primary hover:underline">
          Back to datasources
        </Link>
      </div>
    );
  }

  const isRoam = ds.provider === "roam";
  const nameValue = editName || ds.name;
  const serverUrlValue = editServerUrl || ds.config.serverUrl || "";
  const graphNameValue = editGraphName || ds.config.graphName || "";

  const discover = async () => {
    setDiscovering(true);
    try {
      const client = getMcpProxyClient(ds.id);
      const s = await client.discoverSchema();
      setSchema(s);
      toast.success("Schema discovered");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const config = isRoam
        ? { graphName: graphNameValue.trim() }
        : { serverUrl: serverUrlValue.trim() };
      const secret = editSecret.trim()
        ? isRoam
          ? { apiToken: editSecret.trim() }
          : { authToken: editSecret.trim() }
        : undefined;
      await updateDatasource(ds.id, nameValue.trim(), config, secret);
      evictMcpProxyClient(ds.id);
      await queryClient.invalidateQueries({ queryKey: ["datasources", datasourceId] });
      await queryClient.invalidateQueries({ queryKey: DATASOURCES_QUERY_KEY });
      setEditSecret("");
      toast.success("Datasource updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    try {
      evictMcpProxyClient(ds.id);
      await deleteDatasource(ds.id);
      await queryClient.invalidateQueries({ queryKey: DATASOURCES_QUERY_KEY });
      toast.success("Datasource removed");
      router.navigate({ to: "/datasources" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  };

  const browseData = async () => {
    setBrowsing(true);
    setBases([]);
    try {
      const client = getMcpProxyClient(ds.id);
      const newBases = await listBases(client);
      setBases(newBases);
      if (newBases.length === 0) toast.info("No bases/tables found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not browse data");
    } finally {
      setBrowsing(false);
    }
  };

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
      const client = getMcpProxyClient(ds.id);
      const tables = await listTablesForBase(client, baseId, base.name);
      setBases((prev) => prev.map((b) => (b.id === baseId ? { ...b, tables, loading: false } : b)));
    } catch {
      setBases((prev) => prev.map((b) => (b.id === baseId ? { ...b, loading: false } : b)));
    }
  };

  const openTable = async (baseId: string, tableId: string) => {
    const key = `${baseId}:${tableId}`;
    setOpenTableKey(key);
    setRows([]);
    setCursor(undefined);
    setLoadingRows(true);
    try {
      const client = getMcpProxyClient(ds.id);
      const page = await fetchRecordPage(client, baseId, tableId, undefined, 50);
      setRows(page.rows);
      setCursor(page.nextCursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load records");
    } finally {
      setLoadingRows(false);
    }
  };

  const loadMore = async () => {
    if (!openTableKey || !cursor) return;
    const [baseId, tableId] = openTableKey.split(":");
    setLoadingRows(true);
    try {
      const client = getMcpProxyClient(ds.id);
      const page = await fetchRecordPage(client, baseId, tableId, cursor, 50);
      setRows((prev) => [...prev, ...page.rows]);
      setCursor(page.nextCursor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load more");
    } finally {
      setLoadingRows(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 -ml-2"
        onClick={() => router.navigate({ to: "/datasources" })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Datasources
      </Button>
      <PageHeader
        eyebrow="Datasource"
        title={ds.name}
        description={serverUrlValue || graphNameValue}
      />

      <Card className="rounded-2xl p-6 shadow-soft">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={nameValue} onChange={(e) => setEditName(e.target.value)} />
          </div>
          {isRoam ? (
            <div className="space-y-1.5">
              <Label htmlFor="graph">Graph name</Label>
              <Input
                id="graph"
                value={graphNameValue}
                onChange={(e) => setEditGraphName(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="url">Server URL</Label>
              <Input
                id="url"
                value={serverUrlValue}
                onChange={(e) => setEditServerUrl(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="secret">{isRoam ? "API token" : "Auth token"}</Label>
            <Input
              id="secret"
              type="password"
              value={editSecret}
              onChange={(e) => setEditSecret(e.target.value)}
              placeholder="Leave blank to keep the current one"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={saveChanges} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button
              variant="outline"
              onClick={discover}
              disabled={discovering}
              className="rounded-xl"
            >
              {discovering ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-1 h-4 w-4" />
              )}
              Discover schema
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={disconnect}
              className="ml-auto rounded-xl"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>
      </Card>

      {schema && (
        <Card className="mt-4 rounded-2xl p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Schema</span>
          </div>
          <pre className="overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
            {schema}
          </pre>
        </Card>
      )}

      <Card className="mt-4 rounded-2xl p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Browse data</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={browseData}
            disabled={browsing}
          >
            {browsing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Database className="mr-1 h-3 w-3" />
            )}
            Refresh
          </Button>
        </div>

        {bases.length === 0 && !browsing && (
          <p className="text-xs text-muted-foreground">
            Click Refresh to list what this datasource can reference.
          </p>
        )}

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
              </button>
              {base.expanded && base.tables.length > 0 && (
                <div className="ml-5 space-y-0.5 border-l pl-3">
                  {base.tables.map((t) => (
                    <button
                      key={`${base.id}:${t.id}`}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-accent"
                      onClick={() => openTable(base.id, t.id)}
                    >
                      <Table2 className="h-3 w-3 text-muted-foreground" />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {openTableKey && (
          <div className="mt-4 space-y-2 border-t pt-4">
            {loadingRows && rows.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading records…
              </div>
            ) : (
              <>
                <RecordsTable rows={rows} />
                {cursor && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingRows}
                    className="rounded-xl"
                  >
                    {loadingRows ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Load more
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
