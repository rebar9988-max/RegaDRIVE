import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

function buildId(): string {
  try { return execSync("git rev-parse --short HEAD").toString().trim() + "-" + Date.now().toString(36); }
  catch { return Date.now().toString(36); }
}

/** Stamps the service-worker cache version so every deploy gets a fresh, versioned cache. */
function swVersion(): Plugin {
  const id = buildId();
  return {
    name: "regadrive-sw-version",
    apply: "build",
    closeBundle() {
      const p = "dist/sw.js";
      if (existsSync(p)) writeFileSync(p, readFileSync(p, "utf8").replace("__BUILD_ID__", id));
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersion()],
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
