import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmError, rewrite, selectFallback, selectProvider } from "@/lib/llm";

const sleep = async () => {};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const gem = (text: string) =>
  json({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 600, candidatesTokenCount: 10 },
  });
const claude = (text: string) =>
  json({
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: { input_tokens: 5, output_tokens: 5 },
  });
const gpt = (text: string) =>
  json({
    choices: [{ finish_reason: "stop", message: { content: text } }],
    usage: { prompt_tokens: 5, completion_tokens: 5 },
  });

const env = {
  LLM_PROVIDER: "gemini",
  GEMINI_API_KEY: "g",
  ANTHROPIC_API_KEY: "a",
  OPENAI_API_KEY: "o",
};

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("provider selection", () => {
  it("defaults to gemini and honours LLM_PROVIDER / LLM_MODEL", () => {
    expect(selectProvider({}).name).toBe("gemini");
    expect(selectProvider({ LLM_PROVIDER: "anthropic" })).toMatchObject({
      name: "anthropic",
      model: "claude-haiku-5-5",
    });
    expect(selectProvider({ LLM_PROVIDER: "openai" })).toMatchObject({
      name: "openai",
      model: "gpt-5-nano",
    });
    expect(selectProvider({ LLM_PROVIDER: "openai", LLM_MODEL: "x" }).model).toBe("x");
  });
  it("rejects unknown providers and reads the fallback", () => {
    expect(() => selectProvider({ LLM_PROVIDER: "nope" })).toThrow(LlmError);
    expect(selectFallback({ LLM_FALLBACK_PROVIDER: "openai" })?.name).toBe("openai");
    expect(selectFallback({})).toBeNull();
  });
});

describe("rewrite", () => {
  it("returns the model text and calls the right endpoint with the key in a header", async () => {
    const f = mockFetch(gem("Эта хуйня охуенная"));
    expect(await rewrite("Это дерево высокое", { env, sleep })).toBe("Эта хуйня охуенная");
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("generativelanguage.googleapis.com");
    expect(String(url)).not.toContain("key=");
    expect(init.headers["x-goog-api-key"]).toBe("g");
    const body = JSON.parse(init.body);
    expect(body.generationConfig.maxOutputTokens).toBe(150);
    expect(body.contents.at(-1).parts[0].text).toBe("Это дерево высокое");
  });

  it("works with anthropic and openai", async () => {
    mockFetch(claude("Хуёвая пизда"));
    expect(await rewrite("а", { env: { ...env, LLM_PROVIDER: "anthropic" }, sleep })).toBe(
      "Хуёвая пизда",
    );
    const f = mockFetch(gpt("Хуёвая пизда"));
    await rewrite("а", { env: { ...env, LLM_PROVIDER: "openai" }, sleep });
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBe("minimal");
    expect(body.max_completion_tokens).toBe(150);
    expect(body.temperature).toBeUndefined();
  });

  it('throws "rejected" on ERROR without retrying', async () => {
    const f = mockFetch(gem("ERROR"), gem("never"));
    await expect(rewrite("x", { env, sleep })).rejects.toMatchObject({ kind: "rejected" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries on HTTP 429 and succeeds on a later attempt", async () => {
    const f = mockFetch(json({}, 429), gem("Хуй"));
    expect(await rewrite("x", { env, sleep })).toBe("Хуй");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("succeeds on the fifth attempt (4 retries)", async () => {
    const f = mockFetch(json({}, 429), gem(""), json({}, 500), gem("Hello"), gem("Хуй"));
    expect(await rewrite("x", { env, sleep })).toBe("Хуй");
    expect(f).toHaveBeenCalledTimes(5);
  });

  it("fails after 5 attempts in total and no fallback", async () => {
    const f = mockFetch(...Array.from({ length: 6 }, () => json({}, 429)));
    await expect(rewrite("x", { env, sleep })).rejects.toMatchObject({ kind: "rate_limit" });
    expect(f).toHaveBeenCalledTimes(5);
  });

  it("waits a growing delay between attempts", async () => {
    const delays: number[] = [];
    mockFetch(...Array.from({ length: 5 }, () => json({}, 500)));
    await rewrite("x", { env, sleep: async (ms) => void delays.push(ms) }).catch(() => {});
    expect(delays).toEqual([400, 800, 1200, 1600]);
  });

  it("stops retrying when the time budget is spent", async () => {
    let t = 0;
    const f = mockFetch(...Array.from({ length: 5 }, () => json({}, 500)));
    await rewrite("x", { env, sleep, now: () => (t += 30_000) }).catch(() => {});
    expect(f.mock.calls.length).toBeLessThan(5);
  });

  it("does not retry non-retriable errors like a missing key", async () => {
    const f = mockFetch(json({}, 401));
    await expect(rewrite("x", { env, sleep })).rejects.toMatchObject({ kind: "config" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("treats a safety block as a failure", async () => {
    mockFetch(
      json({ promptFeedback: { blockReason: "SAFETY" } }),
      json({ candidates: [{ finishReason: "SAFETY" }] }),
      json({ promptFeedback: { blockReason: "SAFETY" } }),
      json({ candidates: [{ finishReason: "SAFETY" }] }),
      json({ promptFeedback: { blockReason: "SAFETY" } }),
    );
    await expect(rewrite("x", { env, sleep })).rejects.toMatchObject({ kind: "blocked" });
  });

  it("treats an empty response as a failure", async () => {
    mockFetch(...Array.from({ length: 5 }, () => gem("  ")));
    await expect(rewrite("x", { env, sleep })).rejects.toMatchObject({ kind: "empty" });
  });

  it("treats a refusal as a failure", async () => {
    mockFetch(...Array.from({ length: 5 }, () => gem("Извините, я не могу с этим помочь")));
    await expect(rewrite("x", { env, sleep })).rejects.toMatchObject({ kind: "refusal" });
  });

  it("treats non-Russian output as a failure", async () => {
    mockFetch(...Array.from({ length: 5 }, () => gem("Hello world")));
    await expect(rewrite("x", { env, sleep })).rejects.toMatchObject({ kind: "bad_output" });
  });

  it("uses the fallback provider after the primary fails twice", async () => {
    const f = mockFetch(...Array.from({ length: 5 }, () => json({}, 429)), claude("Хуёвая пизда"));
    const result = await rewrite("x", {
      env: { ...env, LLM_FALLBACK_PROVIDER: "anthropic" },
      sleep,
    });
    expect(result).toBe("Хуёвая пизда");
    expect(f).toHaveBeenCalledTimes(6);
    expect(String(f.mock.calls[5][0])).toContain("api.anthropic.com");
  });

  it("does not log user text", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockFetch(gem("Секретный ответ"));
    await rewrite("Секретная фраза", { env, sleep });
    const logged = info.mock.calls.flat().join(" ");
    expect(logged).toContain("gemini");
    expect(logged).not.toContain("Секретн");
  });

  it("reports a missing key as a config error", async () => {
    await expect(rewrite("x", { env: { LLM_PROVIDER: "gemini" }, sleep })).rejects.toMatchObject({
      kind: "config",
    });
  });
});
