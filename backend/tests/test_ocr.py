import io
import zipfile

from app.ocr import InputFile, expand_inputs, run_ocr, run_ocr_many

PERMIT_TEXT = "WORK PERMIT\nName: Maria Santos\nExpiry Date: 2031-03-14"


def test_text_document_high_confidence():
    r = run_ocr(InputFile(name="permit.txt", mime="text/plain", data=PERMIT_TEXT.encode()))
    assert "Maria Santos" in r.text
    assert r.confidence > 0.9


def test_unsupported_type():
    r = run_ocr(InputFile(name="x.bin", mime="application/octet-stream", data=b"\x00\x01\x02"))
    assert r.text == ""
    assert r.engine == "empty"


def test_zip_expansion_filters_junk():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("permit.txt", PERMIT_TEXT)
        zf.writestr(".DS_Store", "junk")
        zf.writestr("notes.xyz", "unsupported")
    expanded = expand_inputs([InputFile(name="bundle.zip", mime="application/zip", data=buf.getvalue())])
    assert [f.name for f in expanded] == ["permit.txt"]


def test_multi_file_merge():
    merged = run_ocr_many([
        InputFile(name="a.txt", mime="text/plain", data=b"Page one"),
        InputFile(name="b.txt", mime="text/plain", data=b"Page two"),
    ])
    assert "Page one" in merged.text
    assert "Page two" in merged.text
    assert merged.page_count == 2
