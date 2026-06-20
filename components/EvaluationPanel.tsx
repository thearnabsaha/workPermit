"use client";
import { Check, X, Minus, AlertTriangle } from "lucide-react";
import type { Evaluation } from "@/lib/types";
import { Badge } from "./ui/badge";

const CHECKS: { key: keyof Evaluation; label: string }[] = [
  { key: "input_parsed", label: "Input parsed" },
  { key: "files_processed", label: "Files processed" },
  { key: "prompt_injection_checked", label: "Prompt injection checked" },
  { key: "output_schema_valid", label: "Output schema valid" },
  { key: "edge_cases_checked", label: "Edge cases checked" },
];

export function EvaluationPanel({ evaluation, emptyText }: { evaluation: Evaluation | null; emptyText?: string }) {
  if (!evaluation) return <p className="text-xs text-muted">{emptyText ?? "No evaluation yet."}</p>;
  const e = evaluation;

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {CHECKS.map(({ key, label }) => (
          <CheckRow key={key} label={label} value={e[key] as boolean | undefined} />
        ))}
      </ul>

      {e.confidence_score != null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted">Confidence</span>
            <span className="tabular-nums">{(e.confidence_score * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.round(e.confidence_score * 100)}%` }}
            />
          </div>
        </div>
      )}

      {e.human_review_needed != null && (
        <Badge tone={e.human_review_needed ? "warning" : "success"}>
          {e.human_review_needed ? (
            <>
              <AlertTriangle size={11} /> Human review needed
            </>
          ) : (
            <>
              <Check size={11} /> No review needed
            </>
          )}
        </Badge>
      )}

      {!!e.warnings?.length && <Notes title="Warnings" items={e.warnings} tone="warning" />}
      {!!e.errors?.length && <Notes title="Errors" items={e.errors} tone="error" />}
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: boolean | undefined }) {
  const icon =
    value === true ? (
      <Check size={13} className="text-emerald-400" />
    ) : value === false ? (
      <X size={13} className="text-red-400" />
    ) : (
      <Minus size={13} className="text-muted" />
    );
  return (
    <li className="flex items-center gap-2 text-xs">
      {icon}
      <span className={value === undefined ? "text-muted" : ""}>{label}</span>
    </li>
  );
}

function Notes({ title, items, tone }: { title: string; items: string[]; tone: "warning" | "error" }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-2.5">
      <p className={`text-[11px] font-medium mb-1 ${tone === "error" ? "text-red-300" : "text-amber-300"}`}>
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-[11px] text-muted">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
