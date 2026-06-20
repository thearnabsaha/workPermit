import asyncio

from app.agents.run import run_pipeline_stream
from app.ocr import InputFile

VALID_PERMIT = """Bundesagentur fur Arbeit
WORK PERMIT / ARBEITSERLAUBNIS
Name: Maria Santos
Permit Number: DE-WP-2024-558102
Country: Germany
Issuing Authority: Bundesagentur fur Arbeit
Issue Date: 2024-03-15
Expiry Date: 2031-03-14
Residence Status: Authorized to work"""


def _collect(files, message):
    async def run():
        return [e async for e in run_pipeline_stream(files, message)]

    return asyncio.run(run())


def test_full_pipeline_stream_contract():
    events = _collect(
        [InputFile(name="permit.txt", mime="text/plain", data=VALID_PERMIT.encode())],
        "Validate this permit",
    )

    # Always terminates with exactly one trailing done event.
    assert events[-1] == {"type": "done"}
    assert sum(1 for e in events if e["type"] == "done") == 1

    steps = [e["step"] for e in events if e["type"] == "trace"]
    assert "file_extraction" in steps
    assert "document_classification" in steps
    assert "analytics" in steps

    artifact = next(e for e in events if e["type"] == "artifact")
    assert artifact["artifact_type"] == "work_permit"
    assert artifact["data"]["document_type"] == "Work Permit"
    assert artifact["data"]["validation_status"] == "Valid"
    assert artifact["data"]["fields"]["holder_name"] == "Maria Santos"

    assert any(e["type"] == "evaluation" for e in events)


def test_unknown_input_safe_result():
    events = _collect([], "is this valid?")
    artifact = next(e for e in events if e["type"] == "artifact")
    assert artifact["data"]["document_type"] == "Unknown"
    assert artifact["data"]["requires_human_review"] is True
    assert events[-1] == {"type": "done"}
