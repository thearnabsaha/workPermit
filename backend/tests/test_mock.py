from app.ai.mock import mock_classify, mock_extract, mock_recommend, mock_risk, mock_validate

VALID_PERMIT = """Bundesagentur fur Arbeit
WORK PERMIT / ARBEITSERLAUBNIS
Name: Maria Santos
Permit Number: DE-WP-2024-558102
Country: Germany
Issuing Authority: Bundesagentur fur Arbeit
Issue Date: 2024-03-15
Expiry Date: 2031-03-14"""


def test_classify_work_permit():
    r = mock_classify(VALID_PERMIT)
    assert r.document_type == "Work Permit"
    assert r.classification_confidence > 0.5


def test_classify_residence():
    assert mock_classify("Aufenthaltstitel residence permit").document_type == "Residence Permit"


def test_classify_passport():
    assert mock_classify("REISEPASS / PASSPORT").document_type == "Passport"


def test_classify_unknown():
    assert mock_classify("hi").document_type == "Unknown"


def test_extract_fields():
    f = mock_extract(VALID_PERMIT)
    assert f.holder_name == "Maria Santos"
    assert "DE-WP-2024-558102" in (f.permit_number or "")
    assert f.country == "Germany"
    assert f.issue_date == "2024-03-15"
    assert f.expiry_date == "2031-03-14"


def test_valid_low_risk():
    fields = mock_extract(VALID_PERMIT)
    v = mock_validate(fields, 0.95)
    assert v.validation_status == "Valid"
    risk = mock_risk(v, 0.95)
    assert risk.risk_score < 33
    rec = mock_recommend(v.validation_status, risk.risk_score, False, v.fields_complete)
    assert rec.recommendation == "Likely Valid"
    assert rec.requires_human_review is False


def test_inconsistent_dates_flagged():
    fields = mock_extract("WORK PERMIT\nName: Ivan Petrov\nExpiry Date: 2024-11-30\nIssue Date: 2025-12-01\nIssuing Authority: Home Office\nPermit Number: WP-12-345")
    v = mock_validate(fields, 0.5)
    assert v.tampering_indicators
    assert v.validation_status == "Possibly Invalid"
    risk = mock_risk(v, 0.5)
    assert risk.risk_score > 40
    rec = mock_recommend(v.validation_status, risk.risk_score, True, v.fields_complete)
    assert rec.requires_human_review is True
