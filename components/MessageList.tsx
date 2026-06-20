"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, User } from "lucide-react";
import type { Message } from "@/lib/types";
import { Markdown } from "./Markdown";
import { cn } from "@/lib/utils";

export function MessageList({ messages, streaming, emptySubtitle }: { messages: Message[]; streaming: boolean; emptySubtitle?: string }) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content / streaming.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
      {messages.length === 0 && (
        <div className="h-full flex items-center justify-center text-center text-muted text-sm px-8">
          <p className="max-w-sm leading-relaxed">
            {emptySubtitle ?? "Describe a company problem or upload files. The agent will stream workflow steps, produce a structured result, and show evaluation checks."}
          </p>
        </div>
      )}
      <AnimatePresence initial={false}>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
          >
            {m.role === "assistant" && <Avatar role="assistant" />}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5",
                m.role === "user"
                  ? "bg-accent text-bg rounded-br-sm"
                  : "bg-surface border border-border rounded-bl-sm"
              )}
            >
              {m.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              ) : (
                <Markdown>{m.content || "…"}</Markdown>
              )}
            </div>
            {m.role === "user" && <Avatar role="user" />}
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "h-8 w-8 shrink-0 rounded-full grid place-items-center border border-border",
        role === "assistant" ? "bg-accent/15 text-accent" : "bg-surface text-muted"
      )}
    >
      {role === "assistant" ? <Sparkles size={15} /> : <User size={15} />}
    </div>
  );
}
