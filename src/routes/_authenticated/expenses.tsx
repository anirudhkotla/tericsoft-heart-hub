import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, Upload, Check, X, Clock, IndianRupee, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS,
  formatMoney,
  labelOf,
  type Expense,
} from "@/lib/hr";
import { scanReceipt } from "@/lib/expenses.functions";
import { CURRENCIES, fetchExchangeRate } from "@/lib/currency";
import { PageHeader } from "@/components/workspace/PageHeader";
import { StatCard } from "@/components/workspace/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Tericsoft HR OS" }] }),
  component: ExpensesPage,
});

const statusTone: Record<string, string> = {
  pending: "bg-amber/20 text-amber-foreground",
  approved: "bg-teal/20 text-teal-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

const emptyForm = {
  title: "",
  category: "other",
  amount: "",
  currency: "INR",
  vendor: "",
  spent_on: format(new Date(), "yyyy-MM-dd"),
  notes: "",
};

function ExpensesPage() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const canApprove = hasRole("admin", "hr", "team_lead");
  const fileInput = useRef<HTMLInputElement>(null);
  const [scanFileName, setScanFileName] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [amountInr, setAmountInr] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("spent_on", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const totals = useMemo(() => {
    const list = expenses ?? [];
    const inr = (e: Expense) => e.amount_inr ?? Number(e.amount);
    const sumInr = (s: string) => list.filter((e) => e.status === s).reduce((a, e) => a + inr(e), 0);
    return {
      pending: sumInr("pending"),
      approved: sumInr("approved"),
      count: list.length,
      all: list.reduce((a, e) => a + inr(e), 0),
    };
  }, [expenses]);

  const filtered = useMemo(
    () => (expenses ?? []).filter((e) => filter === "all" || e.status === filter),
    [expenses, filter],
  );

  const handleFilePick = async (list: FileList | null) => {
    if (!list || !list[0]) return;
    const file = list[0];
    setScanFileName(file.name);
    setScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result);
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await scanReceipt({
        name: file.name,
        mimeType: file.type || "image/jpeg",
        base64,
      });
      setForm((f) => ({
        ...f,
        vendor: result.vendor ?? f.vendor,
        title: result.title ?? f.title,
        category: result.category ?? f.category,
        amount: result.amount ? String(result.amount) : f.amount,
        spent_on: result.date ?? f.spent_on,
      }));
      toast.success("Receipt scanned", { description: "Fields pre-filled — review before saving." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to scan receipt");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || form.currency === "INR") {
      setAmountInr(null);
      setExchangeRate(null);
      return;
    }
    let cancelled = false;
    setConverting(true);
    fetchExchangeRate(form.currency, "INR")
      .then((rate) => {
        if (cancelled) return;
        setExchangeRate(rate);
        setAmountInr(Math.round(amount * rate * 100) / 100);
        setConverting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setConverting(false);
      });
    return () => { cancelled = true; };
  }, [form.amount, form.currency]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Add a title.");
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
      const computedInr = form.currency === "INR" ? amount : amountInr ?? null;
      const { error } = await supabase.from("expenses").insert({
        title: form.title.trim(),
        category: form.category,
        amount,
        currency: form.currency,
        amount_inr: computedInr,
        vendor: form.vendor.trim() || null,
        spent_on: form.spent_on,
        notes: form.notes.trim() || null,
        submitted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense submitted");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("expenses")
        .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.from("expenses").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category updated");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const reviewed = status === "pending";
      const { error } = await supabase
        .from("expenses")
        .update({
          status,
          reviewed_by: reviewed ? null : user!.id,
          reviewed_at: reviewed ? null : new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="AI Expense Tracker"
        title="Expenses"
        description="Submit claims in any currency, capture receipts with AI, and approve spend against the company budget."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setScanFileName(null); }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-soft"><Plus className="mr-1 h-4 w-4" /> Add Expense</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New expense</DialogTitle>
                <DialogDescription>Upload a receipt to auto-fill with AI, or enter details manually.</DialogDescription>
              </DialogHeader>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files)}
              />
              <Button
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={scanning}
                className="w-full rounded-xl border-dashed"
              >
                {scanning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {scanning
                  ? "Analyzing receipt with AI…"
                  : scanFileName
                    ? scanFileName
                    : "Upload receipt to scan"}
              </Button>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="etitle">Title</Label>
                  <Input id="etitle" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eamount">Amount</Label>
                    <div className="flex gap-2">
                      <Input id="eamount" type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-xl flex-1" />
                      <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                        <SelectTrigger className="w-[110px] rounded-xl shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.currency !== "INR" && Number(form.amount) > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {converting ? (
                          <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Converting…</span>
                        ) : amountInr != null && exchangeRate ? (
                          <>≈ {formatMoney(amountInr, "INR")} @ 1 {form.currency} = {formatMoney(exchangeRate, "INR")}</>
                        ) : (
                          <span className="text-destructive">Conversion unavailable</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="evendor">Vendor</Label>
                    <Input id="evendor" value={form.vendor} maxLength={80} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edate">Date</Label>
                    <Input id="edate" type="date" value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enotes">Notes</Label>
                  <Textarea id="enotes" value={form.notes} maxLength={1000} rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="rounded-xl">
                  {create.isPending ? "Saving…" : "Submit expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Total spend" value={formatMoney(totals.all)} accent="brand" />
        <StatCard icon={Clock} label="Pending" value={formatMoney(totals.pending)} accent="amber" />
        <StatCard icon={Check} label="Approved" value={formatMoney(totals.approved)} accent="teal" />
        <StatCard icon={Receipt} label="Claims" value={totals.count} accent="coral" />
      </div>

      <div className="mb-4">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
            {EXPENSE_STATUS.map((s) => <TabsTrigger key={s.id} value={s.id} className="rounded-lg">{s.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>

      <Card className="rounded-2xl shadow-soft">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : !filtered.length ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No expenses to show.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <p className="font-medium">{e.title}</p>
                    {e.vendor && <p className="text-xs text-muted-foreground">{e.vendor}</p>}
                  </TableCell>
                  <TableCell>
                    {e.submitted_by === user?.id || canApprove ? (
                      <Select value={e.category} onValueChange={(v) => updateCategory.mutate({ id: e.id, category: v })}>
                        <SelectTrigger className="h-8 w-[150px] rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="rounded-md">{labelOf(EXPENSE_CATEGORIES, e.category)}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(e.spent_on), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <p className="font-medium">{formatMoney(Number(e.amount), e.currency)}</p>
                    {e.amount_inr != null && e.currency !== "INR" && (
                      <p className="text-xs text-muted-foreground">{formatMoney(e.amount_inr, "INR")}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {canApprove ? (
                      <Select value={e.status} onValueChange={(v) => updateStatus.mutate({ id: e.id, status: v })}>
                        <SelectTrigger className={`h-8 w-[130px] rounded-lg ${statusTone[e.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_STATUS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`rounded-md ${statusTone[e.status]}`}>{labelOf(EXPENSE_STATUS, e.status)}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canApprove && e.status !== "approved" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-teal-foreground" onClick={() => review.mutate({ id: e.id, status: "approved" })} aria-label="Approve">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {canApprove && e.status !== "rejected" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => review.mutate({ id: e.id, status: "rejected" })} aria-label="Reject">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {e.submitted_by === user?.id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(e.id)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}