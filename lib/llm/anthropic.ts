import { buildMessages, SYSTEM_PROMPT } from "../prompt";
import { MAX_OUTPUT_TOKENS, postJson, requireKey, TEMPERATURE } from "./http";
import { LlmError, type Provider } from "./types";

export const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-5-5";

interface AnthropicResponse {
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function createAnthropic(apiKey: string | undefined, model?: string): Provider {
  const modelId = model || ANTHROPIC_DEFAULT_MODEL;
  return {
    name: "anthropic",
    model: modelId,
    async complete(text, examples) {
      const key = requireKey("anthropic", apiKey);
      const data = (await postJson(
        "anthropic",
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        {
          model: modelId,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
          // cache_control marks the fixed prefix; it only takes effect once the prefix
          // exceeds the model's minimum cacheable length, and is harmless below it.
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: buildMessages(text, examples),
        },
      )) as AnthropicResponse;

      if (data.stop_reason === "refusal") throw new LlmError("refusal", "anthropic");
      const out = (data.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim();
      return {
        text: out,
        usage: { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
      };
    },
  };
}
