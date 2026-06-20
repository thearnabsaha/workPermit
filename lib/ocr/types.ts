// A single input document (already de-zipped if it came from an archive).
export interface InputFile {
  name: string;
  mime: string;
  buffer: Buffer;
}

export interface OcrPageResult {
  page: number;
  text: string;
  confidence: number; // 0..1
}

export interface OcrResult {
  text: string;
  confidence: number; // 0..1 (aggregate)
  pageCount: number;
  pages: OcrPageResult[];
  engine: "pdf-text" | "tesseract" | "mock" | "empty";
  note?: string;
}
