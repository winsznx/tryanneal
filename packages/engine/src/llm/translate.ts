/**
 * Multilingual audit reports. TryAnneal analyses in English (Groq + ChainGPT do
 * the reasoning), then a translation model renders the verdict + findings in the
 * reader's language. On the Mantle Turing Test DevTools track this is where
 * Tencent Hunyuan earns its place — used for what it's actually best at (its
 * Hunyuan-MT translation models), not forced to emit audit JSON it can't.
 *
 * Provider-agnostic: pass any LLMProvider. The orchestrator stays English-only;
 * translation is a presentation-layer step the renderers opt into.
 */
import type { LLMProvider } from "./providers/types.js";

/** ISO-ish code → the language name we put in the translation prompt. */
const LANGUAGES: Record<string, string> = {
  zh: "Simplified Chinese",
  "zh-tw": "Traditional Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  id: "Indonesian",
  vi: "Vietnamese",
  tr: "Turkish",
  th: "Thai",
  it: "Italian",
};

export function languageName(code: string): string | undefined {
  return LANGUAGES[code.toLowerCase()];
}

export function supportedLanguages(): { code: string; name: string }[] {
  return Object.entries(LANGUAGES).map(([code, name]) => ({ code, name }));
}

export interface TranslateOptions {
  /** Target language code (e.g. "zh") or a full name passed through verbatim. */
  targetLang: string;
  provider: LLMProvider;
  timeoutMs?: number;
}

function translateSystemPrompt(languageName: string): string {
  return (
    `You are a professional translator. Translate the user's text into ${languageName}. ` +
    "Keep ALL Markdown exactly as-is — *bold*, `code`, and [text](url) links — and never alter " +
    "URLs, numbers, contract or function names, hashes, addresses, or emoji. Translate only the " +
    "natural-language words. Output only the translated text, with no preamble or notes."
  );
}

/** Translate a finished report (Markdown) into the target language. */
export async function translateReport(text: string, opts: TranslateOptions): Promise<string> {
  const langName = LANGUAGES[opts.targetLang.toLowerCase()] ?? opts.targetLang;
  const controller = opts.timeoutMs != null ? new AbortController() : undefined;
  const timer =
    controller != null ? setTimeout(() => controller.abort(), opts.timeoutMs) : undefined;
  try {
    const res = await opts.provider.chat(
      {
        systemPrompt: translateSystemPrompt(langName),
        userPrompt: text,
        maxOutputTokens: 2048,
      },
      controller?.signal,
    );
    const out = res.text.trim();
    if (!out) throw new Error("translation returned empty content");
    return out;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}
