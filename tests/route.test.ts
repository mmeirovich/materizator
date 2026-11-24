import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm")>("@/lib/llm");
  return { ...actual, rewrite: vi.fn() };
});

import { POST } from "@/app/api/rewrite/route";
import { LlmError, rewrite } from "@/lib/llm";
import { resetLimits } from "@/lib/rateLimit";

const mocked = vi.mocked(rewrite);

function req(body: unknown, ip = "1.1.1.1") {
  return new Request("http://localhost/api/rewrite", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocked.mockReset();
  resetLimits(2000);
});

describe("POST /api/rewrite", () => {
  it("returns the rewritten text", async () => {
    mocked.mockResolvedValue("Эта хуйня охуенная");
    const res = await POST(req({ text: " Это дерево высокое " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "Эта хуйня охуенная" });
    expect(mocked).toHaveBeenCalledWith("Это дерево высокое");
  });

  it("rejects invalid input", async () => {
    const english = await POST(req({ text: "Hello world" }));
    expect(english.status).toBe(400);
    expect((await english.json()).error).toBe("Калякай по человечески, долбоеб!");
    expect((await POST(req({ text: "" }))).status).toBe(400);
    expect((await POST(req({ text: "а".repeat(501) }))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req("not json"))).status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 422 when the model answers ERROR", async () => {
    mocked.mockRejectedValue(new LlmError("rejected", "gemini"));
    const res = await POST(req({ text: "абв" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Не получилось. Попробуйте другую фразу");
  });

  it("returns 502 without leaking details when the provider fails", async () => {
    mocked.mockRejectedValue(new LlmError("http", "gemini", 500));
    const res = await POST(req({ text: "абв" }));
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("gemini");
  });

  it("returns 429 after 10 requests per minute from one IP", async () => {
    mocked.mockResolvedValue("Хуй");
    for (let i = 0; i < 10; i++) expect((await POST(req({ text: "абв" }))).status).toBe(200);
    const res = await POST(req({ text: "абв" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect((await POST(req({ text: "абв" }, "2.2.2.2"))).status).toBe(200);
  });

  it("returns 503 once the daily cap is exhausted", async () => {
    resetLimits(1);
    mocked.mockResolvedValue("Хуй");
    expect((await POST(req({ text: "абв" }))).status).toBe(200);
    expect((await POST(req({ text: "абв" }, "3.3.3.3"))).status).toBe(503);
  });
});
