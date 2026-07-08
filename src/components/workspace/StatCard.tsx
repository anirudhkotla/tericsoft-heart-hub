import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

const tone: Record<string, string> = {
  brand: "bg-primary/10 text-primary",
  coral: "bg-coral/15 text-coral",
  teal: "bg-teal/20 text-teal-foreground",
  amber: "bg-amber/20 text-amber-foreground",
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: keyof typeof tone;
}

export function StatCard({ icon: Icon, label, value, hint, accent = "brand" }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 rounded-2xl p-4 shadow-soft">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone[accent]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}