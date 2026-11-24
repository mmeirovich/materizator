import { describe, expect, it } from "vitest";
import { createDailyCap, createRateLimiter, parseDailyCap } from "@/lib/rateLimit";

describe("rate limiter", () => {
  it("allows 10 per minute per key and then blocks", () => {
    const t = 0;
    const rl = createRateLimiter({ limit: 10, windowMs: 60_000, now: () => t });
    for (let i = 0; i < 10; i++) expect(rl.check("a").allowed).toBe(true);
    const blocked = rl.check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
    expect(rl.check("b").allowed).toBe(true);
  });
  it("frees slots once the window has passed", () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    rl.check("a");
    rl.check("a");
    expect(rl.check("a").allowed).toBe(false);
    t = 1001;
    expect(rl.check("a").allowed).toBe(true);
  });
});

describe("daily cap", () => {
  it("stops after the cap and resets the next UTC day", () => {
    let t = Date.UTC(2026, 0, 1, 12);
    const cap = createDailyCap({ cap: 2, now: () => t });
    expect(cap.consume()).toBe(true);
    expect(cap.consume()).toBe(true);
    expect(cap.consume()).toBe(false);
    t = Date.UTC(2026, 0, 2, 0, 0, 1);
    expect(cap.consume()).toBe(true);
  });
  it("parses DAILY_REQUEST_CAP with a default of 2000", () => {
    expect(parseDailyCap(undefined)).toBe(2000);
    expect(parseDailyCap("abc")).toBe(2000);
    expect(parseDailyCap("-5")).toBe(2000);
    expect(parseDailyCap("50")).toBe(50);
  });
});
