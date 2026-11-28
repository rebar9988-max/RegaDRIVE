// Preview build (content mode "preview", admin UI on), for E2E. A Node script rather than an inline
// `VAR=value cmd` prefix so it runs the same on Linux CI and on Windows (cmd.exe has no such prefix).
import { execSync } from "node:child_process";

const env = { ...process.env, VITE_CONTENT_MODE: "preview", VITE_ADMIN_UI: "true" };
for (const cmd of ["npx tsc -b", "npx vite build"]) execSync(cmd, { stdio: "inherit", env, shell: true });
