import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Star,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Trash2,
  FileText,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  PIPELINE_STAGES,
  EMPLOYMENT_TYPES,
  JOB_STATUS,
  labelOf,
  type Candidate,
  type JobRequest,
  type StageId,
} from "@/lib/hr";
import { PageHeader } from "@/components/workspace/PageHeader";
import { OfferLetterDialog } from "@/components/workspace/OfferLetterDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/recruitment/$jobId")({
  head: () => ({ meta: [{ title: "Pipeline — Tericsoft HR OS" }] }),
  component: JobDetailPage,
  errorComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Could not load this role.</div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Role not found.</div>
  ),
});

const toneBg: Record<string, string> = {
  brand: "bg-primary/10 text-primary",
  teal: "bg-teal/20 text-teal-foreground",
  amber: "bg-amber/20 text-amber-foreground",
  coral: "bg-coral/15 text-coral",
  muted: "bg-muted text-muted-foreground",
};

function JobDetailPage() {
  const { jobId } = useParams({ from: "/_authenticated/recruitment/$jobId" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", source: "", notes: "", cv_summary: "" });
  const [offerFor, setOfferFor] = useState<Candidate | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ["job_requests", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_requests").select("*").eq("id", jobId).maybeSingle();
      if (error) throw error;
      return data as JobRequest | null;
    },
  });

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["candidates", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("job_request_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const grouped = useMemo(() => {
    const map: Record<string, Candidate[]> = {};
    PIPELINE_STAGES.forEach((s) => (map[s.id] = []));
    (candidates ?? []).forEach((c) => (map[c.stage] ??= []).push(c));
    return map;
  }, [candidates]);

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("job_requests").update({ status }).eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job_requests"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addCandidate = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Candidate name is required.");
      const { error } = await supabase.from("candidates").insert({
        job_request_id: jobId,
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        source: form.source.trim() || null,
        notes: form.notes.trim() || null,
        cv_summary: form.cv_summary.trim() || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate added");
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", source: "", notes: "", cv_summary: "" });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: StageId }) => {
      const { error } = await supabase.from("candidates").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidates", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRating = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number }) => {
      const { error } = await supabase.from("candidates").update({ rating }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate removed");
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (jobLoading) return <Skeleton className="mx-auto h-96 max-w-6xl rounded-2xl" />;
  if (!job)
    return (
      <div className="mx-auto max-w-6xl p-10 text-center text-muted-foreground">
        Role not found. <Link to="/recruitment" className="text-primary underline">Back to recruitment</Link>
      </div>
    );

  const stageIndex = (s: string) => PIPELINE_STAGES.findIndex((x) => x.id === s);

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/recruitment" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All roles
      </Link>
      <PageHeader
        eyebrow={`${job.department ?? "Role"} · ${labelOf(EMPLOYMENT_TYPES, job.employment_type)}`}
        title={job.title}
        description={job.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Select value={job.status} onValueChange={(v) => setStatus.mutate(v)}>
              <SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOB_STATUS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-soft"><Plus className="mr-1 h-4 w-4" /> Candidate</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add candidate</DialogTitle>
                  <DialogDescription>Add an applicant to the {job.title} pipeline.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cname">Full name</Label>
                    <Input id="cname" value={form.full_name} maxLength={120} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cemail">Email</Label>
                      <Input id="cemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cphone">Phone</Label>
                      <Input id="cphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="csrc">Source</Label>
                    <Input id="csrc" value={form.source} maxLength={80} placeholder="LinkedIn, referral…" onChange={(e) => setForm({ ...form, source: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cnotes">Notes</Label>
                    <Textarea id="cnotes" value={form.notes} maxLength={2000} rows={3} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ccv">CV summary</Label>
                    <Textarea id="ccv" value={form.cv_summary} maxLength={2000} rows={3} placeholder="Key experience, skills, notable projects…" onChange={(e) => setForm({ ...form, cv_summary: e.target.value })} className="rounded-xl" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => addCandidate.mutate()} disabled={addCandidate.isPending} className="rounded-xl">
                    {addCandidate.isPending ? "Adding…" : "Add candidate"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.id} className="flex min-w-0 flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs ${toneBg[stage.tone]}`}>
                    {grouped[stage.id]?.length ?? 0}
                  </span>
                  {stage.label}
                </span>
              </div>
              <div className="flex min-h-24 flex-col gap-2 rounded-2xl bg-muted/40 p-2">
                {grouped[stage.id]?.map((c) => {
                  const idx = stageIndex(c.stage);
                  return (
                    <Card key={c.id} className="rounded-xl p-3 shadow-soft">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium leading-tight">{c.full_name}</p>
                        <button onClick={() => remove.mutate(c.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {c.source && <p className="mt-0.5 text-[11px] text-muted-foreground">via {c.source}</p>}
                      <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                        {c.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      </div>
                      {c.cv_summary && (
                        <p className="mt-2 flex gap-1 rounded-lg bg-primary/5 p-2 text-[11px] text-muted-foreground">
                          <FileText className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                          <span className="line-clamp-3">{c.cv_summary}</span>
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setRating.mutate({ id: c.id, rating: n })} aria-label={`Rate ${n}`}>
                            <Star className={`h-3.5 w-3.5 ${(c.rating ?? 0) >= n ? "fill-amber text-amber" : "text-muted-foreground/40"}`} />
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx <= 0} onClick={() => moveStage.mutate({ id: c.id, stage: PIPELINE_STAGES[idx - 1].id })} aria-label="Back a stage">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Badge variant="secondary" className="rounded-md text-[10px]">{labelOf(PIPELINE_STAGES, c.stage)}</Badge>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx >= PIPELINE_STAGES.length - 1} onClick={() => moveStage.mutate({ id: c.id, stage: PIPELINE_STAGES[idx + 1].id })} aria-label="Advance stage">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
                {!grouped[stage.id]?.length && (
                  <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}