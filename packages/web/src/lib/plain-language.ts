/**
 * Human-language layer for audit output. Judges aren't all auditors — so every
 * finding gets a plain-English sentence ("an attacker can withdraw repeatedly")
 * instead of a detector ID ("reentrancy-eth"), and every verdict gets a
 * one-line answer to the only question that matters: can I trust this?
 */

const FINDING_PLAIN: Record<string, string> = {
  // Slither — reentrancy family
  "reentrancy-eth": "An attacker can re-enter mid-withdrawal and drain funds before balances update — the classic exploit.",
  "reentrancy-no-eth": "State is changed after an external call, so an attacker can re-enter and corrupt the contract.",
  "reentrancy-benign": "An external call happens before a state update. Low risk here, but it's the reentrancy shape.",
  "reentrancy-events": "Events are emitted after an external call — log ordering can be manipulated.",
  "reentrancy-unlimited-gas": "An external call forwards all gas before state settles — reentrancy risk.",
  // Slither — funds / access
  "arbitrary-send-eth": "The contract sends ETH to an address the caller controls — funds can be redirected.",
  "arbitrary-send-erc20": "Tokens can be pulled from an arbitrary owner the caller chooses.",
  "suicidal": "Anyone can destroy this contract and take or freeze its balance.",
  "unprotected-upgrade": "Anyone can re-initialize or upgrade the contract and seize control.",
  "controlled-delegatecall": "A delegatecall jumps into attacker-controlled code — full takeover.",
  "delegatecall-loop": "delegatecall inside a loop can drain via repeated forwarded calls.",
  "tx-origin": "Authorization uses tx.origin, which is phishable — a malicious contract can impersonate the user.",
  // Slither — correctness
  "unchecked-transfer": "A token transfer's success is never checked — it can silently fail and desync balances.",
  "unchecked-lowlevel": "A low-level call's return value is ignored — failures pass silently.",
  "unchecked-send": "An ETH send's result isn't checked — funds can be lost on failure.",
  "uninitialized-state": "A critical variable is never set, leaving the contract in an undefined, often hijackable state.",
  "uninitialized-storage": "A storage pointer is uninitialized and can overwrite other variables — takeover risk.",
  "incorrect-equality": "Uses strict == on a balance or timestamp, which an attacker can sidestep.",
  "weak-prng": "Randomness is derived from on-chain values miners or callers can predict.",
  "timestamp": "Logic depends on block.timestamp, which validators can nudge within limits.",
  "divide-before-multiply": "Divides before multiplying — rounding error loses precision (and sometimes funds).",
  "locked-ether": "The contract can receive ETH but has no way to get it back out — funds get stuck.",
  // Slither — informational / style (kept calm)
  "solc-version": "Pins a Solidity version with known compiler issues — bump it.",
  "pragma": "Mixes Solidity versions across files — pin one.",
  "low-level-calls": "Uses raw low-level calls — easy to get wrong; prefer typed interfaces.",
  "assembly": "Uses inline assembly, which bypasses Solidity's safety checks — review carefully.",
  "naming-convention": "Style only — names don't follow Solidity conventions.",
  "dead-code": "Code that's never reached — harmless, but worth removing.",

  // TryAnneal custom detectors
  "agent-reentrancy": "An autonomous agent can be re-entered through its callback before it finishes — agent-era reentrancy.",
  "agent-callback-loop": "An agent callback can be looped to exhaust gas or re-trigger logic.",
  "calldata-bloat": "Oversized calldata inflates Mantle's L1 data fee — costs balloon under load.",
  "operator-fee-outlier": "Operator-fee handling deviates from Mantle's Arsia model — fees may be mis-charged.",
  "l1block-unchecked-read": "Reads the L1Block predeploy without checking it — stale or zero values slip through.",
  "arsia-anti-patterns": "Uses gas assumptions that broke after Mantle's Arsia upgrade.",
  "single-dvn-verifier": "Trusts a single LayerZero DVN — the exact config that cost KelpDAO $292M in April 2026.",
  "donation-attack": "An attacker can donate tokens to skew share math and steal from depositors — the Euler-class bug.",
  "init-unprotected": "The initializer is callable by anyone — the Nomad-class $190M mistake.",
  "oracle-no-staleness": "A price feed is read without checking how old it is — stale prices can be exploited.",
  "proxy-storage-collision": "Proxy and implementation disagree on storage layout — upgrades can corrupt state.",
  "approval-abuse-arbitrary-call": "An arbitrary external call can spend users' token approvals — the Li.Fi / Socket drain class.",
  "signature-replay-bypass": "A signature can be replayed because it isn't bound to a nonce or chain — the $1.19B class.",
  "amm-spot-oracle-dependency": "Prices come from a spot AMM read that a flash loan can move — manipulable oracle.",
  "vault-share-rounding": "Share math rounds in a way an attacker can farm — the Sonne / zkLend class.",
  "corpus-match": "Structurally matches a known historical exploit in the TryAnneal corpus.",
};

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Derive severity counts from the findings list — the ground truth the UI
 * renders. The hosted audit_contract result doesn't always surface aggregate
 * counts, so the displayed verdict must agree with the findings shown.
 */
export function severityCounts(findings: { severity?: string }[] = []): SeverityCounts {
  const c: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const s = (f.severity ?? "").toLowerCase();
    if (s === "critical") c.critical++;
    else if (s === "high") c.high++;
    else if (s === "medium") c.medium++;
    else if (s === "low") c.low++;
  }
  return c;
}

/** Plain-English explanation for a finding. Falls back to the detector's own title. */
export function plainFinding(vulnClass?: string, title?: string): string {
  if (vulnClass && FINDING_PLAIN[vulnClass]) return FINDING_PLAIN[vulnClass];
  if (title) return title;
  return "A potential issue worth reviewing before trusting this contract.";
}

export interface VerdictSummary {
  headline: string;
  detail: string;
  tone: "good" | "warn" | "bad";
}

/** One-line, human answer to "can I trust this?" */
export function plainVerdict(
  score: number,
  criticalCount = 0,
  highCount = 0,
  incomplete = false,
): VerdictSummary {
  if (incomplete) {
    return {
      headline: "Couldn't analyze this contract.",
      detail:
        "Static analysis couldn't compile it (often unresolved imports) and the model cascade had nothing to fall back on. This is NOT a clean bill of health — treat it as unaudited.",
      tone: "bad",
    };
  }
  if (criticalCount > 0) {
    return {
      headline: "Do not trust this contract.",
      detail: `${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} that an attacker could use to take or drain funds.`,
      tone: "bad",
    };
  }
  if (highCount > 0 || score < 60) {
    return {
      headline: "Risky — review before composing.",
      detail: highCount > 0
        ? `${highCount} high-severity issue${highCount > 1 ? "s" : ""} found. Treat as unsafe until fixed.`
        : "Enough issues to warrant a manual review before any agent relies on it.",
      tone: "warn",
    };
  }
  if (score >= 90) {
    return {
      headline: "Safe to compose with.",
      detail: "No critical or high-severity issues on record. Clean enough for an agent to trust.",
      tone: "good",
    };
  }
  return {
    headline: "Mostly clean — minor notes.",
    detail: "No serious issues, just low-severity or stylistic findings.",
    tone: "warn",
  };
}
