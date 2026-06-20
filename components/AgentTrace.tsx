"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, AlertTriangle, XCircle, Circle, ChevronDown } from "lucide-react";
import type { TraceStatus, TraceStep } from "@/lib/types";
import { prettyStep } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Safe workflow trace / audit log — NOT chain-of-thought.
const statusIcon: Record<TraceStatus, React.ReactNode> = {
  pending: <Circle size={14} className="text-muted" />,
  running: <Loader2 size={14} className="text-accent animate-spin" />,
  done: <Check size={14} className="text-emerald-400" />,
  warning: <AlertTriangle size={14} className="text-amber-400" />,
  error: <XCircle size={14} className="text-red-400" />,
};

export function AgentTrace({ steps, emptyText }: { steps: TraceStep[]; emptyText?: string }) {
  if (steps.length === 0) {
    return <p className="text-xs text-muted">{emptyText ?? "No activity yet."}</p>;
  }
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => (
        <TraceRow key={`${s.step}-${i}`} step={s} last={i === steps.length - 1} />
      ))}
    </ol>
  );
}

function TraceRow({ step, last }: { step: TraceStep; last: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!step.details;
  return (
    <li>
      <div className="flex items-start gap-2.5">
        <div className="flex flex-col items-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {statusIcon[step.status]}
          </motion.div>
          {!last && <span className="w-px flex-1 bg-border my-0.5 min-h-3" />}
        </div>
        <div className="flex-1 pb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{step.label ?? prettyStep(step.step)}</span>
            {step.durationMs != null && (
              <span className="text-[10px] text-muted">{step.durationMs}ms</span>
            )}
            {hasDetails && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="ml-auto text-muted hover:text-fg"
                aria-label="Toggle details"
              >
                <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
              </button>
            )}
          </div>
          {step.message && <p className="text-[11px] text-muted mt-0.5">{step.message}</p>}
          {hasDetails && open && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-1.5 overflow-x-auto rounded-md border border-border bg-bg p-2 text-[11px] text-muted whitespace-pre-wrap"
            >
              {step.details}
            </motion.pre>
          )}
        </div>
      </div>
    </li>
  );
}
