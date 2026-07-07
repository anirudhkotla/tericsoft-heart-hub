import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { ModulePlaceholder } from "@/components/workspace/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({
    meta: [{ title: "Recruitment — Tericsoft HR OS" }],
  }),
  component: () => (
    <ModulePlaceholder
      icon={Users}
      accent="brand"
      eyebrow="Applicant Tracking System"
      title="Recruitment"
      description="Post job requests, run drag-and-drop hiring pipelines, sift CVs, and generate offer letters. This module is next up to be built."
      ctaLabel="+ New Job Request"
      onCta={() => toast("Recruitment module coming next", { description: "Job requests will live here." })}
    />
  ),
});
