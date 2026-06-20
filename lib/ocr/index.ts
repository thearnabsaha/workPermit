import type { InputFile, OcrResult } from "./types";
import { extractPdfText } from "./pdf";
import { ocrImage } from "./tesseract";
import { expandZip } from "./zip";

export type { InputFile, OcrResult, OcrPageResult } from "./types";

const ZIP_MIMES = ["application/zip", "application/x-zip-compressed", "multipart/x-zip"];

function isZip(file: InputFile): boolean {
  return ZIP_MIMES.includes(file.mime) || file.name.toLowerCase().endsWith(".zip");
}

/** Expand any ZIP archives so the pipeline always sees a flat list of docs. */
export async function expandInputs(files: InputFile[]): Promise<InputFile[]> {
  const out: InputFile[] = [];
  for (const f of files) {
    if (isZip(f)) out.push(...(await expandZip(f.buffer)));
    else out.push(f);
  }
  return out;
}

/** OCR a single document, dispatching by type. */
export async function runOcr(file: InputFile): Promise<OcrResult> {
  if (file.mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(file.buffer);
  }
  if (file.mime.startsWith("image/")) {
    return ocrImage(file.buffer);
  }
  // Plain text fallback (e.g. .txt inside a zip).
  if (file.mime.startsWith("text/")) {
    const text = file.buffer.toString("utf8").trim();
    return { text, confidence: text ? 0.99 : 0, pageCount: 1, pages: [{ page: 1, text, confidence: 0.99 }], engine: "pdf-text" };
  }
  return { text: "", confidence: 0, pageCount: 0, pages: [], engine: "empty", note: `Unsupported file type: ${file.mime}` };
}

/**
 * OCR several documents and merge them into one logical result (multi-page set
 * or several pages of the same permit). Confidence is the page-count-weighted
 * mean so a single bad page doesn't dominate.
 */
export async function runOcrMany(files: InputFile[]): Promise<OcrResult> {
  const expanded = await expandInputs(files);
  if (expanded.length === 0) {
    return { text: "", confidence: 0, pageCount: 0, pages: [], engine: "empty", note: "No supported documents found" };
  }

  const results: OcrResult[] = [];
  for (const f of expanded) results.push(await runOcr(f));

  const allPages = results.flatMap((r) => r.pages);
  const pageCount = results.reduce((n, r) => n + Math.max(r.pageCount, 1), 0);
  const text = results.map((r) => r.text).filter(Boolean).join("\n\n----\n\n").trim();
  const weight = allPages.length || 1;
  const confidence = allPages.reduce((s, p) => s + p.confidence, 0) / weight;
  const engine = results.find((r) => r.text)?.engine ?? "empty";

  return {
    text,
    confidence: text ? confidence : 0,
    pageCount,
    pages: allPages.map((p, i) => ({ ...p, page: i + 1 })),
    engine,
    note: text ? undefined : results.find((r) => r.note)?.note,
  };
}
