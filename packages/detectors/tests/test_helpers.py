"""Tests for the shared detector helpers — runnable without Slither."""
from tryanneal_detectors._helpers import (
    estimate_calldata_size,
    fastlz_estimate,
)


class _FakeParam:
    def __init__(self, t: str):
        self._t = t

    @property
    def type(self):
        return self._t


class _FakeFn:
    def __init__(self, params):
        self.parameters = params


def test_estimate_calldata_size_counts_static_at_32_dynamic_at_96():
    fn = _FakeFn([_FakeParam("uint256"), _FakeParam("address"), _FakeParam("bytes")])
    # selector 4 + uint256 32 + address 32 + bytes 96
    assert estimate_calldata_size(fn) == 4 + 32 + 32 + 96


def test_fastlz_estimate_scales_with_entropy_ratio():
    high = fastlz_estimate(1024, entropy_ratio=0.9)
    low = fastlz_estimate(1024, entropy_ratio=0.1)
    assert high > low
    assert fastlz_estimate(0) == 0
