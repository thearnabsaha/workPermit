import JSZip from "jszip";
import type { InputFile } from "./types";
import { logger } from "../logger";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  txt: "text/plain",
};

function mimeFor(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

// Expands a ZIP into supported document files. Ignores directories, hidden/OS
// metadata entries, and unsupported file types.
export async function expandZip(buffer: Buffer): Promise<InputFile[]> {
  const out: InputFile[] = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files);
    for (const entry of entries) {
      if (entry.dir) continue;
      const base = entry.name.split("/").pop() ?? entry.name;
      if (base.startsWith(".") || entry.name.includes("__MACOSX")) continue;
      const mime = mimeFor(base);
      if (!mime) continue;
      const content = await entry.async("nodebuffer");
      out.push({ name: base, mime, buffer: content });
    }
  } catch (err) {
    logger.warn("ocr.zip_failed", { error: (err as Error).message });
  }
  return out;
}
