/** Fixed-window limiter kept in isolate memory. Best effort only: it resets when the isolate is recycled. */
export class RateLimiter {
  private hits = new Map<string, { start: number; n: number }>();
  constructor(private max: number, private windowMs: number) {}
  allow(key: string, now: number): boolean {
    const h = this.hits.get(key);
    if (!h || now - h.start >= this.windowMs) {
      // Evict only expired counters. Clearing the entire map lets a flood of
      // distinct identities reset limits for clients that are already blocked.
      if (!h && this.hits.size >= 10_000) {
        for (const [client, hit] of this.hits) {
          if (now - hit.start >= this.windowMs) this.hits.delete(client);
        }
        // Fail closed for new identities while all bounded slots are active.
        if (this.hits.size >= 10_000) return false;
      }
      this.hits.set(key, { start: now, n: 1 });
      return true;
    }
    h.n += 1;
    return h.n <= this.max;
  }
}
