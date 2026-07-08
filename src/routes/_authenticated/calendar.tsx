import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EVENT_TYPES, labelOf, type CalendarEvent } from "@/lib/hr";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Tericsoft HR OS" }] }),
  component: CalendarPage,
});

const typeTone: Record<string, string> = {
  meeting: "bg-primary/15 text-primary",
  interview: "bg-coral/15 text-coral",
  deadline: "bg-amber/20 text-amber-foreground",
  holiday: "bg-teal/20 text-teal-foreground",
};
const typeDot: Record<string, string> = {
  meeting: "bg-primary",
  interview: "bg-coral",
  deadline: "bg-amber",
  holiday: "bg-teal",
};

function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    event_type: "meeting",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "10:00",
    location: "",
    description: "",
  });

  const { data: events } = useQuery({
    queryKey: ["calendar_events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*").order("start_at", { ascending: true });
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    (events ?? []).forEach((e) => {
      const key = format(parseISO(e.start_at), "yyyy-MM-dd");
      (map.get(key) ?? map.set(key, []).get(key)!).push(e);
    });
    return map;
  }, [events]);

  const upcoming = useMemo(
    () => (events ?? []).filter((e) => parseISO(e.start_at) >= new Date()).slice(0, 6),
    [events],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Add a title.");
      const start_at = new Date(`${form.date}T${form.time}`).toISOString();
      const { error } = await supabase.from("calendar_events").insert({
        title: form.title.trim(),
        event_type: form.event_type,
        start_at,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event added");
      setOpen(false);
      setForm({ title: "", event_type: "meeting", date: format(new Date(), "yyyy-MM-dd"), time: "10:00", location: "", description: "" });
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event removed");
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Team Calendar"
        title="Calendar"
        description="Meetings, interview loops, and deadlines in one place."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl shadow-soft"><Plus className="mr-1 h-4 w-4" /> New Event</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New event</DialogTitle>
                <DialogDescription>Schedule a meeting, interview, or deadline.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="evt-title">Title</Label>
                  <Input id="evt-title" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="evt-date">Date</Label>
                    <Input id="evt-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="evt-time">Time</Label>
                    <Input id="evt-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evt-loc">Location</Label>
                  <Input id="evt-loc" value={form.location} maxLength={120} placeholder="Meet link or room" onChange={(e) => setForm({ ...form, location: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evt-desc">Description</Label>
                  <Textarea id="evt-desc" value={form.description} maxLength={1000} rows={2} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="rounded-xl">
                  {create.isPending ? "Saving…" : "Add event"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="rounded-2xl p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{format(month, "MMMM yyyy")}</h2>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="rounded-lg text-sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
              <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`min-h-20 rounded-xl border p-1.5 text-left ${
                    isSameMonth(day, month) ? "bg-card" : "bg-muted/30 text-muted-foreground"
                  } ${isToday(day) ? "border-primary" : "border-transparent"}`}
                >
                  <span className={`text-xs ${isToday(day) ? "font-bold text-primary" : ""}`}>{format(day, "d")}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div key={e.id} className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] ${typeTone[e.event_type]}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${typeDot[e.event_type]}`} />
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-2xl p-4 shadow-soft">
          <h3 className="mb-3 text-sm font-semibold">Upcoming</h3>
          {!upcoming.length ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((e) => (
                <div key={e.id} className="group flex gap-3">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted py-1 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground">{format(parseISO(e.start_at), "MMM")}</span>
                    <span className="text-base font-semibold leading-none">{format(parseISO(e.start_at), "d")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <button onClick={() => remove.mutate(e.id)} className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100" aria-label="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{format(parseISO(e.start_at), "EEE, h:mm a")}</p>
                    {e.location && <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{e.location}</p>}
                    <Badge className={`mt-1 rounded-md text-[10px] ${typeTone[e.event_type]}`}>{labelOf(EVENT_TYPES, e.event_type)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}