import { NextRequest } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

declare global {
  var __josealoRateLimitBuckets: Map<string, RateLimitBucket> | undefined;
}

function getBuckets() {
  if (!globalThis.__josealoRateLimitBuckets) {
    globalThis.__josealoRateLimitBuckets = new Map();
  }

  return globalThis.__josealoRateLimitBuckets;
}

export function getRateLimitKey(request: NextRequest, scope: string, subject = "") {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}:${subject.toLowerCase()}`;
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "") || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function checkRedisRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const config = getRedisConfig();
  if (!config) {
    return checkMemoryRateLimit(key, options);
  }

  const now = Date.now();
  const windowId = Math.floor(now / options.windowMs);
  const redisKey = `rate-limit:${key}:${windowId}`;
  const expireSeconds = Math.ceil(options.windowMs / 1000) + 10;

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, expireSeconds],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("rate-limit/unavailable");
  }

  const data = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  if (data[0]?.error) {
    throw new Error("rate-limit/unavailable");
  }

  const count = Number(data[0]?.result || 0);
  const resetAt = (windowId + 1) * options.windowMs;

  return {
    allowed: count <= options.max,
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

function checkMemoryRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const buckets = getBuckets();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;

  if (current.count > options.max) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfter: 0 };
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  try {
    return await checkRedisRateLimit(key, options);
  } catch (error) {
    console.error("rate limit check failed", error);

    if (getRedisConfig() && process.env.NODE_ENV === "production") {
      return { allowed: false, retryAfter: 60 };
    }

    return checkMemoryRateLimit(key, options);
  }
}
