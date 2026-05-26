import { LLMError } from "./types.js";

/** Strip markdown code fences and parse the first JSON array/object. */
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

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new LLMError(
      `Failed to parse ${model} response as JSON: ${(err as Error).message}`,
      "PARSE_ERROR",
      model,
    );
  }
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
