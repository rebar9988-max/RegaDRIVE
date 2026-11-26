import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { italianInterface, badiniInterface } from "../../src/app/italyInterface";
import { T } from "../../src/app/strings";

/**
 * Every UI string the Italian section actually renders must exist in Italian and in Badini.
 *
 * Key parity between the two catalogues is not enough: a screen can render a `T.…` string whose German
 * key is in neither of them, and then `pick()` falls back to Sorani for both readers. This test reads
 * the Italian-section sources, resolves each `T.…` path it finds, and checks the German wording behind
 * it — so the gate is what the code renders, not what someone remembered to translate.
 */

/** The files an Italian or Badini reader can see. The German section has its own four languages. */
const ITALIAN_SECTION = [
  "src/pages/Italy.tsx",
  "src/components/ItQuestionCard.tsx",
  "src/components/ItLessonCheck.tsx",
  "src/components/ItSignImage.tsx",
  "src/app/CountrySelection.tsx",
];

const isText = (v: unknown): v is { de: string } =>
  typeof v === "object" && v !== null && typeof (v as { de?: unknown }).de === "string";

/** The German wording behind a `T.…` path, or null when the path is not a text (a nested group). */
function germanOf(path: string): string | null {
  let node: unknown = T;
  for (const step of path.split(".")) {
    if (typeof node !== "object" || node === null || !(step in node)) return null;
    node = (node as Record<string, unknown>)[step];
  }
  return isText(node) ? node.de : null;
}

function pathsUsedIn(file: string): string[] {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  return [...source.matchAll(/\bT\.((?:[A-Za-z0-9_]+\.)*[A-Za-z0-9_]+)/g)].map((m) => m[1]!);
}

describe("Italian-section interface coverage", () => {
  const used = [...new Set(ITALIAN_SECTION.flatMap(pathsUsedIn))];

  it("finds the strings the Italian section renders", () => {
    expect(used.length).toBeGreaterThan(40);
  });

  it("resolves every T path it finds, so a renamed string cannot slip past this test", () => {
    const unresolved = used.filter((p) => {
      let node: unknown = T;
      for (const step of p.split(".")) {
        if (typeof node !== "object" || node === null || !(step in node)) return true;
        node = (node as Record<string, unknown>)[step];
      }
      return false;
    });
    expect(unresolved).toEqual([]);
  });

  it("has Italian wording for every string the Italian section renders", () => {
    const missing = [...new Set(used.map(germanOf).filter((g): g is string => g !== null))]
      .filter((german) => !(german in italianInterface));
    expect(missing).toEqual([]);
  });

  it("has Badini wording for every string the Italian section renders", () => {
    const missing = [...new Set(used.map(germanOf).filter((g): g is string => g !== null))]
      .filter((german) => !(german in badiniInterface));
    expect(missing).toEqual([]);
  });
});
