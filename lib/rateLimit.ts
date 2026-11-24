// NOTE: in-memory state is per server instance. On serverless platforms (Vercel) every
// instance has its own counters, so limits are only approximate. For production use a shared
// store such as Redis or Upstash (e.g. @upstash/ratelimit) and keep this same interface.

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export interface Clock {
  now: () => number;
}

/** Sliding-window limiter: at most `limit` hits per `windowMs` for each key. */
export function createRateLimiter(opts: { limit: number; windowMs: number } & Partial<Clock>) {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  function sweep(t: number) {
    if (t - lastSweep < opts.windowMs) return;
    lastSweep = t;
    for (const [key, list] of hits) {
      if (list.every((h) => t - h >= opts.windowMs)) hits.delete(key);
    }
  }

  return {
    check(key: string): RateLimitResult {
      const t = now();
      sweep(t);
      const recent = (hits.get(key) ?? []).filter((h) => t - h < opts.windowMs);
      if (recent.length >= opts.limit) {
        hits.set(key, recent);
        const retryAfterSec = Math.max(1, Math.ceil((recent[0] + opts.windowMs - t) / 1000));
        return { allowed: false, retryAfterSec };
      }
      recent.push(t);
      hits.set(key, recent);
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

/** Global counter that resets at the start of each UTC day. */
export function createDailyCap(opts: { cap: number } & Partial<Clock>) {
  const now = opts.now ?? Date.now;
  let day = dayOf(now());
  let count = 0;

  function dayOf(t: number) {
    return new Date(t).toISOString().slice(0, 10);
  }

  return {
    /** Returns false when today's budget is exhausted. */
    consume(): boolean {
      const today = dayOf(now());
      if (today !== day) {
        day = today;
        count = 0;
      }
      if (count >= opts.cap) return false;
      count++;
      return true;
    },
  };
}

export const RATE_LIMIT_PER_MINUTE = 10;
export const DEFAULT_DAILY_CAP = 2000;

export function parseDailyCap(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

let ipLimiter = createRateLimiter({ limit: RATE_LIMIT_PER_MINUTE, windowMs: 60_000 });
let dailyCap = createDailyCap({ cap: parseDailyCap(process.env.DAILY_REQUEST_CAP) });

export function checkIpLimit(ip: string): RateLimitResult {
  return ipLimiter.check(ip);
}

export function consumeDailyCap(): boolean {
  return dailyCap.consume();
}

/** Test helper: reset module-level state. */
export function resetLimits(cap?: number) {
  ipLimiter = createRateLimiter({ limit: RATE_LIMIT_PER_MINUTE, windowMs: 60_000 });
  dailyCap = createDailyCap({ cap: cap ?? parseDailyCap(process.env.DAILY_REQUEST_CAP) });
}
