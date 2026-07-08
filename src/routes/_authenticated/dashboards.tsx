import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, Receipt, TrendingUp, CalendarDays } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPENSE_CATEGORIES,
  PIPELINE_STAGES,
  formatMoney,
  labelOf,
  type Candidate,
  type Expense,
} from "@/lib/hr";
import { PageHeader } from "@/components/workspace/PageHeader";
import { StatCard } from "@/components/workspace/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboards")({
  head: () => ({ meta: [{ title: "Dashboards — Tericsoft HR OS" }] }),
  component: DashboardsPage,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function DashboardsPage() {
  const { data: candidates, isLoading: cLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("candidates").select("id, stage");
      if (error) throw error;
      return data as Pick<Candidate, "id" | "stage">[];
    },
  });

  const { data: expenses, isLoading: eLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*");
      if (error) throw error;
      return data as Expense[];
    },
  });

  const { data: jobCount } = useQuery({
    queryKey: ["job_requests", "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("job_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: eventCount } = useQuery({
    queryKey: ["calendar_events", "upcoming-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .gte("start_at", new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pipelineData = useMemo(
    () =>
      PIPELINE_STAGES.filter((s) => s.id !== "rejected").map((s) => ({
        stage: s.label,
        count: (candidates ?? []).filter((c) => c.stage === s.id).length,
      })),
    [candidates],
  );

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    (expenses ?? []).forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount)));
    return Array.from(map.entries())
      .map(([id, value]) => ({ name: labelOf(EXPENSE_CATEGORIES, id), value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const totalSpend = (expenses ?? []).reduce((a, e) => a + Number(e.amount), 0);
  const hired = (candidates ?? []).filter((c) => c.stage === "hired").length;
  const activeCandidates = (candidates ?? []).filter((c) => c.stage !== "rejected" && c.stage !== "hired").length;

  const loading = cLoading || eLoading;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Live Analytics"
        title="Dashboards"
        description="A real-time view of hiring and spend across Tericsoft, built from your live workspace data."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Open roles" value={jobCount ?? 0} accent="brand" />
        <StatCard icon={TrendingUp} label="Active candidates" value={activeCandidates} hint={`${hired} hired`} accent="teal" />
        <StatCard icon={Receipt} label="Total spend" value={formatMoney(totalSpend)} accent="coral" />
        <StatCard icon={CalendarDays} label="Upcoming events" value={eventCount ?? 0} accent="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-soft">
          <CardHeader><CardTitle className="text-base">Hiring pipeline</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-soft">
          <CardHeader><CardTitle className="text-base">Spend by category</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : !categoryData.length ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No expense data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatMoney(v)}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 flex items-center gap-4 rounded-2xl border-dashed p-5 shadow-soft">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/20 text-teal-foreground">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">Custom LLM dashboard builder</p>
          <p className="text-sm text-muted-foreground">Describe a chart in plain language to generate it from your sheets and docs — coming next.</p>
        </div>
      </Card>
    </div>
  );
}