import type { Example } from "../prompt";

export type ProviderName = "gemini" | "anthropic" | "openai";

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface Completion {
  text: string;
  usage?: Usage;
}

/** A single-attempt provider call. Retry/fallback logic lives in index.ts. */
export interface Provider {
  readonly name: ProviderName;
  readonly model: string;
  complete(text: string, examples?: readonly Example[]): Promise<Completion>;
}

export type LlmErrorKind =
  | "rate_limit" // HTTP 429 / overloaded
  | "blocked" // safety or content filter
  | "empty" // no text returned
  | "refusal" // model says it cannot help
  | "bad_output" // not Russian
  | "timeout"
  | "http" // other HTTP / network failure
  | "config" // missing key, unknown provider
  | "rejected"; // model answered ERROR: input not suitable

/** The single error type every provider failure is normalized into. */
export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${kind}${status ? ` (${status})` : ""}`);
    this.name = "LlmError";
  }

  /** Worth one more attempt against the same provider. */
  get retriable(): boolean {
    return this.kind !== "config" && this.kind !== "rejected";
  }
}
