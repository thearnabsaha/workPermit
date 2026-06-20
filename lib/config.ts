// Central runtime configuration. All env access funnels through here so the
// rest of the code stays testable and the "hybrid" real/mock behavior is
// decided in one place.

function env(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export const config = {
  /** Gemini API key (the only paid dependency). Accept common env names. */
  geminiApiKey: env("GOOGLE_API_KEY", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"),

  /** Gemini chat model. Override with GEMINI_MODEL. */
  geminiModel: env("GEMINI_MODEL") || "gemini-2.5-flash",

  /** Gemini embedding model used for duplicate/similarity detection. */
  embeddingModel: env("GEMINI_EMBEDDING_MODEL") || "text-embedding-004",

  /** Tesseract OCR languages (e.g. "eng+deu"). */
  ocrLanguages: env("OCR_LANGS") || "eng+deu",

  /** Force the deterministic mock pipeline even if a key is present. */
  forceMock: env("FORCE_MOCK") === "1" || env("NEXT_PUBLIC_USE_MOCK") === "1",
};

/** True when the real Gemini path should be used. */
export function hasGemini(): boolean {
  return !config.forceMock && config.geminiApiKey.length > 0;
}
