# Материзатор (Materizator)

A small Russian-only word game. You type a short Russian phrase; an LLM rewrites it so every noun, adjective and verb becomes a Russian profanity (мат), keeping the grammar correct. Adults only (age gate). Built with Next.js (App Router), TypeScript and Tailwind CSS.

## Setup

```bash
npm install
cp .env.example .env.local   # then set GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Only the key for the provider you use is required (`GEMINI_API_KEY` by default). Keys are read on the server only and are never sent to the client.

## Environment variables

| Variable                | Description                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `LLM_PROVIDER`          | `gemini` (default), `anthropic` or `openai`                                                  |
| `LLM_MODEL`             | Optional model override. Defaults: `gemini-3.5-flash-lite`, `claude-haiku-5-5`, `gpt-5-nano` |
| `GEMINI_API_KEY`        | Google Gemini API key                                                                        |
| `ANTHROPIC_API_KEY`     | Anthropic API key                                                                            |
| `OPENAI_API_KEY`        | OpenAI API key                                                                               |
| `LLM_FALLBACK_PROVIDER` | Optional provider tried (with its default model) when the primary fails twice                |
| `DAILY_REQUEST_CAP`     | Global requests per UTC day across all users (default `2000`)                                |

### Gemini model note

`gemini-2.5-flash-lite` is not retired, but Google's docs say access is limited to users who already used it, and recommend `gemini-3.5-flash-lite` for new projects. The default is therefore `gemini-3.5-flash-lite`. Set `LLM_MODEL=gemini-2.5-flash-lite` if your account has access. Verify the current id at <https://ai.google.dev/gemini-api/docs/models>. Thinking is disabled or minimal for Gemini so the 150-token output budget is not spent on reasoning.

## Providers

| Provider  | Default model           | Price per 1M tokens (input / output)                                      | Notes                                           |
| --------- | ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| Gemini    | `gemini-3.5-flash-lite` | Free tier; paid about $0.10 / $0.40 (2.5 Flash-Lite), $0.30 / $2.50 (3.5) | Cheapest to start; free tier is rate-limited    |
| Anthropic | `claude-haiku-5-5`      | about $0.10 / $0.50                                                       | More reliable Russian grammar                   |
| OpenAI    | `gpt-5-nano`            | about $0.05 / $0.40                                                       | Reasoning model, run at lowest reasoning effort |

Prices change; check the official pricing pages. A request is about 600 input and under 100 output tokens, so each one costs a small fraction of a cent.

## Choosing and comparing models

```bash
npm run eval                                           # uses LLM_PROVIDER / LLM_MODEL
npm run eval -- --provider anthropic                   # default model of that provider
npm run eval -- --provider openai --model gpt-5-nano
```

The script runs the four reference phrases (each with its own example removed from the few-shot block), then prints input, output, reference, latency, token counts, sanity checks (non-empty, mostly Cyrillic, differs from input, not `ERROR`) and a summary table. References are for human comparison only, not an exact-match test. Run it once per provider and compare the outputs side by side.

**If grammar agreement breaks (wrong gender, case or tense) or the model refuses, switch to the next provider**: change `LLM_PROVIDER` (for example from `gemini` to `anthropic`), or set `LLM_FALLBACK_PROVIDER` so the app switches automatically after a failed retry.

## How the API behaves

`POST /api/rewrite` with `{ "text": "..." }` returns `{ "result": "..." }`.

- Input is trimmed, 1 to 300 characters, at least 50% Cyrillic letters (otherwise 400 `Калякай по человечески, долбоеб!`). The same check runs in the browser.
- Limits: 10 requests per minute per IP (429 with `Retry-After`) and a global daily cap (503). Both are in memory, so they are approximate on serverless hosting. For production use Redis or Upstash (see the comment in `lib/rateLimit.ts`).
- Provider failures (HTTP 429, safety block, empty answer, refusal, non-Russian output, timeout) are retried once, then the fallback provider is tried if set. If everything fails you get a Russian error message with no internal details.
- If the model answers `ERROR`, the route returns 422 `Не получилось. Попробуйте другую фразу`.
- Logs contain only provider, model, latency, token counts and status, never the user's text.

## Scripts

```bash
npm run dev | build | start
npm test           # Vitest
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run format     # Prettier
```

## Deploy to Vercel

1. Push the repository and import it in Vercel (framework preset: Next.js).
2. In Project Settings, Environment Variables, add `GEMINI_API_KEY` (or the key for your provider) and optionally `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_PROVIDER`, `DAILY_REQUEST_CAP`.
3. Deploy. Keys stay on the server and are never exposed to the client.

Serverless instances do not share memory, so move the rate limiter and daily cap to Upstash Redis before exposing the app widely.

## Disclaimer

Language game only. Do not use it to harass people.
