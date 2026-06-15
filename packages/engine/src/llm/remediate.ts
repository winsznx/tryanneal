/**
 * Per-finding remediation writer. The static analyzers (Slither/Aderyn) report
 * what's wrong but ship an empty `recommendation`; this fills the plain-English
 * "how to fix" for those. On the Mantle DevTools track this is the second job
 * Tencent Hunyuan does (alongside multilingual translation) — using its
 * Hunyuan-MT model for what it's actually good at, not as an audit critic.
 *
 * Best-effort and provider-agnostic: a failure leaves the original (empty)
 * recommendation untouched; it never blocks or changes the verdict.
 */
import type { LLMProvider } from "./providers/types.js";
import type { LLMFinding } from "./types.js";

const REMEDIATION_SYSTEM =
  "You are a smart-contract security expert. For the given finding, write ONE concise, actionable " +
  "remediation sentence in ENGLISH telling the developer how to fix it. Output only the sentence — " +
  "no preamble, no markdown, no translation.";

export interface RemediateOptions {
  /** Cap how many findings get a generated fix (bounds latency). Default 8. */
  max?: number;
  timeoutMs?: number;
}

/** Fill empty recommendations in place via the provider; returns the same array. */
export async function fillRemediations(
  findings: LLMFinding[],
  provider: LLMProvider,
  opts: RemediateOptions = {},
): Promise<LLMFinding[]> {
  const max = opts.max ?? 8;
  const targets = findings.filter((f) => !f.recommendation || f.recommendation.trim().length === 0).slice(0, max);
  if (targets.length === 0) return findings;

  await Promise.all(
    targets.map(async (f) => {
      const controller = opts.timeoutMs != null ? new AbortController() : undefined;
      const timer = controller != null ? setTimeout(() => controller.abort(), opts.timeoutMs) : undefined;
      try {
        const res = await provider.chat(
          {
            systemPrompt: REMEDIATION_SYSTEM,
            userPrompt: `${f.vulnClass}: ${f.description}`,
            maxOutputTokens: 160,
          },
          controller?.signal,
        );
        const text = res.text.trim();
        if (text) f.recommendation = text;
      } catch {
        /* best-effort — leave the empty recommendation as-is */
      } finally {
        if (timer != null) clearTimeout(timer);
      }
    }),
  );
  return findings;
}
