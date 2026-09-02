import { type NextFunction, type Request, type Response } from 'express';

const CAPACITY = 500;
const COST_PER_ATTEMPT = 50;
const REFILL_AMOUNT = 50;
const REFILL_INTERVAL_MS = 5_000; // refill every 5s

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  const existing = buckets.get(key);
  if (existing) {
    return existing;
  }
  const fresh: Bucket = { tokens: CAPACITY, lastRefill: Date.now() };
  buckets.set(key, fresh);
  return fresh;
}

function refill(bucket: Bucket): void {
  const elapsed = Date.now() - bucket.lastRefill;
  if (elapsed < REFILL_INTERVAL_MS) {
    return;
  }
  const intervals = Math.floor(elapsed / REFILL_INTERVAL_MS);
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + intervals * REFILL_AMOUNT);
  bucket.lastRefill = Date.now();
}

export const loginRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const key = req.ip ?? 'unknown';
  const bucket = getBucket(key);
  refill(bucket);

  if (bucket.tokens < COST_PER_ATTEMPT) {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many login attempts. Try again in a few seconds.',
    });
    return;
  }

  bucket.tokens -= COST_PER_ATTEMPT;
  next();
};
