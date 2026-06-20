"use client";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Eye } from "lucide-react";
import type { ReviewStatus } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

// UI-only review status. No persistence — wire to backend later if needed.
const STATUS_META: Record<Exclude<ReviewStatus, "none">, { label: string; tone: "success" | "error" | "warning" }> = {
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
  needs_review: { label: "Needs review", tone: "warning" },
};

export function HumanReviewControls({
  status,
  onChange,
}: {
  status: ReviewStatus;
  onChange: (s: ReviewStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => onChange("approved")}>
        <ThumbsUp size={13} /> Approve
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange("rejected")}>
        <ThumbsDown size={13} /> Reject
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange("needs_review")}>
        <Eye size={13} /> Needs review
      </Button>
      {status !== "none" && (
        <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
          <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>
        </motion.div>
      )}
    </div>
  );
}
