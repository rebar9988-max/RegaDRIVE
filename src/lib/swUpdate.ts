/**
 * Only the newest release stays in use (owner rule, 2026-11-12). An app left open (installed PWA, background tab)
 * looks for a new release whenever it is shown again and every hour. When the new release has taken over, the page
 * reloads the next time it is hidden — never in front of the learner; exam answers and progress survive a reload.
 */
export interface UpdateDeps {
  sw: Pick<ServiceWorkerContainer, "controller" | "addEventListener">;
  doc: Pick<Document, "visibilityState" | "addEventListener">;
  reload: () => void;
  every: (fn: () => void, ms: number) => unknown;
}

export const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function keepCurrent(reg: Pick<ServiceWorkerRegistration, "update">, deps: UpdateDeps = {
  sw: navigator.serviceWorker, doc: document, reload: () => location.reload(), every: (fn, ms) => setInterval(fn, ms),
}): void {
  const { sw, doc, reload } = deps;
  const hadController = !!sw.controller; // first install: nothing old to replace
  let reloadWhenHidden = false;
  const check = () => { reg.update().catch(() => { /* offline: try again later */ }); };
  sw.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (doc.visibilityState === "hidden") reload(); else reloadWhenHidden = true;
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden" && reloadWhenHidden) reload();
    else if (doc.visibilityState === "visible") check();
  });
  deps.every(check, UPDATE_CHECK_MS);
}
