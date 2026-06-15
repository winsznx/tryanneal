/**
 * POST /api/translate { text, lang } — translate an audit report into another
 * language with Tencent Hunyuan (its Hunyuan-MT model). The analysis stays
 * English; this is the presentation-layer translation the /try flow opts into.
 *
 * Calls the gateway directly (no engine import) to keep the route lean.
 */
import { corsHeaders } from "../safety/_safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HUNYUAN_KEY = process.env.HUNYUAN_API_KEY ?? null;
const HUNYUAN_BASE = (process.env.HUNYUAN_BASE_URL ?? "https://tokenhub-intl.tencentcloudmaas.com/v1").replace(/\/+$/, "");
const HUNYUAN_MODEL = process.env.HUNYUAN_MODEL ?? "hy-mt2-plus";
const MAX_TEXT_BYTES = 12_000;

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
  it: "Italian",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...corsHeaders() },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request): Promise<Response> {
  if (!HUNYUAN_KEY) return json({ error: "Translation is not configured." }, 503);

  let body: { text?: string; lang?: string };
  try {
    body = (await req.json()) as { text?: string; lang?: string };
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const text = (body.text ?? "").trim();
  const lang = (body.lang ?? "").trim().toLowerCase();
  const langName = LANGUAGES[lang];
  if (!text || !lang) return json({ error: "text and lang are required." }, 400);
  if (!langName) return json({ error: `Unsupported language: ${lang}` }, 400);
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) return json({ error: "Text too large." }, 413);

  const systemPrompt =
    `You are a professional translator. Translate the user's text into ${langName}. ` +
    "Keep ALL Markdown (*bold*, `code`, [text](url) links), URLs, numbers, contract and " +
    "function names, hashes, addresses, and emoji exactly as-is. Translate only the " +
    "natural-language words. Output only the translation, with no preamble.";

  try {
    const res = await fetch(`${HUNYUAN_BASE}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${HUNYUAN_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: HUNYUAN_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return json({ error: `translation service ${res.status}` }, 502);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) return json({ error: "empty translation" }, 502);
    return json({ translated, language: langName });
  } catch (err) {
    return json({ error: (err as Error).message ?? "translation failed" }, 502);
  }
}
