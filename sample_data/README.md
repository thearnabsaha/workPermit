# Sample data

Synthetic documents for testing and demos. **No real personal data.**

Generate the PDFs:

```bash
npm run samples
```

This writes to `sample_data/permits/`:

| File | Expected outcome |
|------|------------------|
| `01-valid-work-permit.pdf` | Work Permit, **Valid / Likely Valid**, low risk |
| `02-expiring-residence-permit.pdf` | Residence Permit, valid but **expires within ~30 days** → human review |
| `03-suspicious-permit.pdf` | **Possibly Invalid** (expiry before issue date, missing authority) → high risk, human review |
| `04-unknown-document.pdf` | **Unknown** document type → "Unable to Verify", human review |

`permits/work-permit-sample.txt` is a plain-text permit used by quick tests.

Upload any of these in the UI, or POST them to `/api/run`. With a Gemini key the analysis uses the LLM; without one, the deterministic offline pipeline produces comparable results from the same text.
