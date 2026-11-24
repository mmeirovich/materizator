import { describe, expect, it } from "vitest";
import { cyrillicRatio, validateInput } from "@/lib/validate";

describe("validateInput", () => {
  it("accepts and trims Russian text", () => {
    expect(validateInput("  Это дерево  ")).toEqual({ ok: true, text: "Это дерево" });
  });
  it("rejects non-strings and empty input", () => {
    expect(validateInput(42).ok).toBe(false);
    expect(validateInput("   ").ok).toBe(false);
  });
  it("rejects text over 300 characters", () => {
    expect(validateInput("а".repeat(301)).ok).toBe(false);
    expect(validateInput("а".repeat(300)).ok).toBe(true);
  });
  it("rejects mostly non-Cyrillic text with the Russian error", () => {
    expect(validateInput("Hello there my friend")).toEqual({
      ok: false,
      error: "Калякай по человечески, долбоеб!",
    });
  });
  it("rejects text with no letters", () => {
    expect(validateInput("12345 !!!").ok).toBe(false);
  });
  it("accepts mixed text at or above 50% Cyrillic, ignoring digits and punctuation", () => {
    expect(validateInput("Привет, 123 ok!").ok).toBe(true);
    expect(validateInput("Привет hello world").ok).toBe(false);
  });
  it("computes the ratio over letters only", () => {
    expect(cyrillicRatio("аб cd")).toBe(0.5);
    expect(cyrillicRatio("")).toBe(0);
  });
});
