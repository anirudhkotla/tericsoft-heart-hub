import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BUILTIN_DASHBOARDS, type DashboardConfig } from "@/lib/dashboards";
import type { Dashboard } from "@/lib/hr";
import { PageHeader } from "@/components/workspace/PageHeader";
import { DashboardView } from "@/components/workspace/DashboardView";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboards/$dashboardId")({
  head: () => ({ meta: [{ title: "Dashboard — Tericsoft HR OS" }] }),
  component: DashboardDetail,
  errorComponent: () => (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-muted-foreground">
      Could not load this dashboard.{" "}
      <Link to="/dashboards" className="text-primary hover:underline">Back to dashboards</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-6xl py-16 text-center text-sm text-muted-foreground">
      Dashboard not found.
    </div>
  ),
});

function DashboardDetail() {
  const { dashboardId } = Route.useParams();
  const router = useRouter();
  const builtin = BUILTIN_DASHBOARDS[dashboardId];

  const { data: saved, isLoading } = useQuery({
    queryKey: ["dashboard", dashboardId],
    enabled: !builtin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*")
        .eq("id", dashboardId)
        .maybeSingle();
      if (error) throw error;
      return data as Dashboard | null;
    },
  });

  const config: DashboardConfig | null = builtin
    ? builtin
    : saved
      ? { title: saved.name, description: saved.description ?? undefined, ...(saved.config as object) } as DashboardConfig
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.navigate({ to: "/dashboards" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Dashboards
      </Button>
      {!builtin && isLoading ? (
        <Skeleton className="h-8 w-64 rounded-lg" />
      ) : !config ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Dashboard not found.</div>
      ) : (
        <>
          <PageHeader eyebrow="Live view" title={config.title} description={config.description} />
          <DashboardView config={config} />
        </>
      )}
    </div>
  );
}
