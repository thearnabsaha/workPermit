import type { ExpiryAnalysis } from "../types";

const EMPTY: ExpiryAnalysis = {
  expiry_date: null,
  days_remaining: null,
  expired: false,
  within_30: false,
  within_60: false,
  within_90: false,
};

/** Parse ISO (YYYY-MM-DD) or common DD.MM.YYYY / DD/MM/YYYY date strings. */
export function parseDate(value: string): Date | null {
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const dmy = value.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
    const d = new Date(Date.UTC(year, +dmy[2] - 1, +dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Compute remaining validity + warning windows relative to `now`. */
export function analyzeExpiry(expiryDate?: string | null, now: Date = new Date()): ExpiryAnalysis {
  if (!expiryDate) return { ...EMPTY };
  const d = parseDate(expiryDate);
  if (!d) return { ...EMPTY };

  const msPerDay = 86_400_000;
  const days = Math.floor((d.getTime() - now.getTime()) / msPerDay);
  const expired = days < 0;
  const iso = d.toISOString().slice(0, 10);

  return {
    expiry_date: iso,
    days_remaining: days,
    expired,
    within_30: !expired && days <= 30,
    within_60: !expired && days <= 60,
    within_90: !expired && days <= 90,
  };
}
