import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Users, Plus, LayoutDashboard, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Dashboard } from "@/lib/hr";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboards/")({
  head: () => ({ meta: [{ title: "Dashboards — Tericsoft HR OS" }] }),
  component: DashboardsIndex,
});

function Tile({
  to,
  params,
  icon: Icon,
  accent,
  title,
  description,
  onDelete,
}: {
  to: string;
  params?: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  description: string;
  onDelete?: () => void;
}) {
  return (
    <Card className="group relative rounded-2xl p-5 shadow-soft transition-transform hover:-translate-y-0.5">
      <Link to={to} params={params} className="block">
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</p>
      </Link>
      {onDelete && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 top-2 h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          onClick={onDelete}
          aria-label="Delete dashboard"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}

function DashboardsIndex() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();

  const { data: custom, isLoading } = useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Dashboard[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dashboards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dashboard deleted");
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Analytics"
        title="Dashboards"
        description="Open a ready-made view or describe a custom HR dashboard and let AI build it from your data."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          to="/dashboards/$dashboardId"
          params={{ dashboardId: "expenses" }}
          icon={Receipt}
          accent="bg-coral/20 text-coral-foreground"
          title="Expenses Overview"
          description="Company spend by category and approval status."
        />
        <Tile
          to="/dashboards/$dashboardId"
          params={{ dashboardId: "jobs" }}
          icon={Users}
          accent="bg-brand/20 text-brand-foreground"
          title="Job Applications"
          description="Hiring funnel and open roles across teams."
        />

        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
          : (custom ?? []).map((d) => (
              <Tile
                key={d.id}
                to="/dashboards/$dashboardId"
                params={{ dashboardId: d.id }}
                icon={Sparkles}
                accent="bg-teal/20 text-teal-foreground"
                title={d.name}
                description={d.description ?? "Custom AI-generated dashboard."}
                onDelete={
                  d.created_by === user?.id || hasRole("admin")
                    ? () => remove.mutate(d.id)
                    : undefined
                }
              />
            ))}

        <Link to="/dashboards/new">
          <Card className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center shadow-soft transition-colors hover:border-primary hover:bg-accent/40">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <p className="font-medium">Create dashboard</p>
            <p className="text-xs text-muted-foreground">Describe it in plain language — AI builds it.</p>
          </Card>
        </Link>
      </div>

      <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground">
        <LayoutDashboard className="h-4 w-4" />
        Built from your live workspace data and any files you attach.
      </div>
    </div>
  );
}
