import { LLMError } from "./types.js";

/** Minimal fetch shape — adapters and tests rely on this and nothing else from the runtime fetch. */
export interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
  }>;
}

/** Strip markdown code fences and parse the first JSON array/object.
 *
 * Several LLMs produce JSON-ish output that breaks strict JSON.parse:
 *   - ```json ... ``` fences (handled)
 *   - leading prose ("Here is the JSON:") (handled by slicing to first { or [)
 *   - unquoted property names ({vulnClass: "..."} instead of {"vulnClass": "..."})
 *   - trailing commas in arrays/objects
 *   - single quotes around strings
 *
 * The recovery path is best-effort: if strict JSON.parse fails, we run a
 * sequence of regex repairs and try again. If recovery also fails, we throw
 * with the original parse error.
 */
export function parseLLMJson<T = unknown>(raw: string, model: string): T {
  let text = raw.trim();
  // Strip ```json ... ``` or ``` ... ```
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1]!.trim();

  // Try to locate the first JSON array or object in the text.
  const firstArray = text.indexOf("[");
  const firstObject = text.indexOf("{");
  let start = -1;
  if (firstArray === -1) start = firstObject;
  else if (firstObject === -1) start = firstArray;
  else start = Math.min(firstArray, firstObject);

  if (start > 0) text = text.slice(start);

  // Also trim any trailing garbage after the matching outer bracket.
  text = sliceToOuterBracket(text);

  try {
    return JSON.parse(text) as T;
  } catch (firstErr) {
    // Recovery pass — fix common LLM JSON quirks and try once more.
    const repaired = repairLooseJson(text);
    try {
      return JSON.parse(repaired) as T;
    } catch {
      throw new LLMError(
        `Failed to parse ${model} response as JSON: ${(firstErr as Error).message}`,
        "PARSE_ERROR",
        model,
      );
    }
  }
}

/** Return the substring from start up to the matching closing bracket of the
 *  outer JSON value. Handles strings (including escapes) so brackets inside
 *  string literals don't confuse the counter. */
function sliceToOuterBracket(text: string): string {
  if (!text) return text;
  const open = text[0];
  if (open !== "[" && open !== "{") return text;
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inStr) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(0, i + 1);
    }
  }
  return text;
}

/** Best-effort repair of loose LLM JSON. Does NOT guarantee valid output —
 *  the caller catches a second JSON.parse failure and reports the original
 *  error.
 *
 *  Handles the most common LLM JSON quirks observed in the wild:
 *    - trailing commas before } / ]
 *    - single-quoted strings instead of double-quoted
 *    - unquoted property names: `{ foo: ...}` → `{ "foo": ...}`
 *    - half-quoted property names: `{ foo": ...}` or `{ "foo: ...}` → `{ "foo": ...}`
 *
 *  The half-quoted pattern showed up in Hunyuan's critic output where the
 *  first key in an object would be properly quoted but subsequent keys would
 *  drop their opening quote, e.g.:
 *    `[{"vuln_class":"X", severity":"Y", line_start:15, ...}]`
 */
function repairLooseJson(text: string): string {
  // Strip trailing commas: `, }` / `, ]` → ` }` / ` ]`
  let t = text.replace(/,(\s*[}\]])/g, "$1");

  // Replace single-quoted strings with double-quoted ones — only when the
  // single quote isn't inside an already-double-quoted span. Per-line so we
  // don't span unrelated quotes.
  t = t
    .split("\n")
    .map((line) => {
      if (/"[^"]*'[^"]*"/.test(line)) return line;
      return line.replace(/'([^'\n]*?)'/g, '"$1"');
    })
    .join("\n");

  // Normalise property names: ensure they're wrapped in double quotes.
  // Pattern: `{` or `,` (whitespace) (optional opening quote) identifier
  //          (optional closing quote) `:` — replace with `{|,` + `"ident":`.
  // Capture group 1 is the leading delimiter + whitespace. We deliberately
  // drop any stray opening / closing quotes around the identifier.
  t = t.replace(/([{,]\s*)"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*:/g, '$1"$2":');

  return t;
}

export function withTimeout<T>(p: Promise<T>, ms: number, model: string, controller?: AbortController): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      controller?.abort();
      reject(new LLMError(`${model} timed out after ${ms}ms`, "TIMEOUT", model));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
