"use client";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, FileText } from "lucide-react";
import type {
  Artifact,
  InvoiceArtifact,
  CandidateArtifact,
  VideoArtifact,
  TableArtifact,
  WorkPermitArtifact,
  WorkPermitFields,
} from "@/lib/types";
import { Badge } from "./ui/badge";
import { Markdown } from "./Markdown";

// Flexible renderer dispatched on artifact_type. Add product artifacts by
// adding a case + a small component. Unknown types fall back to JSON.
export function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  switch (artifact.artifact_type) {
    case "work_permit":
      return <WorkPermitCard a={artifact as WorkPermitArtifact} />;
    case "invoice":
      return <InvoiceCard a={artifact as InvoiceArtifact} />;
    case "candidate":
      return <CandidateCard a={artifact as CandidateArtifact} />;
    case "video":
      return <VideoCard a={artifact as VideoArtifact} />;
    case "table":
      return <TableCard a={artifact as TableArtifact} />;
    case "markdown":
    case "text":
      return <Markdown>{(artifact as any).content ?? ""}</Markdown>;
    case "image":
      return (
        <figure>
          <img src={(artifact as any).url} alt={(artifact as any).title ?? "image"} className="rounded-lg border border-border" />
          {(artifact as any).title && <figcaption className="mt-1 text-xs text-muted">{(artifact as any).title}</figcaption>}
        </figure>
      );
    default:
      return <JsonBlock title={(artifact as any).title} data={(artifact as any).data ?? artifact} />;
  }
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

function confTone(c: number) {
  return c >= 0.8 ? "success" : c >= 0.6 ? "warning" : "error";
}

function InvoiceCard({ a }: { a: InvoiceArtifact }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{a.vendor}</span>
        <Badge tone="muted">{a.invoice_id}</Badge>
        <Badge tone="accent">{money(a.total_amount, a.currency)}</Badge>
        {a.requires_human_review && (
          <Badge tone="warning">
            <AlertTriangle size={11} /> Review needed
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-bg text-muted">
            <tr>
              <Th>Line item</Th>
              <Th>Team</Th>
              <Th className="text-right">Amount</Th>
              <Th>Confidence</Th>
            </tr>
          </thead>
          <tbody>
            {a.assignments.map((x, i) => (
              <tr key={i} className="border-t border-border">
                <Td>
                  <div>{x.line_item}</div>
                  <div className="text-[10px] text-muted">{x.reason}</div>
                </Td>
                <Td>{x.team}</Td>
                <Td className="text-right tabular-nums">{money(x.amount, a.currency)}</Td>
                <Td>
                  <Badge tone={confTone(x.confidence)}>{(x.confidence * 100).toFixed(0)}%</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(a.team_totals).map(([team, total]) => (
          <Badge key={team} tone="neutral">
            {team}: {money(total, a.currency)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CandidateCard({ a }: { a: CandidateArtifact }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{a.name}</span>
        {a.role && <Badge tone="muted">{a.role}</Badge>}
        {a.match_score != null && (
          <Badge tone={confTone(a.match_score)}>{(a.match_score * 100).toFixed(0)}% fit</Badge>
        )}
      </div>
      <p className="text-sm text-muted">{a.summary}</p>
      {a.skills && (
        <div className="flex flex-wrap gap-1.5">
          {a.skills.map((s) => (
            <Badge key={s} tone="neutral">{s}</Badge>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {a.strengths && <List title="Strengths" items={a.strengths} tone="success" />}
        {a.concerns && <List title="Concerns" items={a.concerns} tone="warning" />}
      </div>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted mb-1">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5 text-xs">
            <span className={tone === "success" ? "text-emerald-400" : "text-amber-400"}>•</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VideoCard({ a }: { a: VideoArtifact }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{a.title}</span>
        <Badge tone="accent">{a.status}</Badge>
      </div>
      {/* Falls back to a placeholder card if the asset 404s. */}
      <video
        src={a.video_url}
        controls
        className="w-full rounded-lg border border-border bg-black"
        onError={(e) => ((e.currentTarget.style.display = "none"))}
      />
      <ol className="space-y-2">
        {a.scenes.map((s, i) => (
          <li key={i} className="rounded-lg border border-border bg-bg p-2.5">
            <div className="flex items-center gap-2">
              <Badge tone="muted">{s.time_range}</Badge>
            </div>
            <p className="mt-1 text-xs">{s.prompt}</p>
            {s.voiceover && <p className="mt-1 text-[11px] italic text-muted">“{s.voiceover}”</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function TableCard({ a }: { a: TableArtifact }) {
  return (
    <div className="space-y-2">
      {a.title && <p className="text-sm font-semibold">{a.title}</p>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-bg text-muted">
            <tr>{a.columns.map((c) => <Th key={c}>{c}</Th>)}</tr>
          </thead>
          <tbody>
            {a.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {row.map((cell, j) => <Td key={j}>{String(cell)}</Td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JsonBlock({ title, data }: { title?: string; data: unknown }) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold">{title}</p>}
      <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-3 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2.5 py-1.5 text-left font-semibold ${className ?? ""}`}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2.5 py-1.5 align-top ${className ?? ""}`}>{children}</td>;
}

// ---- Work permit validation card -----------------------------------------

function statusTone(s: string): "success" | "warning" | "error" | "muted" {
  if (s === "Valid" || s === "Likely Valid") return "success";
  if (s === "Needs Review" || s === "Needs Human Review" || s === "Document Incomplete") return "warning";
  if (s === "Possibly Invalid" || s === "Likely Invalid") return "error";
  return "muted";
}

function riskTone(score: number): "success" | "warning" | "error" {
  return score <= 33 ? "success" : score <= 66 ? "warning" : "error";
}

const FIELD_LABELS: { key: keyof WorkPermitFields; label: string }[] = [
  { key: "holder_name", label: "Holder name" },
  { key: "nationality", label: "Nationality" },
  { key: "permit_number", label: "Permit number" },
  { key: "permit_type", label: "Permit type" },
  { key: "country", label: "Country" },
  { key: "issuing_authority", label: "Issuing authority" },
  { key: "issue_date", label: "Issue date" },
  { key: "expiry_date", label: "Expiry date" },
  { key: "document_number", label: "Document number" },
  { key: "visa_category", label: "Visa category" },
  { key: "residence_status", label: "Residence status" },
  { key: "employer_restrictions", label: "Employer restrictions" },
  { key: "occupation_restrictions", label: "Occupation restrictions" },
  { key: "notes", label: "Notes" },
];

function WorkPermitCard({ a }: { a: WorkPermitArtifact }) {
  return (
    <div className="space-y-4">
      {/* Headline status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">
          <FileText size={11} /> {a.document_type}
        </Badge>
        <Badge tone="muted">{(a.classification_confidence * 100).toFixed(0)}% match</Badge>
        <Badge tone={statusTone(a.validation_status)}>{a.validation_status}</Badge>
        {a.detected_language && a.detected_language.toLowerCase() !== "english" && (
          <Badge tone="muted">{a.detected_language}</Badge>
        )}
      </div>

      {/* Recommendation banner */}
      <div className={`rounded-lg border p-3 ${
        statusTone(a.recommendation) === "success"
          ? "border-emerald-500/30 bg-emerald-500/10"
          : statusTone(a.recommendation) === "error"
          ? "border-red-500/30 bg-red-500/10"
          : "border-amber-500/30 bg-amber-500/10"
      }`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {statusTone(a.recommendation) === "success" ? (
            <CheckCircle2 size={15} className="text-emerald-400" />
          ) : (
            <AlertTriangle size={15} className="text-amber-400" />
          )}
          {a.recommendation}
        </div>
        <p className="mt-1 text-[11px] text-muted">
          AI assistance only — the final hiring and legal decision is made by a human reviewer.
        </p>
      </div>

      {/* Meters */}
      <div className="grid grid-cols-1 gap-3">
        <Meter label="Overall confidence" value={a.confidence_score} tone={confTone(a.confidence_score)} pct />
        <Meter label="OCR confidence" value={a.ocr_confidence} tone={confTone(a.ocr_confidence)} pct />
        <Meter label="Risk score" value={a.risk_score / 100} tone={riskTone(a.risk_score)} display={`${a.risk_score}/100`} />
      </div>

      {/* Expiry */}
      <ExpiryRow a={a} />

      {/* Extracted fields */}
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">Extracted fields</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-border bg-bg p-3">
          {FIELD_LABELS.map(({ key, label }) => {
            const v = a.fields[key];
            return (
              <div key={key} className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
                <span className={`text-xs ${v ? "" : "italic text-muted"}`}>{v ?? "Not found"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI reasoning */}
      {!!a.reasons?.length && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted mb-1">AI reasoning</p>
          <ul className="space-y-1">
            {a.reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-xs">
                <span className="text-accent">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.requires_human_review && (
        <Badge tone="warning">
          <AlertTriangle size={11} /> Human review required before any decision
        </Badge>
      )}

      {!!a.source_documents?.length && (
        <p className="text-[10px] text-muted">
          Source: {a.source_documents.join(", ")}
        </p>
      )}
    </div>
  );
}

function Meter({
  label,
  value,
  tone,
  pct,
  display,
}: {
  label: string;
  value: number; // 0..1 for bar width
  tone: "success" | "warning" | "error";
  pct?: boolean;
  display?: string;
}) {
  const barColor =
    tone === "success" ? "bg-emerald-400" : tone === "warning" ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{display ?? (pct ? `${Math.round(value * 100)}%` : value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, Math.round(value * 100)))}%` }} />
      </div>
    </div>
  );
}

function ExpiryRow({ a }: { a: WorkPermitArtifact }) {
  const e = a.expiry;
  let tone: "success" | "warning" | "error" | "muted" = "muted";
  let text = "Expiry date not found";
  if (e.expiry_date) {
    if (e.expired) {
      tone = "error";
      text = `Expired${e.days_remaining != null ? ` ${Math.abs(e.days_remaining)} days ago` : ""}`;
    } else if (e.days_remaining != null) {
      text = `${e.days_remaining} days remaining`;
      tone = e.within_30 ? "error" : e.within_60 ? "warning" : e.within_90 ? "warning" : "success";
    }
  }
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center gap-2 text-xs">
        <Clock size={13} className="text-muted" />
        <span className="text-muted">Validity</span>
        <Badge tone={tone}>{text}</Badge>
        {e.expiry_date && <span className="text-muted">until {e.expiry_date}</span>}
      </div>
      {!e.expired && e.expiry_date && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {e.within_30 && <Badge tone="error"><ShieldAlert size={10} /> Expires within 30 days</Badge>}
          {!e.within_30 && e.within_60 && <Badge tone="warning">Expires within 60 days</Badge>}
          {!e.within_60 && e.within_90 && <Badge tone="warning">Expires within 90 days</Badge>}
        </div>
      )}
    </div>
  );
}
