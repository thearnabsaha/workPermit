// Generates realistic sample work-permit PDFs (with a real text layer, so the
// pipeline reads them via fast PDF text extraction). Run: `npm run samples`.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "permits");

const SAMPLES = [
  {
    file: "01-valid-work-permit.pdf",
    title: "BUNDESREPUBLIK DEUTSCHLAND — Bundesagentur für Arbeit",
    heading: "WORK PERMIT / ARBEITSERLAUBNIS",
    lines: [
      ["Name", "Maria Santos"],
      ["Nationality", "Brazilian"],
      ["Permit Number", "DE-WP-2024-558102"],
      ["Permit Type", "General employment"],
      ["Country", "Germany"],
      ["Issuing Authority", "Bundesagentur für Arbeit"],
      ["Issue Date", "2024-03-15"],
      ["Expiry Date", "2031-03-14"],
      ["Document Number", "ABC123456"],
      ["Residence Status", "Authorized to work"],
      ["Employer Restrictions", "None"],
      ["Occupation Restrictions", "None"],
    ],
  },
  {
    file: "02-expiring-residence-permit.pdf",
    title: "Ausländerbehörde Saarbrücken",
    heading: "RESIDENCE PERMIT / AUFENTHALTSTITEL",
    lines: [
      ["Name", "Chidi Okafor"],
      ["Nationality", "Nigerian"],
      ["Permit Number", "DE-RP-2022-771043"],
      ["Permit Type", "Residence with work authorization"],
      ["Country", "Germany"],
      ["Issuing Authority", "Ausländerbehörde Saarbrücken"],
      ["Issue Date", "2022-07-01"],
      // Near-term expiry is injected at generation time below.
      ["Document Number", "RP9981234"],
      ["Residence Status", "Authorized to work"],
    ],
    expiryInDays: 22,
  },
  {
    file: "03-suspicious-permit.pdf",
    title: "WORK PERMIT",
    heading: "WORK PERMIT",
    lines: [
      ["Name", "Ivan Petrov"],
      ["Permit Number", "WP-00-000"],
      ["Country", "Germany"],
      // Inconsistent: expiry precedes issue date, missing authority.
      ["Issue Date", "2025-12-01"],
      ["Expiry Date", "2024-11-30"],
    ],
  },
  {
    file: "04-unknown-document.pdf",
    title: "City of Saarbrücken — General Correspondence",
    heading: "CONFIRMATION OF ADDRESS",
    lines: [
      ["To whom it may concern", ""],
      ["This letter confirms the registered address of the resident.", ""],
      ["Issued", "2025-01-10"],
    ],
  },
];

function isoInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function build(sample) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 790;
  const draw = (text, f, size, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(text, { x: 50, y, size, font: f, color });
    y -= size + 8;
  };

  draw(sample.title, bold, 12, rgb(0.2, 0.3, 0.5));
  y -= 6;
  draw(sample.heading, bold, 18);
  y -= 10;

  const lines = [...sample.lines];
  if (sample.expiryInDays != null) lines.push(["Expiry Date", isoInDays(sample.expiryInDays)]);

  for (const [k, v] of lines) {
    const label = v ? `${k}:` : k;
    draw(`${label} ${v}`.trim(), v ? font : font, 12);
  }

  y -= 20;
  draw("This document is provided as synthetic sample data for testing only.", font, 9, rgb(0.5, 0.5, 0.5));

  return doc.save();
}

await mkdir(OUT, { recursive: true });
for (const s of SAMPLES) {
  const bytes = await build(s);
  await writeFile(join(OUT, s.file), bytes);
  console.log("wrote", s.file);
}
console.log("Done. Sample permits in", OUT);
