import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, ScanLine, Check, X, Clock, IndianRupee, Trash2 } from "lucide-react";
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
    const sum = (s: string) => list.filter((e) => e.status === s).reduce((a, e) => a + Number(e.amount), 0);
    return {
      pending: sum("pending"),
      approved: sum("approved"),
      count: list.length,
      all: list.reduce((a, e) => a + Number(e.amount), 0),
    };
  }, [expenses]);

  const filtered = useMemo(
    () => (expenses ?? []).filter((e) => filter === "all" || e.status === filter),
    [expenses, filter],
  );

  const scanReceipt = () => {
    setScanning(true);
    // Mock OCR — replace with a real document-extraction call.
    setTimeout(() => {
      const vendors = ["Uber", "Amazon", "Zoho", "Taj Hotels", "IndiGo", "Croma"];
      const cats = ["travel", "software", "hardware", "meals", "office"];
      const v = vendors[Math.floor(Math.random() * vendors.length)];
      const c = cats[Math.floor(Math.random() * cats.length)];
      setForm((f) => ({
        ...f,
        vendor: v,
        title: `${v} purchase`,
        category: c,
        amount: String(500 + Math.floor(Math.random() * 9500)),
      }));
      setScanning(false);
      toast.success("Receipt scanned (mock)", { description: "Fields pre-filled — review before saving." });
    }, 1100);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Add a title.");
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount.");
      const { error } = await supabase.from("expenses").insert({
        title: form.title.trim(),
        category: form.category,
        amount,
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
      const patch: Record<string, unknown> = { status };
      if (status === "pending") {
        patch.reviewed_by = null;
        patch.reviewed_at = null;
      } else {
        patch.reviewed_by = user!.id;
        patch.reviewed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("expenses").update(patch).eq("id", id);
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
        description="Submit claims, capture receipts, and approve spend against the company budget."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-soft"><Plus className="mr-1 h-4 w-4" /> Add Expense</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New expense</DialogTitle>
                <DialogDescription>Snap a receipt to auto-fill, or enter details manually.</DialogDescription>
              </DialogHeader>
              <Button variant="outline" onClick={scanReceipt} disabled={scanning} className="w-full rounded-xl border-dashed">
                <ScanLine className={`mr-2 h-4 w-4 ${scanning ? "animate-pulse" : ""}`} />
                {scanning ? "Scanning receipt…" : "Scan receipt (mock OCR)"}
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
                    <Label htmlFor="eamount">Amount (₹)</Label>
                    <Input id="eamount" type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-xl" />
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
                  <TableCell className="text-right font-medium">{formatMoney(Number(e.amount), e.currency)}</TableCell>
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