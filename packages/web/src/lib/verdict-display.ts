/**
 * Shared verdict-display vocabulary so every surface (the /try judge flow, the
 * dashboard audit card, and any future one) renders the moat identically:
 *   - is_this_safe() → SAFE / UNSAFE / INCONCLUSIVE
 *   - which engines cross-validated the audit
 * Single source of truth — no drift between surfaces.
 */

// Pretty names for the engines that ran, so a result reads as the multi-model
// audit it is (not one model's opinion).
export const ENGINE_LABEL: Record<string, string> = {
  chaingpt: "ChainGPT",
  groq: "Groq · Llama-3.3-70B",
  "gpt-oss": "Groq · GPT-OSS-120B",
  gemini: "Gemini",
  slither: "Slither",
  aderyn: "Aderyn",
  corpus: "Exploit corpus",
};

export const prettyEngine = (id: string): string => ENGINE_LABEL[id] ?? id;

export interface SafetyStyle {
  label: string;
  fg: string;
  border: string;
  bg: string;
}

// fg from design tokens; subtle tints as rgba so the chip reads on the dark UI.
export const SAFETY_STYLE = {
  safe: { label: "SAFE", fg: "var(--color-severity-safe)", border: "rgba(64,192,128,0.40)", bg: "rgba(64,192,128,0.06)" },
  unsafe: { label: "UNSAFE", fg: "var(--color-severity-high)", border: "rgba(255,90,90,0.40)", bg: "rgba(255,90,90,0.06)" },
  inconclusive: { label: "INCONCLUSIVE", fg: "var(--color-severity-medium)", border: "rgba(240,180,60,0.40)", bg: "rgba(240,180,60,0.06)" },
} as const satisfies Record<string, SafetyStyle>;

/** The is_this_safe() answer for a result: prefer the engine's `safe` boolean,
 *  else derive from severity counts. Never "safe" when analysis was incomplete. */
export function safetyState(opts: {
  analysisIncomplete?: boolean;
  safe?: boolean;
  critical: number;
  high: number;
}): SafetyStyle {
  if (opts.analysisIncomplete) return SAFETY_STYLE.inconclusive;
  const safe = opts.safe ?? (opts.critical === 0 && opts.high === 0);
  return safe ? SAFETY_STYLE.safe : SAFETY_STYLE.unsafe;
}

/** Describe the cross-validation: "Cross-validated by N engines · …". */
export function crossValidationLabel(modelsUsed: string[] | undefined, mode: string | undefined): string | null {
  if (!modelsUsed || modelsUsed.length === 0) return null;
  const tail = mode === "static-only" ? "static + corpus" : "multi-model cascade, ≥2 sources to confirm";
  return `Cross-validated by ${modelsUsed.length} engine${modelsUsed.length > 1 ? "s" : ""} · ${tail}`;
}
