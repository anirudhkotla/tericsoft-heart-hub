import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, MapPin, Briefcase, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  EMPLOYMENT_TYPES,
  JOB_STATUS,
  labelOf,
  type Candidate,
  type JobRequest,
} from "@/lib/hr";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/recruitment/")({
  head: () => ({ meta: [{ title: "Recruitment — Tericsoft HR OS" }] }),
  component: RecruitmentPage,
});

const statusTone: Record<string, string> = {
  open: "bg-teal/20 text-teal-foreground",
  on_hold: "bg-amber/20 text-amber-foreground",
  closed: "bg-muted text-muted-foreground",
};

function RecruitmentPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    department: "",
    location: "",
    employment_type: "full_time",
    openings: "1",
    description: "",
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["job_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as JobRequest[];
    },
  });

  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, job_request_id, stage");
      if (error) throw error;
      return data as Pick<Candidate, "id" | "job_request_id" | "stage">[];
    },
  });

  const countByJob = useMemo(() => {
    const map = new Map<string, number>();
    (candidates ?? []).forEach((c) => {
      if (c.stage === "rejected") return;
      map.set(c.job_request_id, (map.get(c.job_request_id) ?? 0) + 1);
    });
    return map;
  }, [candidates]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Give the role a title.");
      const { error } = await supabase.from("job_requests").insert({
        title: form.title.trim(),
        department: form.department.trim() || null,
        location: form.location.trim() || null,
        employment_type: form.employment_type,
        openings: Math.max(1, Number(form.openings) || 1),
        description: form.description.trim() || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job request created");
      setOpen(false);
      setForm({ title: "", department: "", location: "", employment_type: "full_time", openings: "1", description: "" });
      qc.invalidateQueries({ queryKey: ["job_requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Applicant Tracking System"
        title="Recruitment"
        description="Open roles, hiring pipelines, and candidate progress across the company."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-soft">
                <Plus className="mr-1 h-4 w-4" /> New Job Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New job request</DialogTitle>
                <DialogDescription>Open a role and start building its pipeline.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Role title</Label>
                  <Input id="title" value={form.title} maxLength={120} placeholder="e.g. Senior Backend Engineer" onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dept">Department</Label>
                    <Input id="dept" value={form.department} maxLength={80} placeholder="Engineering" onChange={(e) => setForm({ ...form, department: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc">Location</Label>
                    <Input id="loc" value={form.location} maxLength={80} placeholder="Hyderabad / Remote" onChange={(e) => setForm({ ...form, location: e.target.value })} className="rounded-xl" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Employment type</Label>
                    <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="openings">Openings</Label>
                    <Input id="openings" type="number" min={1} value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" value={form.description} maxLength={4000} rows={4} placeholder="What this role is about, must-have skills…" onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="rounded-xl">
                  {create.isPending ? "Creating…" : "Create role"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : !jobs?.length ? (
        <Card className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16 text-center shadow-soft">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <Users className="h-7 w-7" />
          </div>
          <p className="text-lg font-medium">No open roles yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Create your first job request to start tracking candidates through the pipeline.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link key={job.id} to="/recruitment/$jobId" params={{ jobId: job.id }} className="group">
              <Card className="h-full rounded-2xl shadow-soft transition-transform group-hover:-translate-y-1 group-hover:shadow-lift">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{job.title}</CardTitle>
                    <Badge className={`rounded-md ${statusTone[job.status]}`}>{labelOf(JOB_STATUS, job.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {job.department && <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{job.department}</span>}
                    {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-foreground">
                      <span className="font-semibold">{countByJob.get(job.id) ?? 0}</span> active · {job.openings} opening{job.openings > 1 ? "s" : ""}
                    </span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}