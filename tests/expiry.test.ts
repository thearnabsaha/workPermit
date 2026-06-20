import { describe, it, expect } from "vitest";
import { analyzeExpiry, parseDate } from "@/lib/agents/expiry";

describe("parseDate", () => {
  it("parses ISO dates", () => {
    expect(parseDate("2027-03-14")?.toISOString().slice(0, 10)).toBe("2027-03-14");
  });
  it("parses DD.MM.YYYY", () => {
    expect(parseDate("14.03.2027")?.toISOString().slice(0, 10)).toBe("2027-03-14");
  });
  it("returns null for garbage", () => {
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("analyzeExpiry", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("flags expired documents", () => {
    const e = analyzeExpiry("2025-06-01", now);
    expect(e.expired).toBe(true);
    expect(e.days_remaining).toBeLessThan(0);
    expect(e.within_30).toBe(false);
  });

  it("flags documents expiring within 30 days", () => {
    const e = analyzeExpiry("2026-01-20", now);
    expect(e.expired).toBe(false);
    expect(e.within_30).toBe(true);
    expect(e.within_60).toBe(true);
    expect(e.within_90).toBe(true);
  });

  it("flags within_90 but not within_30/60", () => {
    const e = analyzeExpiry("2026-03-25", now);
    expect(e.within_30).toBe(false);
    expect(e.within_60).toBe(false);
    expect(e.within_90).toBe(true);
  });

  it("handles far-future dates", () => {
    const e = analyzeExpiry("2030-01-01", now);
    expect(e.within_90).toBe(false);
    expect(e.days_remaining).toBeGreaterThan(90);
  });

  it("returns empty analysis when no date", () => {
    const e = analyzeExpiry(null);
    expect(e.expiry_date).toBeNull();
    expect(e.days_remaining).toBeNull();
  });
});
