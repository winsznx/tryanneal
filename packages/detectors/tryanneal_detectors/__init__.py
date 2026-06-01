"""TryAnneal — Mantle-specific and agent-context Slither detectors.

Heavy detector classes are loaded lazily so the corpus matcher remains
importable in environments where slither-analyzer is not installed.
"""
from __future__ import annotations


def make_plugin():
    """Slither entry point. Returns (detectors, printers)."""
    from .all_detectors import detectors, printers
    return detectors, printers


__all__ = ["make_plugin"]
