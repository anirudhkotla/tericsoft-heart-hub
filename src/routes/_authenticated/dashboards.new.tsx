import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Paperclip, Send, Sparkles, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateDashboard } from "@/lib/dashboards.functions";
import type { DashboardConfig } from "@/lib/dashboards";
import { PageHeader } from "@/components/workspace/PageHeader";
import { DashboardView } from "@/components/workspace/DashboardView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboards/new")({
  head: () => ({ meta: [{ title: "Create dashboard — Tericsoft HR OS" }] }),
  component: NewDashboard,
});

interface Attached {
  name: string;
  mimeType: string;
  base64: string;
}

interface AssistantMsg {
  role: "assistant";
  config: DashboardConfig;
}
interface UserMsg {
  role: "user";
  text: string;
  files: string[];
}
type Msg = UserMsg | AssistantMsg;

function readFile(file: File): Promise<Attached> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ name: file.name, mimeType: file.type || "text/plain", base64: result.split(",")[1] ?? "" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function NewDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<Attached[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const latest = [...messages].reverse().find((m) => m.role === "assistant") as AssistantMsg | undefined;

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    try {
      const read = await Promise.all(Array.from(list).slice(0, 6).map(readFile));
      setFiles((f) => [...f, ...read].slice(0, 6));
    } catch {
      toast.error("Could not read one of the files.");
    }
  };

  const send = async () => {
    if (!prompt.trim()) return;
    const text = prompt.trim();
    const fileNames = files.map((f) => f.name);
    setMessages((m) => [...m, { role: "user", text, files: fileNames }]);
    setBusy(true);
    setPrompt("");
    try {
      const config = await generateDashboard({ prompt: text, files });
      setMessages((m) => [...m, { role: "assistant", config }]);
      setFiles([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
      setMessages((m) => m.slice(0, -1));
      setPrompt(text);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!latest) return;
    setSaving(true);
    try {
      const { config } = latest;
      const { data, error } = await supabase
        .from("dashboards")
        .insert({
          name: config.title,
          description: config.description ?? null,
          config: { widgets: config.widgets } as never,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Dashboard saved");
      router.navigate({ to: "/dashboards/$dashboardId", params: { dashboardId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.navigate({ to: "/dashboards" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Dashboards
      </Button>
      <PageHeader
        eyebrow="AI Builder"
        title="Create a dashboard"
        description="Describe the HR dashboard you want. Attach spreadsheets or reports and the AI will build charts from your data."
      />

      <div className="space-y-4">
        {messages.length === 0 && (
          <Card className="rounded-2xl border-dashed p-6 text-sm text-muted-foreground shadow-soft">
            <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Try asking for:
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>"Recruitment funnel with candidates per stage and open roles by department"</li>
              <li>"Monthly expense breakdown by category, highlight pending approvals"</li>
              <li>"Attrition summary from the attached HR report"</li>
            </ul>
          </Card>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {m.text}
                {m.files.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.files.map((f) => (
                      <Badge key={f} variant="secondary" className="rounded-md text-[10px]">{f}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> {m.config.title}
              </div>
              {m.config.description && <p className="text-sm text-muted-foreground">{m.config.description}</p>}
              <DashboardView config={m.config} />
              {latest === m && (
                <Button onClick={save} disabled={saving} className="rounded-xl">
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  Save dashboard
                </Button>
              )}
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Designing your dashboard…
          </div>
        )}
      </div>

      <Card className="sticky bottom-4 mt-6 rounded-2xl p-3 shadow-lift">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <Badge key={i} variant="secondary" className="rounded-md">
                {f.name}
                <button className="ml-1" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Remove file">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".csv,.txt,.json,.md,.pdf,image/*"
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileInput.current?.click()} aria-label="Attach files">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) send();
              }
            }}
            placeholder={latest ? "Refine or ask for another dashboard…" : "Describe the dashboard you want…"}
            rows={1}
            className="max-h-32 min-h-[42px] resize-none rounded-xl"
          />
          <Button onClick={send} disabled={busy || !prompt.trim()} size="icon" className="shrink-0 rounded-xl" aria-label="Generate">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
