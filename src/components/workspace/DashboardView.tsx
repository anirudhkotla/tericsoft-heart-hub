import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  DATASETS,
  widgetData,
  widgetStat,
  type DashboardConfig,
  type DatasetId,
  type Widget,
} from "@/lib/dashboards";
import { formatMoney } from "@/lib/hr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type Rows = Record<string, unknown>[];

function useDatasets() {
  return useQuery({
    queryKey: ["dashboard-datasets"],
    queryFn: async () => {
      const results = await Promise.all(
        DATASETS.map((d) => supabase.from(d.id).select("*")),
      );
      const out = {} as Record<DatasetId, Rows>;
      DATASETS.forEach((d, i) => {
        out[d.id] = (results[i].data ?? []) as Rows;
      });
      return out;
    },
  });
}

function fmt(value: number, format?: string) {
  return format === "money" ? formatMoney(value) : value.toLocaleString("en-IN");
}

function WidgetCard({ widget, datasets }: { widget: Widget; datasets: Record<DatasetId, Rows> }) {
  const full = widget.span === 2 && widget.type !== "stat";

  if (widget.type === "stat") {
    const v = widgetStat(widget, datasets);
    return (
      <Card className="rounded-2xl shadow-soft">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">{widget.title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{fmt(v, widget.format)}</p>
        </CardContent>
      </Card>
    );
  }

  const data = widgetData(widget, datasets);

  return (
    <Card className={`rounded-2xl shadow-soft ${full ? "lg:col-span-2" : ""}`}>
      <CardHeader>
        <CardTitle className="text-base">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            No data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            {widget.type === "pie" ? (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => fmt(v, widget.format)}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }}
                />
              </PieChart>
            ) : widget.type === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => fmt(v, widget.format)}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => fmt(v, widget.format)}
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)" }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="var(--chart-1)" />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView({ config }: { config: DashboardConfig }) {
  const { data: datasets, isLoading } = useDatasets();
  const stats = useMemo(() => config.widgets.filter((w) => w.type === "stat"), [config]);
  const charts = useMemo(() => config.widgets.filter((w) => w.type !== "stat"), [config]);

  if (isLoading || !datasets) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((w) => (
            <WidgetCard key={w.id} widget={w} datasets={datasets} />
          ))}
        </div>
      )}
      {charts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {charts.map((w) => (
            <WidgetCard key={w.id} widget={w} datasets={datasets} />
          ))}
        </div>
      )}
    </div>
  );
}
