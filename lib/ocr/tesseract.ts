import type { OcrResult } from "./types";
import { preprocessImage } from "./image";
import { config } from "../config";
import { logger } from "../logger";

// Tesseract.js worker, lazily created and reused across requests. Language data
// is fetched from the CDN on first use (configurable). All failures degrade to
// an empty result so the pipeline can still produce a "needs review" outcome.

let workerPromise: Promise<any> | null = null;

async function getWorker(): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      // createWorker(langs) downloads + loads the language(s) automatically.
      return createWorker(config.ocrLanguages.split("+"));
    })();
  }
  return workerPromise;
}

export async function ocrImage(buffer: Buffer): Promise<OcrResult> {
  try {
    const worker = await getWorker();

    const recognize = async (binarize: boolean) => {
      const processed = await preprocessImage(buffer, { binarize });
      const { data } = await worker.recognize(processed);
      const text = (data.text ?? "").replace(/\s+\n/g, "\n").trim();
      const confidence = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));
      return { text, confidence };
    };

    let best = await recognize(false);
    // Automatic retry on weak OCR: try a binarized pass and keep the better one.
    if (best.confidence < 0.45) {
      const retry = await recognize(true);
      if (retry.confidence > best.confidence) best = retry;
    }

    return {
      text: best.text,
      confidence: best.confidence,
      pageCount: 1,
      pages: [{ page: 1, text: best.text, confidence: best.confidence }],
      engine: "tesseract",
    };
  } catch (err) {
    logger.warn("ocr.tesseract_failed", { error: (err as Error).message });
    return {
      text: "",
      confidence: 0,
      pageCount: 1,
      pages: [],
      engine: "empty",
      note: "OCR engine unavailable (could not load Tesseract language data).",
    };
  }
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      /* ignore */
    }
    workerPromise = null;
  }
}
