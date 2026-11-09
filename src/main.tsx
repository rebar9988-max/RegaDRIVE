import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./app/state";
import "./styles/app.css";
import "./styles/figma-premium-abc.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider><App /></AppProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* offline support is optional */ });
  });
}
