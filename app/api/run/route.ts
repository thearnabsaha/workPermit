import type { NextRequest } from "next/server";
import { runPipelineStream } from "@/lib/agents/run";
import { ndjsonResponse } from "@/lib/stream";
import type { InputFile } from "@/lib/ocr";
import { logger } from "@/lib/logger";

// Long-running multi-agent OCR + Gemini work — must run on the Node runtime,
// never cached, never statically optimized.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
const MAX_FILES = 20;

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  zip: "application/zip",
  txt: "text/plain",
};

function resolveMime(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

export async function POST(req: NextRequest) {
  let message = "";
  const inputs: InputFile[] = [];

  try {
    const form = await req.formData();
    message = String(form.get("message") ?? "");

    const files = form.getAll("files").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f);
    if (files.length > MAX_FILES) {
      return errorResponse(`Too many files (max ${MAX_FILES}).`);
    }

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return errorResponse(`"${file.name}" exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.`);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      inputs.push({ name: file.name, mime: resolveMime(file), buffer });
    }
  } catch (err) {
    logger.error("route.parse_failed", { error: (err as Error).message });
    return errorResponse("Could not read the upload.");
  }

  logger.info("route.run", { files: inputs.length, hasMessage: !!message });
  return ndjsonResponse(runPipelineStream(inputs, message));
}

// A self-contained NDJSON error stream that still ends with `done`.
function errorResponse(message: string): Response {
  async function* gen() {
    yield { type: "error", message } as const;
    yield { type: "done" } as const;
  }
  return ndjsonResponse(gen());
}
