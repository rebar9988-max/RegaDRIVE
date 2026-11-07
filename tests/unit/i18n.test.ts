import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { QUESTIONS } from "../../src/content/questions";
import { SIGNS } from "../../src/content/signs";
import { VOCABULARY } from "../../src/content/vocabulary";
import { TOPICS } from "../../src/content/topics";
import { LESSONS } from "../../src/content/lessons";
import { T } from "../../src/app/strings";
import { LANGS, langDir, pick, vocabMeaning } from "../../src/app/i18n";
import { normalizeSettings } from "../../src/app/settings";
import { haystack, normalize } from "../../src/lib/search";

const arabicScript = /[؀-ۿ]/;
const soraniOnly = /[ڕڵێۆەڤگچپژ]/; // letters used by Sorani but not by Arabic
const digits = (s: string) => (s.match(/\d+/g) ?? []).sort().join(",");

/** Every { ckb, de } text object reachable from a value. */
function texts(v: unknown, path = "", out: [string, Record<string, unknown>][] = []) {
  if (Array.isArray(v)) v.forEach((x, i) => texts(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.ckb === "string" && typeof o.de === "string") out.push([path, o]);
    for (const [k, x] of Object.entries(o)) if (x && typeof x === "object") texts(x, `${path}.${k}`, out);
  }
  return out;
}

const ALL = texts({ QUESTIONS, LESSONS, SIGNS, TOPICS, VOCABULARY, T });

describe("Kurmanji and Arabic translations", () => {
  it("covers every built-in text", () => {
    expect(ALL.length).toBeGreaterThan(300);
    const missing = ALL.filter(([, t]) => !(typeof t.kmr === "string" && t.kmr.trim() && typeof t.ar === "string" && t.ar.trim())).map(([p]) => p);
    expect(missing).toEqual([]);
  });

  it.each(ALL.map(([p, t]) => [p, t] as const))("%s uses the right script and keeps every number", (_p, t) => {
    const kmr = t.kmr as string, ar = t.ar as string, de = t.de as string;
    expect(arabicScript.test(kmr)).toBe(false);
    expect(/[äöüß]/i.test(kmr.replace(/TÜV/g, ""))).toBe(false);
    expect(arabicScript.test(ar)).toBe(true);
    expect(soraniOnly.test(ar)).toBe(false);
    expect(digits(kmr)).toBe(digits(de));
    expect(digits(ar)).toBe(digits(de));
  });

  it("every inline { ckb, de } literal in the app source also carries kmr and ar", () => {
    const root = fileURLToPath(new URL("../../src", import.meta.url));
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
    walk(root);
    const isText = (n: ts.Node) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n) || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken);
    const bad: string[] = [];
    for (const f of files) {
      const src = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (n: ts.Node) => {
        if (ts.isObjectLiteralExpression(n)) {
          const props = new Map<string, ts.Expression>();
          for (const p of n.properties) if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) props.set(p.name.text, p.initializer);
          const ckb = props.get("ckb"), de = props.get("de");
          if (ckb && de && isText(ckb) && isText(de) && !(props.has("kmr") && props.has("ar"))) bad.push(`${relative(root, f)}:${src.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
        }
        ts.forEachChild(n, visit);
      };
      visit(src);
    }
    expect(bad).toEqual([]);
  });
});

describe("language engine", () => {
  const t = { ckb: "سڵاو", de: "Hallo", kmr: "Silav", ar: "مرحبا" };
  it("picks the learner's language and falls back to German for untranslated imports", () => {
    expect(pick(t, "kmr")).toEqual({ text: "Silav", lang: "kmr" });
    expect(pick(t, "ar")).toEqual({ text: "مرحبا", lang: "ar" });
    expect(pick({ ckb: "سڵاو", de: "Hallo" }, "ar")).toEqual({ text: "Hallo", lang: "de" });
    expect(pick({ ckb: "سڵاو", de: "Hallo" }, "kmr")).toEqual({ text: "Hallo", lang: "de" });
    expect(pick(t, "ckb").text).toBe("سڵاو");
  });
  it("knows each script direction", () => {
    expect(LANGS.map((l) => [l.id, langDir(l.id)])).toEqual([["ckb", "rtl"], ["kmr", "ltr"], ["ar", "rtl"], ["de", "ltr"]]);
  });
  it("shows vocabulary meanings in the learner's language (Sorani for German readers)", () => {
    const v = VOCABULARY[0]!;
    expect(vocabMeaning(v, "kmr").lang).toBe("kmr");
    expect(vocabMeaning(v, "ar").lang).toBe("ar");
    expect(vocabMeaning(v, "de").lang).toBe("ckb");
  });
  it("migrates the earlier stored langMode settings", () => {
    expect(normalizeSettings({ langMode: "bi", dailyGoal: 20 })).toMatchObject({ lang: "ckb", withGerman: true, dailyGoal: 20 });
    expect(normalizeSettings({ langMode: "ckb" })).toMatchObject({ lang: "ckb", withGerman: false });
    expect(normalizeSettings({ langMode: "de" })).toMatchObject({ lang: "de" });
    expect(normalizeSettings({ lang: "ar", withGerman: false })).toMatchObject({ lang: "ar", withGerman: false });
    expect(normalizeSettings({ lang: "xx" })).toMatchObject({ lang: "ckb" });
    expect(normalizeSettings(null)).toMatchObject({ lang: "ckb", withGerman: true });
  });
  it("finds questions by Kurmanji and Arabic words", () => {
    const q = QUESTIONS.find((x) => x.id === "rd-g-001")!;
    expect(haystack(q)).toContain(normalize("bajêr"));
    expect(haystack(q)).toContain(normalize("المناطق السكنية"));
    expect(normalize("bajer")).toBe(normalize("bajêr"));
  });
});
