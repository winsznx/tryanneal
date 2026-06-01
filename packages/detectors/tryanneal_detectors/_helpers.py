"""Shared utilities for TryAnneal detectors.

Keeps detector files small: feature extraction, AST-walking helpers, and
common predicates that several detectors need.
"""
from __future__ import annotations

from typing import Iterable, Optional, Set


ERC8004_IDENTITY_REGISTRY = "0x8004A3718bD35CF767BC0E718bf21Ec4073502f0"
L1_BLOCK_PREDEPLOY = "0x4200000000000000000000000000000000000015"
GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F"


def state_writes_in_function(function) -> Set:
    """Return the set of state variables written in `function` (including via calls)."""
    return set(function.all_state_variables_written())


def state_reads_in_function(function) -> Set:
    return set(function.all_state_variables_read())


def function_has_external_call(function) -> bool:
    """True if the function performs any external/low-level call (sends value or invokes another contract)."""
    try:
        if function.all_external_calls_as_expressions:
            return True
    except Exception:
        pass
    try:
        if function.all_low_level_calls():
            return True
    except Exception:
        pass
    return False


def function_external_call_targets(function) -> Iterable:
    """Yield contract types this function externally calls into."""
    try:
        for high_call in function.high_level_calls or []:
            # high_level_calls is a list of (contract, function) tuples on most Slither versions
            if isinstance(high_call, tuple) and len(high_call) >= 1:
                yield high_call[0]
    except Exception:
        return


def contract_inherits_name(contract, names: Iterable[str]) -> bool:
    name_set = {n.lower() for n in names}
    for base in contract.inheritance:
        if base.name.lower() in name_set:
            return True
    return contract.name.lower() in name_set


def contract_imports(contract, needle: str) -> bool:
    """Cheap textual check for an import path containing `needle`."""
    src = source_unit_text(contract)
    if not src:
        return False
    return needle.lower() in src.lower()


def source_unit_text(contract) -> Optional[str]:
    """Best-effort fetch of the source-file text containing `contract`."""
    try:
        if contract.source_mapping and contract.source_mapping.filename:
            with open(contract.source_mapping.filename.absolute, "r", encoding="utf-8") as fh:
                return fh.read()
    except Exception:
        pass
    return None


def function_source(function) -> str:
    """Return the literal source text for `function`, or "" if unavailable."""
    try:
        sm = function.source_mapping
        if not sm or not sm.filename:
            return ""
        with open(sm.filename.absolute, "r", encoding="utf-8") as fh:
            data = fh.read()
        return data[sm.start : sm.start + sm.length]
    except Exception:
        return ""


def looks_like_agent_contract(contract) -> bool:
    """Heuristic: this contract either talks to the ERC-8004 Identity Registry
    or exposes the canonical agent surface (`agentId()` / `register*Agent`)."""
    src = source_unit_text(contract) or ""
    if ERC8004_IDENTITY_REGISTRY.lower() in src.lower():
        return True
    if "iidentityregistry" in src.lower():
        return True
    fn_names = {f.name.lower() for f in contract.functions}
    if "agentid" in fn_names or "registeragent" in fn_names:
        return True
    return False


def estimate_calldata_size(function) -> int:
    """Estimate sample-calldata size (bytes) using the same head/body convention
    as the engine: 32 bytes per static param, 96 bytes per dynamic param, +4 selector."""
    STATIC_TYPES = {
        "address", "bool", "bytes32",
        "uint8", "uint16", "uint32", "uint64", "uint128", "uint256",
        "int8", "int16", "int32", "int64", "int128", "int256",
    }
    total = 4  # selector
    try:
        for p in function.parameters:
            t = (p.type and str(p.type)).lower() if p.type else ""
            if t in STATIC_TYPES:
                total += 32
            else:
                total += 96
    except Exception:
        return total
    return total


def fastlz_estimate(data_size: int, entropy_ratio: float = 0.6) -> int:
    """Cheap FastLZ-size estimator mirroring engine/gas/fastlz.ts.

    `entropy_ratio` ~ fraction of bytes assumed non-repeating. Real calldata is
    typically heavily zero-padded; we err high so the detector flags borderline
    calldata-heavy functions.
    """
    if data_size <= 0:
        return 0
    compressed = max(0, int(data_size * entropy_ratio)) + 10
    return compressed


def looks_like_layerzero_endpoint(contract) -> bool:
    src = source_unit_text(contract) or ""
    needles = ("ilayerzeroendpoint", "layerzeroreceiver", "endpointv2", "ilayerzeroreceiver")
    return any(n in src.lower() for n in needles)


def looks_like_erc4626_vault(contract) -> bool:
    if contract_inherits_name(contract, {"ERC4626", "ERC4626Upgradeable"}):
        return True
    fn_names = {f.name for f in contract.functions}
    return {"deposit", "convertToShares", "totalAssets"}.issubset(fn_names)
