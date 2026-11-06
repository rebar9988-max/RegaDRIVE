// Single source of truth: reads the current exam-rules version from src/lib/shared/exam.ts.
import { readFileSync } from "node:fs";
const m = readFileSync(new URL("../../src/lib/shared/exam.ts", import.meta.url), "utf8").match(/version:\s*"([^"]+)"/);
export const KLASSE_B = m ? m[1] : "unknown";
