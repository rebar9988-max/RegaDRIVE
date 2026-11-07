import { lazy, Suspense, type JSX } from "react";
import { usePath } from "./app/router";
import { Shell } from "./app/Shell";
import { useApp } from "./app/state";
import { Home } from "./pages/Home";
import { Learn, LessonDetail } from "./pages/Learn";
import { Signs } from "./pages/Signs";
import { Practice } from "./pages/Practice";
import { Exam } from "./pages/Exam";
import { About, Access, Account, More, NotFound, ProgressPage, Services, Settings, Vocabulary } from "./pages/Misc";

// Owner import workbench: compiled in only when VITE_ADMIN_UI=true (production builds drop it entirely).
const AdminImport = import.meta.env.VITE_ADMIN_UI === "true" ? lazy(() => import("./pages/AdminImport").then((m) => ({ default: m.AdminImport }))) : null;

// Owner control center (/dr): its own chunk, outside the student shell. Access is enforced by the Worker.
const DrAdmin = lazy(() => import("./pages/DrAdmin").then((m) => ({ default: m.DrAdmin })));

function route(path: string) {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return <Home />;
  if (p === "/learn") return <Learn />;
  if (p.startsWith("/learn/")) return <LessonDetail id={decodeURIComponent(p.slice(7))} />;
  if (p === "/admin/import" && AdminImport) return <Suspense fallback={<div aria-busy="true" />}><AdminImport /></Suspense>;
  const map: Record<string, () => JSX.Element> = {
    "/signs": Signs, "/practice": Practice, "/exam": Exam, "/progress": ProgressPage, "/vocabulary": Vocabulary,
    "/services": Services, "/account": Account, "/access": Access, "/settings": Settings, "/about": About, "/more": More,
  };
  const C = map[p];
  return C ? <C /> : <NotFound />;
}

export function App() {
  const path = usePath();
  const { ready } = useApp();
  if (path === "/dr" || path.startsWith("/dr/")) return <Suspense fallback={<div aria-busy="true" />}><DrAdmin /></Suspense>;
  // Wait for stored settings/progress so the first paint has the right language and no layout jump.
  return <Shell>{ready ? <div key={path}>{route(path)}</div> : <div className="splash" aria-busy="true"><img className="splash-logo" src="/brand/regadrive-logo.svg" width={112} height={112} alt="RegaDRIVE" /></div>}</Shell>;
}
