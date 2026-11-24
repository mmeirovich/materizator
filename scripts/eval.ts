/**
 * Compare models on the four reference phrases.
 *   npm run eval
 *   npm run eval -- --provider anthropic --model claude-haiku-5-5
 * Each case is run with its own example removed from the few-shot block.
 * Reference outputs are for human comparison only; checks are sanity checks, not exact match.
 */
import { existsSync } from "node:fs";
import { createProvider, isProviderName } from "../lib/llm";
import { EXAMPLES } from "../lib/prompt";
import { isMostlyCyrillic } from "../lib/validate";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const providerName = flag("provider");
if (providerName && !isProviderName(providerName)) {
  console.error(`Unknown provider "${providerName}". Use gemini | anthropic | openai.`);
  process.exit(1);
}
const provider = providerName
  ? createProvider(providerName, flag("model"))
  : createProvider(process.env.LLM_PROVIDER || "gemini", flag("model") || process.env.LLM_MODEL);

interface Row {
  case: number;
  ok: boolean;
  checks: string;
  ms: number;
  tokens: string;
}

async function main() {
  console.log(`Provider: ${provider.name}  Model: ${provider.model}\n`);
  const rows: Row[] = [];

  for (const [i, ex] of EXAMPLES.entries()) {
    const others = EXAMPLES.filter((e) => e !== ex);
    const started = Date.now();
    let output = "";
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    let failure = "";
    try {
      const c = await provider.complete(ex.input, others);
      output = c.text.trim();
      usage = c.usage;
    } catch (err) {
      failure = err instanceof Error ? err.message : "request failed";
    }
    const ms = Date.now() - started;

    const checks = {
      "non-empty": output.length > 0,
      cyrillic: output.length > 0 && isMostlyCyrillic(output),
      "differs from input": output.length > 0 && output !== ex.input,
      "not ERROR": output !== "ERROR",
    };
    const failed = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    const tokens =
      usage?.inputTokens != null || usage?.outputTokens != null
        ? `${usage?.inputTokens ?? "?"} in / ${usage?.outputTokens ?? "?"} out`
        : "n/a";

    console.log(`#${i + 1}`);
    console.log(`  input:     ${ex.input}`);
    console.log(`  output:    ${failure ? `(failed: ${failure})` : output}`);
    console.log(`  reference: ${ex.output}`);
    console.log(`  latency:   ${ms} ms   tokens: ${tokens}`);
    console.log(
      `  checks:    ${failure || failed.length ? `FAIL (${failure || failed.join(", ")})` : "ok"}\n`,
    );

    rows.push({
      case: i + 1,
      ok: !failure && failed.length === 0,
      checks: failure ? "request failed" : failed.length ? failed.join(", ") : "all passed",
      ms,
      tokens,
    });
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log("Summary");
  console.log(
    `${pad("Provider/model", 36)}${pad("Case", 6)}${pad("Result", 8)}${pad("ms", 8)}${pad("Tokens", 20)}Checks`,
  );
  for (const r of rows) {
    console.log(
      `${pad(`${provider.name}/${provider.model}`, 36)}${pad(String(r.case), 6)}${pad(r.ok ? "PASS" : "FAIL", 8)}${pad(String(r.ms), 8)}${pad(r.tokens, 20)}${r.checks}`,
    );
  }
  const passed = rows.filter((r) => r.ok).length;
  const avg = Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length);
  console.log(`\n${passed}/${rows.length} passed, avg latency ${avg} ms`);
  console.log("Reading the outputs yourself is the real test: check gender/case/tense agreement.");
  process.exit(passed === rows.length ? 0 : 1);
}

main();
