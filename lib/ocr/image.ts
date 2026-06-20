import sharp from "sharp";
import { logger } from "../logger";

// Best-effort preprocessing to improve OCR accuracy on phone photos / scans:
// auto-orient (EXIF), grayscale, normalize contrast, mild denoise + sharpen,
// and an upscale for small images. Returns a clean PNG buffer for Tesseract.
export async function preprocessImage(buffer: Buffer, opts: { binarize?: boolean } = {}): Promise<Buffer> {
  try {
    const img = sharp(buffer, { failOn: "none" }).rotate(); // rotate() with no arg auto-orients from EXIF
    const meta = await img.metadata();

    let pipeline = img.grayscale().normalize();

    // Upscale small images so text strokes are thick enough for OCR.
    const width = meta.width ?? 0;
    if (width && width < 1000) {
      pipeline = pipeline.resize({ width: Math.round(width * 2), withoutEnlargement: false });
    }

    pipeline = pipeline.median(1).sharpen();
    // Retry pass: hard threshold to black/white for noisy/low-contrast scans.
    if (opts.binarize) pipeline = pipeline.threshold(140);

    return await pipeline.toFormat("png").toBuffer();
  } catch (err) {
    logger.warn("ocr.preprocess_failed", { error: (err as Error).message });
    return buffer; // fall back to the original bytes
  }
}
