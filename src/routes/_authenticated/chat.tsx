import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquarePlus, MessageSquare, Trash2 } from "lucide-react";
import { fetchSessions, createSession, deleteSession } from "@/lib/agent";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Agent Chat — Tericsoft HR OS" }] }),
  component: ChatLayout,
});

export const SESSIONS_QUERY_KEY = ["agent-sessions"] as const;

function ChatLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: sessions } = useQuery({ queryKey: SESSIONS_QUERY_KEY, queryFn: fetchSessions });

  const newChat = async () => {
    try {
      const session = await createSession();
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      router.navigate({ to: "/chat/$sessionId", params: { sessionId: session.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start a new chat");
    }
  };

  const removeSession = async (id: string) => {
    try {
      await deleteSession(id);
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      if (pathname.endsWith(id)) router.navigate({ to: "/chat" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete chat");
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-6xl gap-4">
      <div className="flex w-64 shrink-0 flex-col rounded-2xl border bg-card shadow-soft">
        <div className="p-3">
          <Button onClick={newChat} className="w-full rounded-xl" size="sm">
            <MessageSquarePlus className="mr-1.5 h-4 w-4" /> New chat
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2 pb-2">
          <div className="space-y-0.5">
            {(sessions ?? []).map((s) => {
              const active = pathname.endsWith(s.id);
              return (
                <Link
                  key={s.id}
                  to="/chat/$sessionId"
                  params={{ sessionId: s.id }}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent",
                    active && "bg-accent",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeSession(s.id);
                    }}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </Link>
              );
            })}
            {sessions?.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">No chats yet.</p>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
