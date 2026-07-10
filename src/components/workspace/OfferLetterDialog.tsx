import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Sparkles, Download, Save, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateOfferLetter } from "@/lib/offers.functions";
import type { Candidate, JobRequest } from "@/lib/hr";
import letterheadBg from "@/assets/letterhead-bg.jpg.asset.json";
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

  const printLetterhead = () => {
    if (!content.trim()) return;
    const w = window.open("", "_blank", "width=820,height=1040");
    if (!w) {
      toast.error("Allow pop-ups to print the letter on the letterhead.");
      return;
    }
    const esc = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const bg = new URL(letterheadBg.url, window.location.origin).href;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>Offer Letter — ${candidate.full_name}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f1f1f1; }
  .page {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #fff url('${bg}') no-repeat top center;
    background-size: 100% auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .body {
    padding: 33mm 20mm 30mm 20mm;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.5pt;
    line-height: 1.65;
    color: #1a1a1a;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  @media print { body { background: #fff; } }
</style></head>
<body><div class="page"><div class="body">${esc}</div></div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script>
</body></html>`);
    w.document.close();
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

        <div className="mt-5 space-y-1.5">
          <Label>Letterhead preview</Label>
          <div className="overflow-hidden rounded-xl border bg-muted/30 shadow-soft">
            <div
              style={{
                aspectRatio: "210 / 297",
                backgroundImage: `url(${letterheadBg.url})`,
                backgroundSize: "100% auto",
                backgroundRepeat: "no-repeat",
                backgroundColor: "#fff",
              }}
            >
              <div
                style={{
                  padding: "11% 9.5% 10% 9.5%",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
                className="text-[7px] leading-relaxed text-neutral-800 sm:text-[9px]"
              >
                {content.trim() || "Generate or write the letter above to see it laid out on the company letterhead."}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" onClick={download} disabled={!content.trim()}>
            <Download className="mr-1 h-4 w-4" /> .txt
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={printLetterhead} disabled={!content.trim()} className="rounded-xl">
              <Printer className="mr-1 h-4 w-4" /> Print / Save as PDF
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl">
              <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save letter"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}