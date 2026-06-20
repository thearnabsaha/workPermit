from datetime import datetime, timezone

from app.agents.expiry import analyze_expiry, parse_date

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_parse_iso():
    assert parse_date("2027-03-14").date().isoformat() == "2027-03-14"


def test_parse_dmy():
    assert parse_date("14.03.2027").date().isoformat() == "2027-03-14"


def test_parse_garbage():
    assert parse_date("not a date") is None


def test_expired():
    e = analyze_expiry("2025-06-01", NOW)
    assert e["expired"] is True
    assert e["days_remaining"] < 0
    assert e["within_30"] is False


def test_within_30():
    e = analyze_expiry("2026-01-20", NOW)
    assert e["expired"] is False
    assert e["within_30"] and e["within_60"] and e["within_90"]


def test_within_90_only():
    e = analyze_expiry("2026-03-25", NOW)
    assert e["within_30"] is False
    assert e["within_60"] is False
    assert e["within_90"] is True


def test_far_future():
    e = analyze_expiry("2030-01-01", NOW)
    assert e["within_90"] is False
    assert e["days_remaining"] > 90


def test_no_date():
    e = analyze_expiry(None)
    assert e["expiry_date"] is None
    assert e["days_remaining"] is None
