/**
 * Runs background work (service worker install, warming up the other screens) only after the page has loaded, a
 * short pause has passed and the browser is idle — so none of it competes with the first screen for bandwidth.
 * Returns a cancel function.
 */
export const AFTER_LOAD_DELAY_MS = 2500;

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };

export function afterLoad(fn: () => void, w: IdleWindow = window, doc: Pick<Document, "readyState"> = document): () => void {
  let timer: number | undefined, idle: number | undefined, cancelled = false;
  const idleThen = () => {
    if (cancelled) return;
    if (typeof w.requestIdleCallback === "function") idle = w.requestIdleCallback(() => { if (!cancelled) fn(); }, { timeout: 3000 });
    else fn();
  };
  const start = () => { if (!cancelled) timer = w.setTimeout(idleThen, AFTER_LOAD_DELAY_MS); };
  if (doc.readyState === "complete") start(); else w.addEventListener("load", start, { once: true });
  return () => {
    cancelled = true;
    w.removeEventListener("load", start);
    if (timer !== undefined) w.clearTimeout(timer);
    if (idle !== undefined) w.cancelIdleCallback?.(idle);
  };
}
