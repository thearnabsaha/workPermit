"""Deterministic expiry analysis."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _empty() -> Dict[str, Any]:
    return {
        "expiry_date": None,
        "days_remaining": None,
        "expired": False,
        "within_30": False,
        "within_60": False,
        "within_90": False,
    }


def parse_date(value: str) -> Optional[datetime]:
    """Parse ISO (YYYY-MM-DD) or DD.MM.YYYY / DD/MM/YYYY date strings."""
    if not value:
        return None
    iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", value)
    if iso:
        try:
            return datetime(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)), tzinfo=timezone.utc)
        except ValueError:
            return None
    dmy = re.search(r"(\d{1,2})[./](\d{1,2})[./](\d{2,4})", value)
    if dmy:
        year = int(dmy.group(3))
        if year < 100:
            year += 2000
        try:
            return datetime(year, int(dmy.group(2)), int(dmy.group(1)), tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def analyze_expiry(expiry_date: Optional[str], now: Optional[datetime] = None) -> Dict[str, Any]:
    """Compute remaining validity + warning windows relative to ``now``."""
    if not expiry_date:
        return _empty()
    d = parse_date(expiry_date)
    if not d:
        return _empty()

    now = now or datetime.now(timezone.utc)
    days = (d.date() - now.date()).days
    expired = days < 0
    return {
        "expiry_date": d.date().isoformat(),
        "days_remaining": days,
        "expired": expired,
        "within_30": (not expired) and days <= 30,
        "within_60": (not expired) and days <= 60,
        "within_90": (not expired) and days <= 90,
    }
