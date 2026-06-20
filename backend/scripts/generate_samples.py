"""Generate synthetic sample work-permit PDFs (with a real text layer).

The pipeline reads these via fast PDF text extraction. Run from the backend dir:
    python scripts/generate_samples.py
"""
from __future__ import annotations

import os
from datetime import date, timedelta

from fpdf import FPDF

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "sample_data", "permits")


def _iso_in_days(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


SAMPLES = [
    {
        "file": "01-valid-work-permit.pdf",
        "title": "BUNDESREPUBLIK DEUTSCHLAND - Bundesagentur fur Arbeit",
        "heading": "WORK PERMIT / ARBEITSERLAUBNIS",
        "lines": [
            ("Name", "Maria Santos"),
            ("Nationality", "Brazilian"),
            ("Permit Number", "DE-WP-2024-558102"),
            ("Permit Type", "General employment"),
            ("Country", "Germany"),
            ("Issuing Authority", "Bundesagentur fur Arbeit"),
            ("Issue Date", "2024-03-15"),
            ("Expiry Date", _iso_in_days(1800)),
            ("Document Number", "ABC123456"),
            ("Residence Status", "Authorized to work"),
            ("Employer Restrictions", "None"),
            ("Occupation Restrictions", "None"),
        ],
    },
    {
        "file": "02-expiring-residence-permit.pdf",
        "title": "Auslanderbehorde Saarbrucken",
        "heading": "RESIDENCE PERMIT / AUFENTHALTSTITEL",
        "lines": [
            ("Name", "Chidi Okafor"),
            ("Nationality", "Nigerian"),
            ("Permit Number", "DE-RP-2022-771043"),
            ("Permit Type", "Residence with work authorization"),
            ("Country", "Germany"),
            ("Issuing Authority", "Auslanderbehorde Saarbrucken"),
            ("Issue Date", "2022-07-01"),
            ("Expiry Date", _iso_in_days(22)),
            ("Document Number", "RP9981234"),
            ("Residence Status", "Authorized to work"),
        ],
    },
    {
        "file": "03-suspicious-permit.pdf",
        "title": "WORK PERMIT",
        "heading": "WORK PERMIT",
        "lines": [
            ("Name", "Ivan Petrov"),
            ("Permit Number", "WP-00-000"),
            ("Country", "Germany"),
            ("Expiry Date", "2024-11-30"),
            ("Issue Date", "2025-12-01"),
        ],
    },
    {
        "file": "04-unknown-document.pdf",
        "title": "City of Saarbrucken - General Correspondence",
        "heading": "CONFIRMATION OF ADDRESS",
        "lines": [
            ("This letter confirms the registered address of the resident.", ""),
            ("Issued", "2025-01-10"),
        ],
    },
]


def build(sample: dict) -> bytes:
    pdf = FPDF(format="A4")
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, sample["title"], ln=True)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, sample["heading"], ln=True)
    pdf.ln(4)
    pdf.set_font("Helvetica", size=12)
    for key, value in sample["lines"]:
        text = f"{key}: {value}" if value else key
        pdf.cell(0, 8, text, ln=True)
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(0, 6, "Synthetic sample data for testing only.", ln=True)
    return bytes(pdf.output())


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for sample in SAMPLES:
        with open(os.path.join(OUT, sample["file"]), "wb") as fh:
            fh.write(build(sample))
        print("wrote", sample["file"])
    print("Done. Sample permits in", OUT)


if __name__ == "__main__":
    main()
