import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { ModulePlaceholder } from "@/components/workspace/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [{ title: "Calendar — Tericsoft HR OS" }],
  }),
  component: () => (
    <ModulePlaceholder
      icon={CalendarDays}
      accent="amber"
      eyebrow="Calendar with AI Assistant"
      title="Calendar"
      description="See Google and Outlook events alongside interview loops, and schedule or reschedule meetings by chatting. This module is coming soon."
      ctaLabel="Connect a calendar"
      onCta={() => toast("Calendar module coming soon", { description: "Calendar connections will live here." })}
    />
  ),
});
