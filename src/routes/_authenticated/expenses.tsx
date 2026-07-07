import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { ModulePlaceholder } from "@/components/workspace/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [{ title: "Expenses — Tericsoft HR OS" }],
  }),
  component: () => (
    <ModulePlaceholder
      icon={Receipt}
      accent="coral"
      eyebrow="AI Expense Tracker"
      title="Expenses"
      description="Snap a receipt for instant OCR extraction, submit and approve expenses, and watch spend against budgets. This module is coming soon."
      ctaLabel="+ Add Expense"
      onCta={() => toast("Expenses module coming soon", { description: "Receipt capture will live here." })}
    />
  ),
});
