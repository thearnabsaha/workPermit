"""Pytest setup: force the deterministic offline pipeline so tests never call
the network, and make the backend package importable."""
import os
import sys

os.environ["FORCE_MOCK"] = "1"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
