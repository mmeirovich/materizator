import { LlmError, type ProviderName } from "./types";

export const TIMEOUT_MS = 20_000;
export const MAX_OUTPUT_TOKENS = 300;
export const TEMPERATURE = 0.7;

/** POST JSON with a timeout; maps transport/HTTP failures to LlmError. Never logs bodies. */
export async function postJson(
  provider: ProviderName,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new LlmError(timedOut ? "timeout" : "http", provider);
  }
  if (res.status === 429 || res.status === 529)
    throw new LlmError("rate_limit", provider, res.status);
  if (res.status === 401 || res.status === 403) throw new LlmError("config", provider, res.status);
  if (!res.ok) throw new LlmError("http", provider, res.status);
  try {
    return await res.json();
  } catch {
    throw new LlmError("http", provider, res.status);
  }
}

export function requireKey(provider: ProviderName, key: string | undefined): string {
  if (!key) throw new LlmError("config", provider);
  return key;
}
