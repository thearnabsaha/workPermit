import { describe, it, expect } from "vitest";
import { runPipelineStream } from "@/lib/agents/run";
import type { StreamEvent } from "@/lib/types";
import type { InputFile } from "@/lib/ocr";

const VALID_PERMIT = `Bundesagentur für Arbeit
WORK PERMIT / ARBEITSERLAUBNIS
Name: Maria Santos
Permit Number: DE-WP-2024-558102
Country: Germany
Issuing Authority: Bundesagentur für Arbeit
Issue Date: 2024-03-15
Expiry Date: 2031-03-14
Residence Status: Authorized to work`;

async function collect(files: InputFile[], message: string): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of runPipelineStream(files, message)) out.push(e);
  return out;
}

describe("end-to-end mock pipeline (stream contract)", () => {
  it("emits the full event sequence and always ends with done", async () => {
    const events = await collect(
      [{ name: "permit.txt", mime: "text/plain", buffer: Buffer.from(VALID_PERMIT) }],
      "Validate this permit"
    );

    // Required: terminates with exactly one trailing done event.
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.filter((e) => e.type === "done")).toHaveLength(1);

    // Trace steps from multiple agents are present.
    const steps = events.filter((e) => e.type === "trace").map((e: any) => e.step);
    expect(steps).toContain("file_extraction");
    expect(steps).toContain("document_classification");
    expect(steps).toContain("analytics");

    // A work_permit artifact is produced with the expected classification.
    const artifact = events.find((e) => e.type === "artifact") as any;
    expect(artifact).toBeTruthy();
    expect(artifact.artifact_type).toBe("work_permit");
    expect(artifact.data.document_type).toBe("Work Permit");
    expect(artifact.data.validation_status).toBe("Valid");
    expect(artifact.data.fields.holder_name).toBe("Maria Santos");

    // An evaluation is emitted.
    expect(events.some((e) => e.type === "evaluation")).toBe(true);
  });

  it("routes an unknown/empty input to a safe 'Unable to Verify' result", async () => {
    const events = await collect([], "is this valid?");
    const artifact = events.find((e) => e.type === "artifact") as any;
    expect(artifact.data.document_type).toBe("Unknown");
    expect(artifact.data.requires_human_review).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });
});
