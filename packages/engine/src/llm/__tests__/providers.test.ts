import { describe, it, expect, vi } from "vitest";
import {
  CHAINGPT_ENDPOINT,
  GROQ_ENDPOINT,
  createChainGPTProvider,
  createGeminiProvider,
  createGroqProvider,
} from "../providers/index.js";
import type { FetchLike } from "../json.js";

function mockFetch(responses: Record<string, { ok: boolean; status?: number; text?: string; json?: unknown }>): FetchLike {
  return vi.fn(async (url: string) => {
    const key = Object.keys(responses).find((k) => url.startsWith(k));
    if (!key) throw new Error(`unmocked url: ${url}`);
    const r = responses[key]!;
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      text: async () => r.text ?? "",
      json: async () => r.json ?? JSON.parse(r.text ?? "{}"),
    };
  });
}

describe("createChainGPTProvider", () => {
  it("posts a single composed prompt with bearer auth", async () => {
    const fetchFn = mockFetch({ [CHAINGPT_ENDPOINT]: { ok: true, text: '[{"vuln_class":"reentrancy"}]' } });
    const provider = createChainGPTProvider({ apiKey: "k", fetchFn });
    const res = await provider.chat({ systemPrompt: "sys", userPrompt: "src" });
    expect(res.provider).toBe("chaingpt");
    expect(res.text).toContain("reentrancy");

    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]![0]).toBe(CHAINGPT_ENDPOINT);
    expect(calls[0]![1].headers.authorization).toBe("Bearer k");
    const body = JSON.parse(calls[0]![1].body);
    expect(body.question).toContain("sys");
    expect(body.question).toContain("src");
    expect(body.chatHistory).toBe("off");
  });

  it("throws LLMError on non-2xx", async () => {
    const fetchFn = mockFetch({ [CHAINGPT_ENDPOINT]: { ok: false, status: 502, text: "bad gateway" } });
    const provider = createChainGPTProvider({ apiKey: "k", fetchFn });
    await expect(provider.chat({ systemPrompt: "", userPrompt: "x" })).rejects.toMatchObject({
      code: "API_ERROR",
      model: "chaingpt",
    });
  });

  it("rejects construction with missing key", () => {
    expect(() => createChainGPTProvider({ apiKey: "" })).toThrow(/CHAINGPT_API_KEY/);
  });
});

describe("createGeminiProvider", () => {
  it("appends api key as query param and parses candidates", async () => {
    const fetchFn = mockFetch({
      "https://generativelanguage.googleapis.com": {
        ok: true,
        json: { candidates: [{ content: { parts: [{ text: '[{"vuln_class":"x"}]' }] } }] },
      },
    });
    const provider = createGeminiProvider({ apiKey: "g", fetchFn });
    const res = await provider.chat({ systemPrompt: "sys", userPrompt: "src", jsonMode: true });
    expect(res.text).toContain("vuln_class");
    const url = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toContain("key=g");
  });
});

describe("createGroqProvider", () => {
  it("uses OpenAI-shaped messages and parses choices[0].message.content", async () => {
    const fetchFn = mockFetch({
      [GROQ_ENDPOINT]: { ok: true, json: { choices: [{ message: { content: '[{"vuln_class":"y"}]' } }] } },
    });
    const provider = createGroqProvider({ apiKey: "gk", fetchFn });
    const res = await provider.chat({ systemPrompt: "sys", userPrompt: "src" });
    expect(res.text).toContain("vuln_class");
    const body = JSON.parse((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]![1].body);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
  });
});
