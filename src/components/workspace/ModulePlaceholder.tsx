import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModulePlaceholderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  accent?: "brand" | "coral" | "teal" | "amber";
  onCta?: () => void;
}

const accentBg: Record<string, string> = {
  brand: "bg-primary/10 text-primary",
  coral: "bg-coral/15 text-coral",
  teal: "bg-teal/20 text-teal-foreground",
  amber: "bg-amber/20 text-amber-foreground",
};

export function ModulePlaceholder({
  icon: Icon,
  eyebrow,
  title,
  description,
  ctaLabel,
  accent = "brand",
  onCta,
}: ModulePlaceholderProps) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div
        className={`mb-6 flex h-20 w-20 items-center justify-center rounded-3xl ${accentBg[accent]} shadow-soft transition-transform hover:-translate-y-1`}
      >
        <Icon className="h-9 w-9" />
      </div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="max-w-xl text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-balance text-muted-foreground">{description}</p>
      <Button
        size="lg"
        onClick={onCta}
        className="mt-8 rounded-xl shadow-soft transition-transform active:scale-95"
      >
        {ctaLabel}
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">Ready for the next build step.</p>
    </div>
  );
}