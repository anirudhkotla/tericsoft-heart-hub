import type { Tables } from "@/integrations/supabase/types";

export type JobRequest = Tables<"job_requests">;
export type Candidate = Tables<"candidates">;
export type Expense = Tables<"expenses">;
export type CalendarEvent = Tables<"calendar_events">;
export type Dashboard = Tables<"dashboards">;

export const PIPELINE_STAGES = [
  { id: "applied", label: "Applied", tone: "brand" },
  { id: "screening", label: "Screening", tone: "teal" },
  { id: "interview", label: "Interview", tone: "amber" },
  { id: "offer", label: "Offer", tone: "coral" },
  { id: "hired", label: "Hired", tone: "teal" },
  { id: "rejected", label: "Rejected", tone: "muted" },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]["id"];

export const JOB_STATUS = [
  { id: "open", label: "Open" },
  { id: "on_hold", label: "On hold" },
  { id: "closed", label: "Closed" },
] as const;

export const EMPLOYMENT_TYPES = [
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
  { id: "intern", label: "Intern" },
] as const;

export const EXPENSE_CATEGORIES = [
  { id: "travel", label: "Travel" },
  { id: "meals", label: "Meals" },
  { id: "software", label: "Software" },
  { id: "hardware", label: "Hardware" },
  { id: "office", label: "Office" },
  { id: "recruiting", label: "Recruiting" },
  { id: "training", label: "Training" },
  { id: "other", label: "Other" },
] as const;

export const EXPENSE_STATUS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

export const EVENT_TYPES = [
  { id: "meeting", label: "Meeting", tone: "brand" },
  { id: "interview", label: "Interview", tone: "coral" },
  { id: "deadline", label: "Deadline", tone: "amber" },
  { id: "holiday", label: "Holiday", tone: "teal" },
] as const;

export function labelOf<T extends { id: string; label: string }>(
  list: readonly T[],
  id: string,
): string {
  return list.find((i) => i.id === id)?.label ?? id;
}

export function formatMoney(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}