"use client";
import { useRef, useState } from "react";
import { Send, RotateCcw, Wand2, FlaskConical, ChevronDown } from "lucide-react";
import { DEV_SAMPLES, type DemoScenario } from "@/lib/mockEvents";
import { TASK_CONFIG } from "@/lib/taskConfig";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function Composer({
  value,
  onChange,
  onSend,
  onReset,
  onSample,
  onDevSample,
  placeholder,
  hasSampleInput,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onReset: () => void;
  onSample: () => void;
  onDevSample: (d: DemoScenario) => void;
  placeholder: string;
  hasSampleInput: boolean;
  disabled: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [devOpen, setDevOpen] = useState(false);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  }

  return (
    <div className="border-t border-border bg-bg/80 backdrop-blur px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder={`${placeholder}  (Enter to send, Shift+Enter for newline)`}
          className="flex-1 resize-none max-h-40 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent/50"
        />
        <Button onClick={onSend} disabled={disabled || !value.trim()} size="icon" aria-label={TASK_CONFIG.labels.runButton}>
          <Send size={16} />
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {hasSampleInput && (
          <Button variant="subtle" size="sm" onClick={onSample} disabled={disabled}>
            <Wand2 size={13} /> Sample input
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onReset} disabled={disabled}>
          <RotateCcw size={13} /> Reset
        </Button>

        {/* Developer samples — collapsed by default, not shown as primary nav */}
        <div className="relative ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDevOpen((o) => !o)}
            disabled={disabled}
            className="text-muted hover:text-fg"
          >
            <FlaskConical size={12} />
            Dev samples
            <ChevronDown size={12} className={cn("transition-transform", devOpen && "rotate-180")} />
          </Button>
          {devOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-52 rounded-xl border border-border bg-surface shadow-lg overflow-hidden z-10">
              {DEV_SAMPLES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setDevOpen(false); onDevSample(d); }}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-bg transition-colors"
                >
                  <div className="font-medium">{d.title}</div>
                  <div className="text-muted mt-0.5 text-[11px]">{d.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
