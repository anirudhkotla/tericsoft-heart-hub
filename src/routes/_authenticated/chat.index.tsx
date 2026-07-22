import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatEmptyState,
});

function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center text-sm text-muted-foreground">
      <Sparkles className="h-6 w-6 text-primary" />
      <p className="font-medium text-foreground">Start a new chat</p>
      <p className="max-w-xs">
        Ask the agent about your connected datasources — it can call their tools to look up real
        data.
      </p>
    </div>
  );
}
