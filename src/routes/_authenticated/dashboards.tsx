import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { ModulePlaceholder } from "@/components/workspace/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/dashboards")({
  head: () => ({
    meta: [{ title: "Dashboards — Tericsoft HR OS" }],
  }),
  component: () => (
    <ModulePlaceholder
      icon={LayoutDashboard}
      accent="teal"
      eyebrow="LLM Dashboard Builder"
      title="Dashboards"
      description="Describe what you want in plain language and build live dashboards from your sheets, docs, and CSVs. This module is coming soon."
      ctaLabel="+ New Dashboard"
      onCta={() => toast("Dashboards module coming soon", { description: "The chat builder will live here." })}
    />
  ),
});
