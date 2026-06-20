import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function prettyStep(step: string): string {
  return step.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function uid(): string {
  // ponytail: not crypto-strong; fine for UI keys. Swap to crypto.randomUUID if collisions matter.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
