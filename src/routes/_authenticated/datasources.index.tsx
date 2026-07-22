import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Cable, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useDatasources } from "@/lib/datasource-store";
import { getMcpProxyClient } from "@/lib/mcp-proxy-client";
import type { Datasource } from "@/lib/datasources";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/datasources/")({
  head: () => ({ meta: [{ title: "Datasources — Tericsoft HR OS" }] }),
  component: DatasourcesIndex,
});

function DatasourceCard({ ds, onRemove }: { ds: Datasource; onRemove: (id: string) => void }) {
  const [tools, setTools] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const client = getMcpProxyClient(ds.id);
      const t = await client.listTools();
      setTools(t.length);
      toast.success(`Connected — ${t.length} tool(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Link to="/datasources/$datasourceId" params={{ datasourceId: ds.id }}>
      <Card className="group relative rounded-2xl p-5 shadow-soft transition-transform hover:-translate-y-0.5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Cable className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{ds.name}</p>
            <Badge variant="secondary" className="rounded-md text-[10px] capitalize">
              {ds.provider}
            </Badge>
          </div>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {ds.config.serverUrl ?? ds.config.graphName ?? ""}
        </p>
        {tools !== null && <p className="mt-1 text-xs text-green-600">{tools} tool(s) available</p>}
        <div className="mt-3 flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px]"
            onClick={(e) => {
              e.preventDefault();
              testConnection();
            }}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Test
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] text-destructive"
            onClick={(e) => {
              e.preventDefault();
              onRemove(ds.id);
            }}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Remove
          </Button>
        </div>
      </Card>
    </Link>
  );
}

function DatasourcesIndex() {
  const { datasources, isLoading, remove } = useDatasources();

  const handleRemove = async (id: string) => {
    try {
      await remove(id);
      toast.success("Datasource removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Integrations"
        title="Datasources"
        description="Connect Airtable, Notion, Roam Research, or any MCP server for the AI agent and dashboards to reference."
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading datasources…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasources.map((ds) => (
            <DatasourceCard key={ds.id} ds={ds} onRemove={handleRemove} />
          ))}

          <Link to="/datasources/new">
            <Card className="flex h-full min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center shadow-soft transition-colors hover:border-primary hover:bg-accent/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <p className="font-medium">Connect datasource</p>
              <p className="text-xs text-muted-foreground">Add a new source</p>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
