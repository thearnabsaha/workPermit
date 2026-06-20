import { describe, it, expect } from "vitest";
import { mockClassify, mockExtract, mockValidate, mockRisk, mockRecommend } from "@/lib/ai/mock";

const VALID_PERMIT = `Bundesagentur für Arbeit
WORK PERMIT / ARBEITSERLAUBNIS
Name: Maria Santos
Permit Number: DE-WP-2024-558102
Country: Germany
Issuing Authority: Bundesagentur für Arbeit
Issue Date: 2024-03-15
Expiry Date: 2031-03-14`;

describe("mockClassify", () => {
  it("classifies a work permit by keyword", () => {
    const r = mockClassify(VALID_PERMIT);
    expect(r.document_type).toBe("Work Permit");
    expect(r.classification_confidence).toBeGreaterThan(0.5);
  });
  it("classifies a residence permit", () => {
    expect(mockClassify("Aufenthaltstitel residence permit").document_type).toBe("Residence Permit");
  });
  it("classifies a passport", () => {
    expect(mockClassify("REISEPASS / PASSPORT").document_type).toBe("Passport");
  });
  it("returns Unknown for short/irrelevant text", () => {
    expect(mockClassify("hi").document_type).toBe("Unknown");
  });
});

describe("mockExtract", () => {
  it("extracts the key fields", () => {
    const f = mockExtract(VALID_PERMIT);
    expect(f.holder_name).toBe("Maria Santos");
    expect(f.permit_number).toContain("DE-WP-2024-558102");
    expect(f.country).toBe("Germany");
    expect(f.issue_date).toBe("2024-03-15");
    expect(f.expiry_date).toBe("2031-03-14");
  });
});

describe("mockValidate + mockRisk + mockRecommend", () => {
  it("marks a complete, consistent permit as valid + low risk", () => {
    const fields = mockExtract(VALID_PERMIT);
    const v = mockValidate(fields, 0.95);
    expect(v.validation_status).toBe("Valid");
    const risk = mockRisk(v, 0.95);
    expect(risk.risk_score).toBeLessThan(33);
    const rec = mockRecommend({ validationStatus: v.validation_status, riskScore: risk.risk_score, expired: false, fieldsComplete: v.fields_complete });
    expect(rec.recommendation).toBe("Likely Valid");
    expect(rec.requires_human_review).toBe(false);
  });

  it("flags inconsistent dates as possibly invalid + high risk", () => {
    const fields = mockExtract(`WORK PERMIT
Name: Ivan Petrov
Issue Date: 2025-12-01
Expiry Date: 2024-11-30`);
    const v = mockValidate(fields, 0.5);
    expect(v.tampering_indicators.length).toBeGreaterThan(0);
    expect(v.validation_status).toBe("Possibly Invalid");
    const risk = mockRisk(v, 0.5);
    expect(risk.risk_score).toBeGreaterThan(40);
    const rec = mockRecommend({ validationStatus: v.validation_status, riskScore: risk.risk_score, expired: true, fieldsComplete: v.fields_complete });
    expect(rec.requires_human_review).toBe(true);
  });
});
