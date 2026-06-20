import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { z } from "zod";
import { config } from "../config";
import { logger } from "../logger";

// Thin LangChain wrappers around Gemini. The rest of the app talks to these,
// never to the SDK directly, so the model is swappable in one place.

let _chat: ChatGoogleGenerativeAI | null = null;
export function getChatModel(): ChatGoogleGenerativeAI {
  if (!_chat) {
    _chat = new ChatGoogleGenerativeAI({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      temperature: 0,
      maxRetries: 2,
    });
  }
  return _chat;
}

let _embeddings: GoogleGenerativeAIEmbeddings | null = null;
export function getEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (!_embeddings) {
    _embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.geminiApiKey,
      model: config.embeddingModel,
    });
  }
  return _embeddings;
}

/** Pull the first balanced JSON object out of a model response. */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON object in model response");
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error("Unbalanced JSON in model response");
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : (p as { text?: string }).text ?? ""))
      .join("");
  }
  return String(content ?? "");
}

export interface StructuredOptions<T> {
  system?: string;
  user: string;
  schema: z.ZodType<T>;
  /** Optional data URLs (data:image/...;base64,...) for best-effort visual analysis. */
  images?: string[];
}

/**
 * Calls Gemini and validates the JSON response against a zod schema.
 * Retries once with a stricter instruction if the first parse/validation fails.
 * Throws if it still cannot produce a valid object (caller falls back to mock).
 */
export async function generateStructured<T>(opts: StructuredOptions<T>): Promise<T> {
  const model = getChatModel();

  const buildHuman = (extra = "") => {
    const textPart = { type: "text" as const, text: opts.user + extra };
    if (opts.images?.length) {
      const imageParts = opts.images.map((url) => ({ type: "image_url" as const, image_url: url }));
      return new HumanMessage({ content: [textPart, ...imageParts] });
    }
    return new HumanMessage(opts.user + extra);
  };

  const system = new SystemMessage(opts.system ?? "Respond with valid JSON only.");

  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt === 0 ? "" : "\n\nYour previous answer was not valid JSON matching the schema. Respond again with ONLY the JSON object.";
    const res = await model.invoke([system, buildHuman(extra)]);
    try {
      const json = extractJson(messageText(res.content));
      const parsed = opts.schema.safeParse(json);
      if (parsed.success) return parsed.data;
      logger.warn("gemini.schema_invalid", { attempt, issues: parsed.error.issues.length });
    } catch (err) {
      logger.warn("gemini.parse_failed", { attempt, error: (err as Error).message });
    }
  }
  throw new Error("Gemini did not return a schema-valid response");
}

/** Cosine similarity for embedding vectors (duplicate/similarity detection). */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
