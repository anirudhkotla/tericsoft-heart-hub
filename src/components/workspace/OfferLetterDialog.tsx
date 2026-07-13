import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Sparkles, Download, Save, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateOfferLetter } from "@/lib/offers.functions";
import { calculateSalaryTax, formatInr } from "@/lib/salary.tax";
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

type TableRow = {
  label: string;
  pct: string;
  monthly: string;
  annual: string;
  isTotal?: boolean;
  isSectionHeader?: boolean;
};

function compensationTableHtml(regime: ReturnType<typeof calculateSalaryTax>["oldRegime"] | ReturnType<typeof calculateSalaryTax>["newRegime"]) {
  const { breakup } = regime;
  const totalGrossMonthly = formatInr(breakup.totalGross);
  const totalGrossAnnual = formatInr(breakup.totalGross * 12);
  const rows: TableRow[] = [
    { label: "Basic Salary", pct: "50% of Gross", monthly: formatInr(breakup.basicSalary), annual: formatInr(breakup.basicSalary * 12) },
    { label: "HRA", pct: breakup.hra === 8000 ? "Flat ₹8,000" : "40% of Basic", monthly: formatInr(breakup.hra), annual: formatInr(breakup.hra * 12) },
    { label: "Other allowance", pct: "Remaining amount", monthly: formatInr(breakup.otherAllowances), annual: formatInr(breakup.otherAllowances * 12) },
    { label: "Total Gross Salary", pct: "", monthly: totalGrossMonthly, annual: totalGrossAnnual, isTotal: true },
    { label: "Bonus", pct: "", monthly: "-", annual: "-" },
    { label: "On Target Earnings", pct: "", monthly: totalGrossMonthly, annual: totalGrossAnnual },
    { label: "Deduction", pct: "", monthly: "", annual: "", isSectionHeader: true },
    { label: "PF contribution by Employee", pct: "", monthly: formatInr(breakup.pfEmployee), annual: formatInr(breakup.pfEmployee * 12) },
    { label: "Professional Tax", pct: "", monthly: formatInr(breakup.pt), annual: formatInr(breakup.pt * 12) },
    { label: "Income Tax deduction", pct: "", monthly: formatInr(breakup.tds), annual: formatInr(breakup.tds * 12) },
    { label: "Total Net Salary", pct: "", monthly: formatInr(breakup.netTransfer), annual: formatInr(breakup.netAnnual), isTotal: true },
  ];

  return rows;
}

function ComparisonView({ taxResult }: { taxResult: ReturnType<typeof calculateSalaryTax> }) {
  return (
    <div className="space-y-2 text-neutral-900">
      <div className="rounded-lg border bg-green-50 p-2">
        <p className="text-xs font-semibold text-green-700">Recommended: {taxResult.comparison.betterRegime}</p>
        <p className="text-[10px] text-green-600">Save {formatInr(taxResult.comparison.savings)} / yr vs the other regime</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RegimeView regime={taxResult.oldRegime} label="Old Tax Regime" annualIncome={taxResult.input.annualIncome} compact />
        <RegimeView regime={taxResult.newRegime} label="New Tax Regime" annualIncome={taxResult.input.annualIncome} compact />
      </div>
    </div>
  );
}

function SalaryTable({ regime, annualIncome, compact }: { regime: ReturnType<typeof calculateSalaryTax>["oldRegime"]; annualIncome: number; compact?: boolean }) {
  const rows = compensationTableHtml(regime);
  return (
    <div>
      {!compact && (
        <div className="mb-1.5">
          <p className="text-[8px] font-bold text-neutral-900">COMPENSATION LETTER</p>
          <div className="flex items-baseline justify-between">
            <p className="text-[7px] text-neutral-500">Annual Gross Fixed (AGF) Salary</p>
            <p className="text-[9px] font-bold text-neutral-900">{formatInr(annualIncome)}</p>
          </div>
        </div>
      )}
      <table className="w-full text-[9px] text-neutral-900">
        <thead>
          <tr className="border-b bg-neutral-100 text-[8px] font-semibold text-neutral-600">
            <td className="pb-0.5 pr-1.5">Components in salary</td>
            <td className="pb-0.5 pr-1.5">Percentage</td>
            <td className="pb-0.5 pr-1.5 text-right">Per month</td>
            <td className="pb-0.5 text-right">Per annum</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            r.isSectionHeader ? (
              <tr key={i} className="bg-neutral-50"><td colSpan={4} className="pb-0.5 pl-4 pt-1 text-[8px] font-medium text-neutral-500">{r.label}</td></tr>
            ) : r.isTotal ? (
              <tr key={i} className="border-t bg-neutral-50 font-semibold">
                <td className="py-0.5 pr-1.5 text-[9px]">{r.label}</td>
                <td className="py-0.5 pr-1.5 text-[9px]">{r.pct}</td>
                <td className="py-0.5 pr-1.5 text-right">{r.monthly}</td>
                <td className="py-0.5 text-right">{r.annual}</td>
              </tr>
            ) : (
              <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-neutral-50/50"} ${!r.monthly && !r.annual ? "h-2" : ""}`}>
                <td className="py-0.5 pr-1.5">{r.label}</td>
                <td className="py-0.5 pr-1.5">{r.pct}</td>
                <td className="py-0.5 pr-1.5 text-right">{r.monthly}</td>
                <td className="py-0.5 text-right">{r.annual}</td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegimeView({
  regime,
  label,
  annualIncome,
  compact,
}: {
  regime: ReturnType<typeof calculateSalaryTax>["oldRegime"];
  label: string;
  annualIncome: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="rounded-lg border p-2 text-neutral-900">
        <p className="mb-1 text-[10px] font-semibold text-primary">{label}</p>
        <SalaryTable regime={regime} annualIncome={annualIncome} compact />
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-2 text-neutral-900">
      <p className="mb-1.5 text-xs font-semibold text-primary">{label}</p>
      <SalaryTable regime={regime} annualIncome={annualIncome} />
    </div>
  );
}

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

  const [details, setDetails] = useState({
    annualCtc: "",
    joiningDate: "",
    reportingManager: "",
    extraNotes: "",
  });
  const [content, setContent] = useState("");
  const [showBreakup, setShowBreakup] = useState(false);
  const [breakupRegime, setBreakupRegime] = useState<"old" | "new" | "comparison">("comparison");
  const [chosenRegime, setChosenRegime] = useState<"old" | "new">("new");

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
      generateOfferLetter({
        candidateName: candidate.full_name,
        jobTitle: job.title,
        department: job.department ?? "",
        location: job.location ?? "",
        employmentType: job.employment_type,
        annualCtc: Number(details.annualCtc) || 0,
        joiningDate: details.joiningDate,
        reportingManager: details.reportingManager,
        extraNotes: details.extraNotes,
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

  const baseUrl = import.meta.env.BASE_URL;

  const pad = useMemo(() => {
    const top = Number(import.meta.env.VITE_LETTERHEAD_TOP);
    const right = Number(import.meta.env.VITE_LETTERHEAD_RIGHT);
    const bottom = Number(import.meta.env.VITE_LETTERHEAD_BOTTOM);
    const left = Number(import.meta.env.VITE_LETTERHEAD_LEFT);
    return { top, right, bottom, left };
  }, []);

  const taxResult = useMemo(() => {
    const ctc = Number(details.annualCtc);
    if (!ctc || ctc <= 0) return null;
    return calculateSalaryTax(ctc);
  }, [details.annualCtc]);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const printLetterhead = () => {
    if (!content.trim()) return;
    const w = window.open("", "_blank", "width=820,height=1040");
    if (!w) {
      toast.error("Allow pop-ups to print the letter on the letterhead.");
      return;
    }

    const regime = taxResult
      ? (chosenRegime === "old" ? taxResult.oldRegime : taxResult.newRegime)
      : null;

    const tableHtml = regime
      ? `<div class="page plain" style="page-break-before:always;">
<div style="padding:15mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
<div style="margin-bottom:10pt;">
<p style="font-size:9pt;margin:0 0 1pt 0;font-weight:700;">COMPENSATION LETTER</p>
<div style="display:flex;justify-content:space-between;align-items:baseline;">
<span style="font-size:8pt;color:#555;">Annual Gross Fixed (AGF) Salary</span>
<span style="font-size:10pt;font-weight:700;">${formatInr(taxResult!.input.annualIncome)}</span>
</div>
</div>
<table style="width:100%;border-collapse:collapse;font-size:9pt;">
<thead><tr style="background:#f5f5f5;border-bottom:1px solid #ccc;">
<th style="text-align:left;padding:2pt 6pt 2pt 0;font-weight:600;">Components in salary</th>
<th style="text-align:left;padding:2pt 6pt;font-weight:600;">Percentage</th>
<th style="text-align:right;padding:2pt 6pt;font-weight:600;">Per month</th>
<th style="text-align:right;padding:2pt 0 2pt 6pt;font-weight:600;">Per annum</th>
</tr></thead><tbody>
${compensationTableHtml(regime).map((r, i) =>
  r.isSectionHeader
    ? `<tr style="background:#fafafa;"><td colspan="4" style="padding:3pt 0 1pt 14pt;font-size:8pt;color:#666;font-weight:500;">${esc(r.label)}</td></tr>`
    : r.isTotal
      ? `<tr style="border-top:1px solid #ccc;background:#f5f5f5;font-weight:700;"><td style="padding:2pt 6pt 2pt 0;">${esc(r.label)}</td><td style="padding:2pt 6pt;">${esc(r.pct)}</td><td style="padding:2pt 6pt;text-align:right;">${r.monthly}</td><td style="padding:2pt 0 2pt 6pt;text-align:right;">${r.annual}</td></tr>`
      : r.monthly || r.annual
        ? `<tr style="${i % 2 === 0 ? '' : 'background:#fafafa;'}"><td style="padding:1.5pt 6pt 1.5pt 0;">${esc(r.label)}</td><td style="padding:1.5pt 6pt;">${esc(r.pct)}</td><td style="padding:1.5pt 6pt;text-align:right;">${r.monthly}</td><td style="padding:1.5pt 0 1.5pt 6pt;text-align:right;">${r.annual}</td></tr>`
        : `<tr><td colspan="4" style="height:3pt;"></td></tr>`,
).join("\n")}
</tbody></table></div></div>`
      : "";

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
    background: #fff url('${baseUrl}letterhead-bg.jpg') no-repeat top center;
    background-size: 100% auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page.plain {
    background: #fff;
  }
  .body {
    padding: ${pad.top}mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.5pt;
    line-height: 1.65;
    color: #1a1a1a;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  @media print { body { background: #fff; } }
</style></head>
<body><div class="page"><div class="body">${esc(content)}</div></div>${tableHtml}
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};</script>
</body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-5xl">
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
          {draft.isPending
            ? "Generating draft…"
            : content
              ? "Regenerate draft"
              : "Generate AI draft"}
        </Button>

        <div className="mt-4 grid flex-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="letter">Offer letter</Label>
            <Textarea
              id="letter"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="Generate a draft or write the offer letter here…"
              className="flex-1 rounded-xl font-mono text-sm leading-relaxed"
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center gap-1 rounded-lg border bg-muted/20 p-0.5">
              <button
                onClick={() => setShowBreakup(false)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${!showBreakup ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Letterhead
              </button>
              <button
                onClick={() => setShowBreakup(true)}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${showBreakup ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                disabled={!taxResult}
              >
                Salary Breakup
              </button>
            </div>
            {showBreakup && taxResult ? (
              <div className="flex-1 overflow-auto rounded-xl border bg-white p-3 shadow-soft">
                <div className="mb-2 flex gap-1">
                  {(["old", "new", "comparison"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setBreakupRegime(r)}
                      className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${breakupRegime === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      {r === "old" ? "Old" : r === "new" ? "New" : "Compare"}
                    </button>
                  ))}
                </div>
                {breakupRegime === "comparison" ? (
                  <ComparisonView taxResult={taxResult} />
                ) : (
                  <RegimeView
                    regime={taxResult[breakupRegime === "old" ? "oldRegime" : "newRegime"]}
                    label={breakupRegime === "old" ? "Old Tax Regime" : "New Tax Regime"}
                    annualIncome={taxResult.input.annualIncome}
                  />
                )}
                <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/10 px-2 py-1.5 text-[10px] text-neutral-900">
                  <span className="font-medium">Use for compensation:</span>
                  {(["old", "new"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setChosenRegime(r)}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${chosenRegime === r ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                    >
                      {r === "old" ? "Old Regime" : "New Regime"}
                    </button>
                  ))}
                  <span className="ml-auto text-[9px] text-muted-foreground">
                    Recommended: {taxResult.comparison.betterRegime}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden rounded-xl border bg-muted/30 shadow-soft">
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "210 / 297",
                    backgroundImage: `url(${baseUrl}letterhead-bg.jpg)`,
                    backgroundSize: "100% auto",
                    backgroundRepeat: "no-repeat",
                    backgroundColor: "#fff",
                  }}
                >
                  <div
                    style={{
                      padding: `${(pad.top / 210) * 100}% ${(pad.right / 210) * 100}% ${(pad.bottom / 210) * 100}% ${(pad.left / 210) * 100}%`,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}
                    className="text-[7px] leading-relaxed text-neutral-800 sm:text-[9px]"
                  >
                    {content.trim() ||
                      "Generate or write the letter above to see it laid out on the company letterhead."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" onClick={download} disabled={!content.trim()}>
            <Download className="mr-1 h-4 w-4" /> .txt
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={printLetterhead}
              disabled={!content.trim()}
              className="rounded-xl"
            >
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
