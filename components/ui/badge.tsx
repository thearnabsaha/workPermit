import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "warning" | "error" | "success" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-surface border border-border text-fg",
  accent: "bg-accent/15 text-accent border border-accent/30",
  warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  error: "bg-red-500/15 text-red-300 border border-red-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  muted: "bg-surface text-muted border border-border",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
