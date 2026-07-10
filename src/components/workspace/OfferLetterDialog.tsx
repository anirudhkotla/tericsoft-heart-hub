import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Sparkles, Download, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateOfferLetter } from "@/lib/offers.functions";
import type { Candidate, JobRequest } from "@/lib/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OfferLetterDialog({
  candidate,
  job,
  open,
  onOpenChange,
}: {
  candidate: Candidate;
  job: JobRequest;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const generate = useServerFn(generateOfferLetter);

  const [details, setDetails] = useState({
    annualCtc: "",
    joiningDate: "",
    reportingManager: "",
    extraNotes: "",
  });
  const [content, setContent] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["offer_letters", candidate.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offer_letters")
        .select("*")
        .eq("candidate_id", candidate.id)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing) {
      setContent(existing.content);
      const d = (existing.details ?? {}) as Record<string, unknown>;
      setDetails({
        annualCtc: d.annualCtc ? String(d.annualCtc) : "",
        joiningDate: (d.joiningDate as string) ?? "",
        reportingManager: (d.reportingManager as string) ?? "",
        extraNotes: (d.extraNotes as string) ?? "",
      });
    }
  }, [existing]);

  const draft = useMutation({
    mutationFn: async () =>
      generate({
        data: {
          candidateName: candidate.full_name,
          jobTitle: job.title,
          department: job.department ?? "",
          location: job.location ?? "",
          employmentType: job.employment_type,
          annualCtc: Number(details.annualCtc) || 0,
          joiningDate: details.joiningDate,
          reportingManager: details.reportingManager,
          extraNotes: details.extraNotes,
        },
      }),
    onSuccess: (res) => {
      setContent(res.content);
      toast.success("Draft generated — review and edit below");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("Nothing to save yet.");
      const payload = {
        candidate_id: candidate.id,
        job_request_id: job.id,
        content,
        details: { ...details, annualCtc: Number(details.annualCtc) || 0 },
      };
      if (existing) {
        const { error } = await supabase
          .from("offer_letters")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("offer_letters")
          .insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Offer letter saved");
      qc.invalidateQueries({ queryKey: ["offer_letters", candidate.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = () => {
    if (!content.trim()) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Offer Letter — ${candidate.full_name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Offer letter — {candidate.full_name}
          </DialogTitle>
          <DialogDescription>
            Fill in the details, generate an AI draft, edit freely, then save or download.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ctc">Annual CTC (₹)</Label>
            <Input
              id="ctc"
              type="number"
              min={0}
              value={details.annualCtc}
              placeholder="1200000"
              onChange={(e) => setDetails({ ...details, annualCtc: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jdate">Joining date</Label>
            <Input
              id="jdate"
              type="date"
              value={details.joiningDate}
              onChange={(e) => setDetails({ ...details, joiningDate: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mgr">Reporting manager</Label>
            <Input
              id="mgr"
              value={details.reportingManager}
              maxLength={160}
              onChange={(e) => setDetails({ ...details, reportingManager: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="xnotes">Extra notes (optional)</Label>
            <Input
              id="xnotes"
              value={details.extraNotes}
              maxLength={2000}
              placeholder="Probation period, benefits…"
              onChange={(e) => setDetails({ ...details, extraNotes: e.target.value })}
              className="rounded-xl"
            />
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => draft.mutate()}
          disabled={draft.isPending}
          className="w-full rounded-xl border-dashed"
        >
          {draft.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
          )}
          {draft.isPending ? "Generating draft…" : content ? "Regenerate draft" : "Generate AI draft"}
        </Button>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="letter">Offer letter</Label>
          <Textarea
            id="letter"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="Generate a draft or write the offer letter here…"
            className="rounded-xl font-mono text-sm leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground">
            The company letterhead (logo, address, footer) is applied on the printed page — keep the body clear of headers.
          </p>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:justify-between">
          <Button variant="ghost" onClick={download} disabled={!content.trim()}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl">
            <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save letter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}