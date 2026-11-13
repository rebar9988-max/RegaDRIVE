/**
 * Session keep-alive (no UI). The session lives in an HttpOnly cookie that scripts cannot read, so the only way to
 * keep it sliding forward is to let the server see it: one cheap GET /api/me per launch and per return to the app
 * (at most every 6 hours). Failures are ignored on purpose; a network or server error never signs anyone out.
 */
const EVERY_MS = 6 * 3600_000;
let last = 0;

async function ping(): Promise<void> {
  const now = Date.now();
  if (now - last < EVERY_MS) return;
  last = now;
  try { await fetch("/api/me", { credentials: "same-origin", headers: { accept: "application/json" } }); }
  catch { last = 0; /* offline: try again on the next launch or return */ }
}

export function keepSignedIn(): void {
  void ping();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void ping(); });
  window.addEventListener("online", () => { void ping(); });
}
