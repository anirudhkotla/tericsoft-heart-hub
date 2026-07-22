// Shared, client-safe dashboard spec types + aggregation engine.

export type DatasetId = "expenses" | "candidates" | "job_requests" | "calendar_events";

export const DATASETS: { id: DatasetId; label: string; groupable: string[]; sumFields: string[] }[] = [
  { id: "expenses", label: "Expenses", groupable: ["category", "status", "vendor", "currency"], sumFields: ["amount"] },
  { id: "candidates", label: "Candidates", groupable: ["stage", "source"], sumFields: ["rating"] },
  { id: "job_requests", label: "Job requests", groupable: ["status", "department", "employment_type"], sumFields: ["openings"] },
  { id: "calendar_events", label: "Calendar events", groupable: ["event_type"], sumFields: [] },
];

export type WidgetType = "stat" | "bar" | "pie" | "line";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  source: "dataset" | "inline" | "external"; // "external" only exists transiently during generation; generateDashboard() resolves it to "inline" with real computed data before returning
  dataset?: DatasetId;
  datasourceId?: string;        // external datasource UUID (when data comes from MCP)
  datasourceTable?: string;     // key into the externalTables map passed to generateDashboard, e.g. "T1"
  metric?: "count" | "sum";
  valueField?: string;
  groupBy?: string;
  data?: { name: string; value: number }[];
  format?: "money" | "number";
  span?: 1 | 2;
}

export interface DashboardConfig {
  title: string;
  description?: string;
  widgets: Widget[];
}

type Row = Record<string, unknown>;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function computeStat(rows: Row[], metric: "count" | "sum", valueField?: string): number {
  if (metric === "count") return rows.length;
  return rows.reduce((a, r) => a + num(valueField ? r[valueField] : 0), 0);
}

export function computeSeries(
  rows: Row[],
  groupBy: string,
  metric: "count" | "sum",
  valueField?: string,
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = String(r[groupBy] ?? "—") || "—";
    const inc = metric === "count" ? 1 : num(valueField ? r[valueField] : 0);
    map.set(key, (map.get(key) ?? 0) + inc);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

export function widgetData(w: Widget, datasets: Record<DatasetId, Row[]>): { name: string; value: number }[] {
  if (w.source === "inline") return w.data ?? [];
  const rows = w.dataset ? datasets[w.dataset] ?? [] : [];
  if (!w.groupBy) return [];
  return computeSeries(rows, w.groupBy, w.metric ?? "count", w.valueField);
}

export function widgetStat(w: Widget, datasets: Record<DatasetId, Row[]>): number {
  if (w.source === "inline") return (w.data ?? []).reduce((a, d) => a + d.value, 0);
  const rows = w.dataset ? datasets[w.dataset] ?? [] : [];
  return computeStat(rows, w.metric ?? "count", w.valueField);
}

// Built-in starter dashboards (not stored in DB).
export const BUILTIN_DASHBOARDS: Record<string, DashboardConfig> = {
  expenses: {
    title: "Expenses Overview",
    description: "Company spend broken down by category and approval status.",
    widgets: [
      { id: "e1", type: "stat", title: "Total spend", source: "dataset", dataset: "expenses", metric: "sum", valueField: "amount", format: "money" },
      { id: "e2", type: "stat", title: "Claims", source: "dataset", dataset: "expenses", metric: "count", format: "number" },
      { id: "e3", type: "bar", title: "Spend by category", source: "dataset", dataset: "expenses", metric: "sum", valueField: "amount", groupBy: "category", format: "money", span: 2 },
      { id: "e4", type: "pie", title: "Spend by status", source: "dataset", dataset: "expenses", metric: "sum", valueField: "amount", groupBy: "status", format: "money" },
    ],
  },
  jobs: {
    title: "Job Applications",
    description: "Hiring funnel and open roles across the company.",
    widgets: [
      { id: "j1", type: "stat", title: "Total candidates", source: "dataset", dataset: "candidates", metric: "count", format: "number" },
      { id: "j2", type: "stat", title: "Open roles", source: "dataset", dataset: "job_requests", metric: "count", format: "number" },
      { id: "j3", type: "bar", title: "Candidates by stage", source: "dataset", dataset: "candidates", metric: "count", groupBy: "stage", format: "number", span: 2 },
      { id: "j4", type: "pie", title: "Candidates by source", source: "dataset", dataset: "candidates", metric: "count", groupBy: "source", format: "number" },
      { id: "j5", type: "bar", title: "Openings by department", source: "dataset", dataset: "job_requests", metric: "sum", valueField: "openings", groupBy: "department", format: "number", span: 2 },
    ],
  },
};
