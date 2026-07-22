import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronRight, Eraser, Loader2, Send, Wrench } from "lucide-react";
import { fetchSession, fetchMessages, sendMessage, clearAgentCache } from "@/lib/agent";
import { SESSIONS_QUERY_KEY } from "./chat";
import { useDatasources } from "@/lib/datasource-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/chat/$sessionId")({
  head: () => ({ meta: [{ title: "Agent Chat — Tericsoft HR OS" }] }),
  component: ChatThread,
});

function ToolStep({
  role,
  content,
}: {
  role: "tool_call" | "tool_result";
  content: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const name = String(content.name ?? "");
  const label = role === "tool_call" ? name : `${name} result`;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="max-w-[85%]">
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent">
          <Wrench className="h-3 w-3" />
          {label}
          <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-muted p-2.5 text-[10px] leading-relaxed">
          {JSON.stringify(role === "tool_call" ? content.args : content.result, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChatThread() {
  const { sessionId } = Route.useParams();
  const queryClient = useQueryClient();
  const { datasources } = useDatasources();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: session } = useQuery({
    queryKey: ["agent-session", sessionId],
    queryFn: () => fetchSession(sessionId),
  });
  const { data: messages } = useQuery({
    queryKey: ["agent-messages", sessionId],
    queryFn: () => fetchMessages(sessionId),
  });

  useEffect(() => {
    if (session) setEnabled(new Set(session.enabled_datasource_ids));
  }, [session?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const toggleDs = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidateThread = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agent-messages", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["agent-session", sessionId] }),
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
    ]);
  };

  const send = async () => {
    if (!prompt.trim() || sending) return;
    const text = prompt.trim();
    setPrompt("");
    setSending(true);
    try {
      await sendMessage(sessionId, text, Array.from(enabled));
      await invalidateThread();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The agent failed to respond");
      setPrompt(text);
    } finally {
      setSending(false);
    }
  };

  const clearCache = async () => {
    setClearing(true);
    try {
      await clearAgentCache(sessionId, Array.from(enabled));
      toast.success("Cache cleared — the next message starts a fresh context");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear cache");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <Card className="flex flex-wrap items-center gap-3 rounded-2xl p-3 shadow-soft">
        <span className="text-xs font-medium text-muted-foreground">Datasources:</span>
        {datasources.length === 0 && (
          <span className="text-xs text-muted-foreground">None connected</span>
        )}
        {datasources.map((ds) => (
          <label key={ds.id} className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={enabled.has(ds.id)} onCheckedChange={() => toggleDs(ds.id)} />
            {ds.name}
          </label>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-[11px]"
          onClick={clearCache}
          disabled={clearing}
        >
          {clearing ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Eraser className="mr-1 h-3 w-3" />
          )}
          Clear KV cache
        </Button>
      </Card>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border bg-card p-4 shadow-soft">
        {(messages ?? []).map((m) => {
          if (m.step_type === "tool_call" || m.step_type === "tool_result") {
            return <ToolStep key={m.id} role={m.step_type} content={m.content} />;
          }
          const text = String(m.content.text ?? "");
          if (!text) return null;
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {text}
                </div>
              </div>
            );
          }
          return (
            <div
              key={m.id}
              className="max-w-[85%] space-y-2 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
        {(messages ?? []).length === 0 && !sending && (
          <p className="text-sm text-muted-foreground">Ask something to get started.</p>
        )}
        <div ref={bottomRef} />
      </div>

      <Card className="rounded-2xl p-3 shadow-lift">
        <div className="flex items-end gap-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the agent…"
            rows={1}
            className="max-h-32 min-h-[42px] resize-none rounded-xl"
          />
          <Button
            onClick={send}
            disabled={sending || !prompt.trim()}
            size="icon"
            className="shrink-0 rounded-xl"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {enabled.size > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from(enabled).map((id) => {
              const ds = datasources.find((d) => d.id === id);
              return ds ? (
                <Badge key={id} variant="secondary" className="rounded-md text-[10px]">
                  {ds.name}
                </Badge>
              ) : null;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
