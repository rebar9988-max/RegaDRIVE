import type React from "react";
import { usePath } from "./app/router";
import { Shell } from "./app/Shell";
import { useApp } from "./app/state";
import { Home } from "./pages/Home";
import { Learn, LessonDetail } from "./pages/Learn";
import { Signs } from "./pages/Signs";
import { Practice } from "./pages/Practice";
import { Exam } from "./pages/Exam";
import { About, Access, Account, More, NotFound, ProgressPage, Services, Settings, Vocabulary } from "./pages/Misc";

function route(path: string) {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/") return <Home />;
  if (p === "/learn") return <Learn />;
  if (p.startsWith("/learn/")) return <LessonDetail id={decodeURIComponent(p.slice(7))} />;
  const map: Record<string, () => React.JSX.Element> = {
    "/signs": Signs, "/practice": Practice, "/exam": Exam, "/progress": ProgressPage, "/vocabulary": Vocabulary,
    "/services": Services, "/account": Account, "/access": Access, "/settings": Settings, "/about": About, "/more": More,
  };
  const C = map[p];
  return C ? <C /> : <NotFound />;
}

export function App() {
  const path = usePath();
  const { ready } = useApp();
  // Wait for stored settings/progress so the first paint has the right language and no layout jump.
  return <Shell>{ready ? <div key={path}>{route(path)}</div> : <div aria-busy="true" style={{ minHeight: "60vh" }} />}</Shell>;
}
