import { buildMessages, SYSTEM_PROMPT } from "../prompt";
import { MAX_OUTPUT_TOKENS, postJson, requireKey, TEMPERATURE } from "./http";
import { LlmError, type Provider } from "./types";

export const OPENAI_DEFAULT_MODEL = "gpt-5-nano";

interface OpenAIResponse {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Lowest reasoning effort so output tokens are not spent on thinking. */
function reasoningEffort(model: string): string | undefined {
  if (/^gpt-5\.\d/.test(model)) return "none";
  if (/^gpt-5/.test(model)) return "minimal";
  if (/^o\d/.test(model)) return "low";
  return undefined;
}

export function createOpenAI(apiKey: string | undefined, model?: string): Provider {
  const modelId = model || OPENAI_DEFAULT_MODEL;
  const effort = reasoningEffort(modelId);
  return {
    name: "openai",
    model: modelId,
    async complete(text, examples) {
      const key = requireKey("openai", apiKey);
      const data = (await postJson(
        "openai",
        "https://api.openai.com/v1/chat/completions",
        { authorization: `Bearer ${key}` },
        {
          model: modelId,
          max_completion_tokens: MAX_OUTPUT_TOKENS,
          // Reasoning models only accept the default temperature, so send it for others only.
          ...(effort ? { reasoning_effort: effort } : { temperature: TEMPERATURE }),
          // Prompts over 1024 tokens are cached automatically; the fixed prefix goes first.
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...buildMessages(text, examples)],
        },
      )) as OpenAIResponse;

      const choice = data.choices?.[0];
      if (choice?.message?.refusal) throw new LlmError("refusal", "openai");
      if (choice?.finish_reason === "content_filter") throw new LlmError("blocked", "openai");
      return {
        text: (choice?.message?.content ?? "").trim(),
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
      };
    },
  };
}
