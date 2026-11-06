import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { contentFor } from "./src/content/access";
import { KLASSE_B_RULES_2026 } from "./src/lib/shared/exam";
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
      // Machine-readable build facts for scripts/preflight.mjs (what this build would actually publish).
      const mode = process.env.VITE_CONTENT_MODE === "preview" ? "preview" : "production";
      const c = contentFor(mode);
      writeFileSync("dist/build-info.json", JSON.stringify({
        buildId: id, contentMode: mode, adminUi: process.env.VITE_ADMIN_UI === "true", rulesVersion: KLASSE_B_RULES_2026.version,
        visible: { questions: c.questions.length, lessons: c.lessons.length, signs: c.signs.length, vocabulary: c.vocabulary.length },
      }, null, 2));
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersion()],
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
