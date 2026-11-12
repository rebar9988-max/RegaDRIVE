import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { decodeLocationPart, useRouteLocation } from "./app/router";
import { CountrySelection, ItalyPending } from "./app/CountrySelection";
import { useApp } from "./app/state";

// Route-based code splitting: the first paint needs only the shell and the home page. Every other screen is its
// own chunk, fetched on demand, warmed up when the browser is idle and precached by the service worker for offline use.
const pages = {
  shell: () => import("./app/Shell"),
  home: () => import("./pages/Home"),
  learn: () => import("./pages/Learn"),
  signs: () => import("./pages/Signs"),
  practice: () => import("./pages/Practice"),
  exam: () => import("./pages/Exam"),
  misc: () => import("./pages/Misc"),
};
const page = <M, K extends keyof M>(load: () => Promise<M>, name: K) => lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
const Shell = lazy(() => pages.shell().then((m) => ({ default: m.Shell })));
const Home = page(pages.home, "Home");
const Learn = page(pages.learn, "Learn");
const LessonDetail = lazy(() => pages.learn().then((m) => ({ default: m.LessonDetail })));
const Signs = page(pages.signs, "Signs");
const Practice = page(pages.practice, "Practice");
const Exam = page(pages.exam, "Exam");
const About = page(pages.misc, "About"), Access = page(pages.misc, "Access"), Account = page(pages.misc, "Account"), More = page(pages.misc, "More"),
  NotFound = page(pages.misc, "NotFound"), ProgressPage = page(pages.misc, "ProgressPage"), Services = page(pages.misc, "Services"),
  Settings = page(pages.misc, "Settings"), Vocabulary = page(pages.misc, "Vocabulary");
const warmUp = () => { for (const load of Object.values(pages)) void load().catch(() => undefined); };

// Owner import workbench: compiled in only when VITE_ADMIN_UI=true (production builds drop it entirely).
const AdminImport = import.meta.env.VITE_ADMIN_UI === "true" ? lazy(() => import("./pages/DrContent").then((m) => ({ default: m.DrContent }))) : null;

// Owner control center (/dr): its own chunk, outside the student shell. Access is enforced by the Worker.
const DrAdmin = lazy(() => import("./pages/DrAdmin").then((m) => ({ default: m.DrAdmin })));

function route(path: string) {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return <Home />;
  if (p === "/learn") return <Learn />;
  if (p.startsWith("/learn/")) {
    // A malformed escape in the URL shows the missing-page state instead of throwing (from PR #22).
    const id = decodeLocationPart(p.slice(7));
    return id === null ? <NotFound /> : <LessonDetail id={id} />;
  }
  if (p === "/admin/import" && AdminImport) return <Suspense fallback={<div aria-busy="true" />}><AdminImport /></Suspense>;
  const map: Record<string, ComponentType> = {
    "/signs": Signs, "/practice": Practice, "/exam": Exam, "/progress": ProgressPage, "/vocabulary": Vocabulary,
    "/services": Services, "/account": Account, "/access": Access, "/settings": Settings, "/about": About, "/more": More,
  };
  const C = map[p];
  return C ? <C /> : <NotFound />;
}

/** Pages that hold no German learning content, so they stay reachable while Italy has none (account, settings, more, about). */
const ITALY_SHARED_PATHS = new Set(["/account", "/settings", "/more", "/about"]);

export function App() {
  // Pathname and query identify a page; a new query (e.g. another practice filter) remounts it (from PR #22).
  const location = useRouteLocation();
  const path = location.split("?")[0]!;
  const { ready, settings } = useApp();
  useEffect(() => {
    // After the first paint, fetch the other screens in the background so navigation never waits or flickers.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    if (typeof w.requestIdleCallback === "function") { const h = w.requestIdleCallback(warmUp, { timeout: 4000 }); return () => w.cancelIdleCallback?.(h); }
    const t = window.setTimeout(warmUp, 1500);
    return () => window.clearTimeout(t);
  }, []);
  if (path === "/dr" || path.startsWith("/dr/")) return <Suspense fallback={<div aria-busy="true" />}><DrAdmin /></Suspense>;
  if (ready && settings.country === null) return <CountrySelection />;
  // Until stored settings are read, and while the shell's code arrives, show the logo only: no layout jump and
  // nothing that would need the app shell, the icons or the content.
  const splash = <div className="splash" aria-busy="true"><img className="splash-logo" src="/brand/regadrive-logo.webp" width={112} height={112} alt="RegaDRIVE" /></div>;
  if (!ready) return splash;
  return (
    <Suspense fallback={splash}>
      <Shell><ErrorBoundary resetKey={path}><Suspense fallback={<div aria-busy="true" className="route-loading" />}><div key={location}>{settings.country === "IT" && !ITALY_SHARED_PATHS.has(path) ? <ItalyPending /> : route(path)}</div></Suspense></ErrorBoundary></Shell>
    </Suspense>
  );
}
