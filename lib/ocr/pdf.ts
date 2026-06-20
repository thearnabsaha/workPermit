import type { OcrResult, OcrPageResult } from "./types";
import { logger } from "../logger";

// Node 21 lacks Promise.withResolvers, which the bundled pdfjs uses. Polyfill it
// once so PDF parsing works on Node < 22 too.
if (typeof (Promise as any).withResolvers !== "function") {
  (Promise as any).withResolvers = function withResolvers<T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (e?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Extracts the embedded text layer from a digital PDF using unpdf (a Node/
// serverless-friendly pdfjs build — no worker file or DOM required). Most real
// permits are digital PDFs, so this is fast and lossless. Scanned PDFs with no
// text layer return empty text + low confidence, which the pipeline treats as
// "needs review" rather than failing.
export async function extractPdfText(buffer: Buffer): Promise<OcrResult> {
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text, totalPages } = await extractText(pdf, { mergePages: false });

    const perPage: string[] = Array.isArray(text) ? text : [String(text ?? "")];
    const pages: OcrPageResult[] = perPage.map((t, i) => {
      const clean = (t ?? "").replace(/\s+/g, " ").trim();
      return { page: i + 1, text: clean, confidence: clean.length > 0 ? 0.97 : 0 };
    });

    const fullText = pages.map((p) => p.text).join("\n").trim();
    const hasText = fullText.length > 0;
    return {
      text: fullText,
      confidence: hasText ? 0.97 : 0,
      pageCount: totalPages ?? pages.length,
      pages,
      engine: hasText ? "pdf-text" : "empty",
      note: hasText
        ? undefined
        : "No embedded text layer (likely a scanned PDF). Image OCR of PDF pages is not enabled in this build.",
    };
  } catch (err) {
    logger.warn("ocr.pdf_failed", { error: (err as Error).message });
    return { text: "", confidence: 0, pageCount: 0, pages: [], engine: "empty", note: "PDF parsing failed" };
  }
}
