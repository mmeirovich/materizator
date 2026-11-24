import { NextResponse } from "next/server";
import { LlmError, rewrite } from "@/lib/llm";
import { checkIpLimit, consumeDailyCap } from "@/lib/rateLimit";
import { validateInput } from "@/lib/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

const MSG = {
  badJson: "Некорректный запрос",
  rejected: "Не получилось. Попробуйте другую фразу",
  rateLimit: "Слишком много запросов. Подождите минуту",
  dailyCap: "На сегодня лимит запросов исчерпан. Приходите завтра",
  unavailable: "Сервис временно недоступен. Попробуйте позже",
  notConfigured: "Сервис не настроен",
  generic: "Что-то пошло не так. Попробуйте ещё раз",
} as const;

function fail(error: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const limit = checkIpLimit(clientIp(req));
  if (!limit.allowed) {
    return fail(MSG.rateLimit, 429, { "Retry-After": String(limit.retryAfterSec) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(MSG.badJson, 400);
  }

  const validation = validateInput((body as { text?: unknown } | null)?.text);
  if (!validation.ok) return fail(validation.error, 400);

  if (!consumeDailyCap()) return fail(MSG.dailyCap, 503);

  try {
    const result = await rewrite(validation.text);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof LlmError) {
      switch (err.kind) {
        case "rejected":
        case "blocked":
        case "refusal":
          return fail(MSG.rejected, 422);
        case "config":
          return fail(MSG.notConfigured, 500);
        default:
          return fail(MSG.unavailable, 502);
      }
    }
    return fail(MSG.generic, 500);
  }
}
