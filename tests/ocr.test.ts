import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { runOcr, runOcrMany, expandInputs } from "@/lib/ocr";

const PERMIT_TEXT = "WORK PERMIT\nName: Maria Santos\nExpiry Date: 2031-03-14";

describe("OCR text path", () => {
  it("reads a plain-text document at high confidence", async () => {
    const r = await runOcr({ name: "permit.txt", mime: "text/plain", buffer: Buffer.from(PERMIT_TEXT) });
    expect(r.text).toContain("Maria Santos");
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it("reports unsupported types gracefully", async () => {
    const r = await runOcr({ name: "x.bin", mime: "application/octet-stream", buffer: Buffer.from([0, 1, 2]) });
    expect(r.text).toBe("");
    expect(r.engine).toBe("empty");
  });
});

describe("ZIP expansion", () => {
  it("extracts supported files and ignores junk", async () => {
    const zip = new JSZip();
    zip.file("permit.txt", PERMIT_TEXT);
    zip.file(".DS_Store", "junk");
    zip.file("notes.xyz", "unsupported");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const expanded = await expandInputs([{ name: "bundle.zip", mime: "application/zip", buffer }]);
    expect(expanded.map((f) => f.name)).toEqual(["permit.txt"]);
  });

  it("OCRs every doc in a multi-file set and merges", async () => {
    const merged = await runOcrMany([
      { name: "a.txt", mime: "text/plain", buffer: Buffer.from("Page one") },
      { name: "b.txt", mime: "text/plain", buffer: Buffer.from("Page two") },
    ]);
    expect(merged.text).toContain("Page one");
    expect(merged.text).toContain("Page two");
    expect(merged.pageCount).toBe(2);
  });
});
