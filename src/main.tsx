import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./app/state";
import { keepCurrent } from "./lib/swUpdate";
import "./styles/app.css";
import "./styles/premium-light.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider><App /></AppProvider>
  </StrictMode>,
);

// Preview builds only: a hook for the browser tests (removed from production builds by the bundler).
if (import.meta.env.VITE_CONTENT_MODE === "preview") void import("./testing/mountMedia").then((m) => m.installMediaTestHook());

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => keepCurrent(reg)).catch(() => { /* offline support is optional */ });
  });
}
