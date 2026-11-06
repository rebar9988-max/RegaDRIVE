// Bounded retry with exponential backoff (+ small jitter). Never retries forever; never retries non-recoverable errors.
export async function retry(fn, { attempts = 4, baseMs = 2000, maxMs = 16000, isRecoverable = () => true, onRetry = () => {} } = {}) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(i); }
    catch (err) {
      last = err;
      if (i === attempts || !isRecoverable(err)) break;
      const wait = Math.min(maxMs, baseMs * 2 ** (i - 1)) + Math.floor(Math.random() * 250);
      onRetry(err, i, wait);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

/** Network-type failures are recoverable; assertion/logic failures are not. */
export const isNetworkError = (e) => /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|socket hang up|fetch failed|429|50[234]/i.test(String(e?.message ?? e) + String(e?.cause?.code ?? ""));
