import { isMostlyCyrillic } from "../validate";
import { createAnthropic } from "./anthropic";
import { createGemini } from "./gemini";
import { createOpenAI } from "./openai";
import { LlmError, type Completion, type Provider, type ProviderName } from "./types";

export { LlmError } from "./types";
export type { Provider, ProviderName, Completion, Usage } from "./types";

type Env = Record<string, string | undefined>;

const PROVIDERS: readonly ProviderName[] = ["gemini", "anthropic", "openai"];
const RETRY_DELAY_MS = 400;
/** Extra attempts on the primary provider after the first one fails. */
export const MAX_RETRIES = 4;
/** Stop retrying once this much time has passed, so we stay inside the route's time limit. */
const TIME_BUDGET_MS = 50_000;

const REFUSAL_START =
  /^(извините|простите|к сожалению|я не могу|не могу (помочь|выполнить|ответить)|я не буду|sorry|i can'?t|i cannot|i'm sorry|i am sorry|i'm unable|i am unable)/i;

export function isProviderName(value: string | undefined): value is ProviderName {
  return PROVIDERS.includes(value as ProviderName);
}

/** Build a provider by name; model falls back to the provider default. */
export function createProvider(
  name: string | undefined,
  model?: string,
  env: Env = process.env,
): Provider {
  switch (name) {
    case "gemini":
      return createGemini(env.GEMINI_API_KEY, model);
    case "anthropic":
      return createAnthropic(env.ANTHROPIC_API_KEY, model);
    case "openai":
      return createOpenAI(env.OPENAI_API_KEY, model);
    default:
      throw new LlmError("config", String(name));
  }
}

/** Primary provider from LLM_PROVIDER (default gemini); LLM_MODEL overrides its model. */
export function selectProvider(env: Env = process.env): Provider {
  return createProvider(
    env.LLM_PROVIDER?.trim() || "gemini",
    env.LLM_MODEL?.trim() || undefined,
    env,
  );
}

/** Fallback from LLM_FALLBACK_PROVIDER, always with its default model. */
export function selectFallback(env: Env = process.env): Provider | null {
  const name = env.LLM_FALLBACK_PROVIDER?.trim();
  if (!name || name === (env.LLM_PROVIDER?.trim() || "gemini")) return null;
  return createProvider(name, undefined, env);
}

/** Turn a raw model answer into a final phrase, or throw the matching LlmError. */
export function checkOutput(provider: string, raw: string): string {
  const text = raw
    .trim()
    .replace(/^["«„“]+|["»“”]+$/g, "")
    .trim();
  if (!text) throw new LlmError("empty", provider);
  if (text === "ERROR") throw new LlmError("rejected", provider);
  if (REFUSAL_START.test(text)) throw new LlmError("refusal", provider);
  if (!isMostlyCyrillic(text)) throw new LlmError("bad_output", provider);
  return text;
}

function logCall(p: Provider, started: number, status: string, usage?: Completion["usage"]) {
  // Metadata only: never log the user's text or the model output.
  console.info(
    JSON.stringify({
      event: "llm_call",
      provider: p.name,
      model: p.model,
      latencyMs: Date.now() - started,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      status,
    }),
  );
}

async function attempt(p: Provider, text: string): Promise<string> {
  const started = Date.now();
  try {
    const completion = await p.complete(text);
    const result = checkOutput(p.name, completion.text);
    logCall(p, started, "ok", completion.usage);
    return result;
  } catch (err) {
    const e = err instanceof LlmError ? err : new LlmError("http", p.name);
    logCall(p, started, e.kind);
    throw e;
  }
}

export interface RewriteOptions {
  env?: Env;
  sleep?: (ms: number) => Promise<void>;
  /** Extra attempts on the primary provider (default 4, so up to 5 tries in total). */
  retries?: number;
  now?: () => number;
}

/**
 * Rewrite a phrase. Retries the primary provider up to MAX_RETRIES more times (with a growing
 * delay), then tries the fallback provider (if configured). "ERROR" answers are final and are
 * never retried. Retrying also stops once the time budget is used up.
 */
export async function rewrite(text: string, opts: RewriteOptions = {}): Promise<string> {
  const env = opts.env ?? process.env;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const now = opts.now ?? Date.now;
  const started = now();
  const retries = opts.retries ?? MAX_RETRIES;

  const chain = [selectProvider(env), selectFallback(env)].filter((p): p is Provider => p !== null);
  let last: LlmError | undefined;

  for (const [i, provider] of chain.entries()) {
    const tries = i === 0 ? 1 + retries : 1;
    for (let n = 0; n < tries; n++) {
      try {
        return await attempt(provider, text);
      } catch (err) {
        last = err as LlmError;
        if (last.kind === "rejected") throw last;
        if (!last.retriable) break;
        if (n < tries - 1) {
          if (now() - started > TIME_BUDGET_MS) break;
          await sleep(RETRY_DELAY_MS * (n + 1));
        }
      }
    }
  }
  throw last ?? new LlmError("http", "unknown");
}
