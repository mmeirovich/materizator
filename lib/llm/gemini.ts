import { buildMessages, SYSTEM_PROMPT } from "../prompt";
import { MAX_OUTPUT_TOKENS, postJson, requireKey, TEMPERATURE } from "./http";
import { LlmError, type Provider } from "./types";

// Default per ai.google.dev: gemini-2.5-flash-lite is no longer offered to new projects,
// while gemini-3.5-flash-lite is the recommended Flash-Lite model.
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";

const BLOCKED_FINISH = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "RECITATION",
  "IMAGE_SAFETY",
]);

interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/** Keep the token budget for the answer: disable / minimise "thinking". */
function thinkingConfig(model: string) {
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: 0 };
  if (/gemini-3/.test(model)) return { thinkingLevel: "minimal" };
  return undefined;
}

export function createGemini(apiKey: string | undefined, model?: string): Provider {
  const modelId = model || GEMINI_DEFAULT_MODEL;
  return {
    name: "gemini",
    model: modelId,
    async complete(text, examples) {
      const key = requireKey("gemini", apiKey);
      const contents = buildMessages(text, examples).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const data = (await postJson(
        "gemini",
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
        { "x-goog-api-key": key },
        {
          // Fixed prefix (system prompt + examples) is cached implicitly by Gemini 2.5+.
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: TEMPERATURE,
            thinkingConfig: thinkingConfig(modelId),
          },
          // The game needs profanity; relax the default thresholds for non-hate categories.
          safetySettings: [
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
          ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
        },
      )) as GeminiResponse;

      if (data.promptFeedback?.blockReason) throw new LlmError("blocked", "gemini");
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason && BLOCKED_FINISH.has(candidate.finishReason)) {
        throw new LlmError("blocked", "gemini");
      }
      const out = (candidate?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      return {
        text: out,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        },
      };
    },
  };
}
