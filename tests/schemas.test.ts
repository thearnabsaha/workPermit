import { describe, it, expect } from "vitest";
import { ClassificationSchema, ExtractionSchema, RecommendationSchema, RiskSchema } from "@/lib/ai/schemas";

describe("zod output schemas (hallucination/format guard)", () => {
  it("accepts a valid classification", () => {
    expect(ClassificationSchema.safeParse({ document_type: "Work Permit", classification_confidence: 0.9 }).success).toBe(true);
  });
  it("rejects an unknown document_type", () => {
    expect(ClassificationSchema.safeParse({ document_type: "Banana", classification_confidence: 0.9 }).success).toBe(false);
  });
  it("rejects out-of-range confidence", () => {
    expect(ClassificationSchema.safeParse({ document_type: "Visa", classification_confidence: 5 }).success).toBe(false);
  });
  it("accepts extraction with null fields", () => {
    const r = ExtractionSchema.safeParse({ holder_name: null, expiry_date: "2030-01-01" });
    expect(r.success).toBe(true);
  });
  it("rejects an out-of-range risk score", () => {
    expect(RiskSchema.safeParse({ risk_score: 200, anomalies: [], confidence: 0.5 }).success).toBe(false);
  });
  it("rejects an invalid recommendation value", () => {
    expect(
      RecommendationSchema.safeParse({ recommendation: "Hire", reasons: [], requires_human_review: false, confidence: 0.5 }).success
    ).toBe(false);
  });
});
