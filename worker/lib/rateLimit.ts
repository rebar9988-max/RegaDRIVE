/** Fixed-window limiter kept in isolate memory. Best effort only: it resets when the isolate is recycled. */
export class RateLimiter {
  private hits = new Map<string, { start: number; n: number }>();
  constructor(private max: number, private windowMs: number) {}
  allow(key: string, now: number): boolean {
    const h = this.hits.get(key);
    if (!h || now - h.start >= this.windowMs) {
      if (this.hits.size > 10_000) this.hits.clear();
      this.hits.set(key, { start: now, n: 1 });
      return true;
    }
    h.n += 1;
    return h.n <= this.max;
  }
}
