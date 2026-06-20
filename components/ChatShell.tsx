"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Activity, FileBox, ClipboardCheck, ListTree } from "lucide-react";
import type { Artifact, Evaluation, Message, ReviewStatus, TraceStep } from "@/lib/types";
import { TASK_CONFIG } from "@/lib/taskConfig";
import { runAgent } from "@/lib/api";
import { consumeStream } from "@/lib/streamClient";
import { genericEvents, type DemoScenario } from "@/lib/mockEvents";
import { uid } from "@/lib/utils";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { FileUpload, revokeUploadedFile, type UploadedFile } from "./FileUpload";
import { AgentTrace } from "./AgentTrace";
import { ArtifactRenderer } from "./ArtifactRenderer";
import { EvaluationPanel } from "./EvaluationPanel";
import { HumanReviewControls } from "./HumanReviewControls";
import { Card, CardHeader, CardTitle, CardBody } from "./ui/card";
import { Badge } from "./ui/badge";

type RunStatus = "idle" | "running" | "done" | "error";

const { features, labels } = TASK_CONFIG;

export function ChatShell() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [review, setReview] = useState<ReviewStatus>("none");
  const [status, setStatus] = useState<RunStatus>("idle");
  // humanReviewRequired: true when backend signals review is needed via any channel
  const [humanReviewRequired, setHumanReviewRequired] = useState(false);

  const running = status === "running";

  // Derived visibility — config flag OR backend data triggers panel visibility.
  const showEval = features.showEvaluationPanel || evaluation !== null;
  const showReview = features.showHumanReviewControls || humanReviewRequired;

  function reset() {
    setMessages([]);
    setInput("");
    setFiles((prev) => { prev.forEach(revokeUploadedFile); return []; });
    setSteps([]);
    setArtifact(null);
    setEvaluation(null);
    setReview("none");
    setStatus("idle");
    setHumanReviewRequired(false);
  }

  function pushTrace(e: { step: string; status: TraceStep["status"]; message?: string; durationMs?: number; details?: string; label?: string }) {
    setSteps((prev) => {
      const last = prev[prev.length - 1];
      const step: TraceStep = { step: e.step, status: e.status, message: e.message, durationMs: e.durationMs, details: e.details, label: e.label };
      if (last && last.step === e.step && last.status !== "done") {
        return [...prev.slice(0, -1), step];
      }
      return [...prev, step];
    });
  }

  async function run(message: string, mockEventsOverride?: typeof genericEvents, sendFiles?: UploadedFile[]) {
    const userMsg: Message = { id: uid(), role: "user", content: message };
    const assistantId = uid();
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setSteps([]);
    setArtifact(null);
    setEvaluation(null);
    setReview("none");
    setHumanReviewRequired(false);
    setStatus("running");

    const filesToSend = (sendFiles ?? files).map((f) => f.file).filter(Boolean) as File[];
    const events = runAgent({
      message,
      taskId: TASK_CONFIG.taskId,
      files: filesToSend,
      mockEvents: mockEventsOverride ?? genericEvents, // BACKEND INTEGRATION: remove mockEvents to use real endpoint
    });

    let receivedDone = false;
    try {
      await consumeStream(events, {
        onTrace: (e) => pushTrace(e),
        onPartial: (text) =>
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + text } : msg))
          ),
        onArtifact: (e) => {
          const a = { artifact_type: e.artifact_type, ...(e.data as object) } as Artifact;
          setArtifact(a);
          // Artifact may signal human review directly (e.g. invoice requires_human_review)
          if ((a as any).requires_human_review) {
            setHumanReviewRequired(true);
            setReview("needs_review");
          }
        },
        onEvaluation: (e) => {
          setEvaluation(e.data);
          if (e.data.human_review_needed) {
            setHumanReviewRequired(true);
            setReview("needs_review");
          }
        },
        onHumanReview: (e) => {
          if (e.required) {
            setHumanReviewRequired(true);
            setReview("needs_review");
            // Surface the reason as a visible warning trace step (INSTRUCTIONS.md §7)
            pushTrace({ step: "human_review", status: "warning", message: e.reason ?? "Human review required" });
          }
        },
        onError: (msg) => {
          setStatus("error");
          setMessages((m) =>
            m.map((x) => (x.id === assistantId ? { ...x, content: x.content + `\n\n**Error:** ${msg}` } : x))
          );
        },
        onDone: () => { receivedDone = true; setStatus((s) => (s === "error" ? s : "done")); },
      });
    } catch (err) {
      // stream disconnect after fetch succeeds — don't leave UI locked in "running"
      const msg = err instanceof Error ? err.message : "Stream disconnected";
      setMessages((m) =>
        m.map((x) => (x.id === assistantId ? { ...x, content: x.content + `\n\n**Error:** ${msg}` } : x))
      );
      setStatus("error");
      return;
    }
    // Clean EOF without a "done" event = truncated stream; treat as error.
    if (!receivedDone) {
      setMessages((m) =>
        m.map((x) => (x.id === assistantId ? { ...x, content: x.content + `\n\n**Error:** Stream ended without a completion signal.` } : x))
      );
      setStatus("error");
    }
  }

  function handleSend() {
    if (!input.trim() || running) return;
    run(input.trim());
  }

  function handleSample() {
    if (TASK_CONFIG.sampleInput) setInput(TASK_CONFIG.sampleInput);
  }

  function handleDevSample(demo: DemoScenario) {
    if (running) return;
    setFiles((prev) => { prev.forEach(revokeUploadedFile); return []; });
    const demoFile: UploadedFile = { id: uid(), ...demo.file };
    setFiles([demoFile]);
    run(demo.sampleInput, demo.events, [demoFile]);
  }

  return (
    <div className="h-screen flex flex-col">
      <Header status={status} />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_minmax(360px,440px)]">
        {/* Chat column */}
        <div className="flex flex-col min-h-0 border-r border-border">
          <MessageList messages={messages} streaming={running} emptySubtitle={TASK_CONFIG.subtitle} />
          <Composer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onReset={reset}
            onSample={handleSample}
            onDevSample={handleDevSample}
            placeholder={TASK_CONFIG.placeholder}
            hasSampleInput={!!TASK_CONFIG.sampleInput}
            disabled={running}
          />
        </div>

        {/* Side panels — each is optional via features config or backend events */}
        <div className="overflow-y-auto p-4 space-y-4 bg-bg/40">
          <Panel icon={<FileBox size={14} />} title="Files">
            <FileUpload
              files={files}
              onAdd={(f) => setFiles((prev) => [...prev, ...f])}
              onRemove={(id) => setFiles((prev) => {
                const f = prev.find((x) => x.id === id);
                if (f) revokeUploadedFile(f);
                return prev.filter((x) => x.id !== id);
              })}
              disabled={running}
              multiple={features.allowMultipleFiles}
            />
          </Panel>

          {features.showTracePanel && (
            <Panel icon={<ListTree size={14} />} title="Agent trace">
              <AgentTrace steps={steps} emptyText={labels.emptyTraceText} />
            </Panel>
          )}

          {features.showArtifactPanel && (
            <Panel icon={<Sparkles size={14} />} title="Artifact">
              {artifact ? (
                <ArtifactRenderer artifact={artifact} />
              ) : (
                <p className="text-xs text-muted">{labels.emptyArtifactText}</p>
              )}
            </Panel>
          )}

          {/* Evaluation panel: shown if config flag is true OR backend sent an evaluation event */}
          {showEval && (
            <Panel icon={<ClipboardCheck size={14} />} title="Evaluation">
              <div className="space-y-3">
                <EvaluationPanel evaluation={evaluation} emptyText={labels.emptyEvaluationText} />
                {/* Human review: shown if config flag is true OR backend signalled review required */}
                {showReview && (
                  <div className="border-t border-border pt-3">
                    <HumanReviewControls status={review} onChange={setReview} />
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ status }: { status: RunStatus }) {
  const tone = status === "running" ? "accent" : status === "error" ? "error" : status === "done" ? "success" : "muted";
  const label = status === "running" ? "Running" : status === "error" ? "Error" : status === "done" ? "Done" : "Idle";
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 h-14 shrink-0">
      <div className="h-7 w-7 rounded-lg bg-accent/15 grid place-items-center text-accent">
        <Sparkles size={16} />
      </div>
      <span className="font-semibold tracking-tight">{TASK_CONFIG.projectName}</span>
      <Badge tone="neutral">{TASK_CONFIG.modelLabel}</Badge>
      <div className="ml-auto flex items-center gap-2">
        <Badge tone={tone as any}>
          <Activity size={11} className={status === "running" ? "animate-pulse" : ""} /> {label}
        </Badge>
      </div>
    </header>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardHeader className="flex items-center gap-2">
          <span className="text-muted">{icon}</span>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardBody>{children}</CardBody>
      </Card>
    </motion.div>
  );
}
