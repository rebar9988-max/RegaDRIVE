import { describe, expect, it } from "vitest";
import { isLang, langDir, LANGS, pick } from "../../src/app/i18n";
import { normalizeSettings } from "../../src/app/settings";
import { isItText, sourceLang, sourceText, textLines } from "../../src/app/anyText";
import { pickIt } from "../../src/content/italy/text";
import { itContentFor, itQuestionsOf } from "../../src/content/italy/access";
import { IT_CONTENT_REGISTRY, IT_RULES_VERSION, itPublicationGate } from "../../src/content/italy/registry";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { IT_SIGNS } from "../../src/content/italy/signs";
import { CONTENT_REGISTRY } from "../../src/content/registry";
import type { ItText } from "../../src/content/italy/types";
import type { Bilingual } from "../../src/content/types";

const de: Bilingual = { ckb: "سڵاو", de: "Hallo", kmr: "Silav", ar: "مرحبا" };
const itText: ItText = { ckb: "سڵاو", it: "Ciao", kmrArab: "سلاڤ", kmr: "Silav", de: "Hallo", ar: "مرحبا" };

describe("Badini (kmr-arab) as a language of its own", () => {
  it("is offered, is right to left and is accepted by stored settings", () => {
    expect(LANGS.map((l) => l.id)).toContain("kmr-arab");
    expect(langDir("kmr-arab")).toBe("rtl");
    expect(isLang("kmr-arab")).toBe(true);
    expect(normalizeSettings({ lang: "kmr-arab" }).lang).toBe("kmr-arab");
  });
  it("keeps Latin-script Kurmanji exactly as it was", () => {
    expect(langDir("kmr")).toBe("ltr");
    expect(pick(de, "kmr")).toEqual({ text: "Silav", lang: "kmr" });
    expect(pickIt(itText, "kmr")).toEqual({ text: "Silav", lang: "kmr" });
  });
  it("falls back to Sorani for German content, which has no Badini wording", () => {
    expect(pick(de, "kmr-arab")).toEqual({ text: "سڵاو", lang: "ckb" });
  });
  it("uses the Badini wording of Italian content", () => {
    expect(pickIt(itText, "kmr-arab")).toEqual({ text: "سلاڤ", lang: "kmr-arab" });
    expect(pickIt({ ckb: "سڵاو", it: "Ciao" }, "kmr-arab")).toEqual({ text: "سڵاو", lang: "ckb" });
  });
  it("leaves the other languages untouched", () => {
    for (const lang of ["ckb", "ar", "de"] as const) expect(pick(de, lang).lang).toBe(lang);
  });
});

describe("source line per country", () => {
  it("is German for German content and Italian for Italian content", () => {
    expect(sourceLang(de)).toBe("de");
    expect(sourceLang(itText)).toBe("it");
    expect(sourceText(itText)).toBe("Ciao");
    expect(isItText(de)).toBe(false);
    expect(isItText(itText)).toBe(true);
  });
  it("shows the learner's language with the original underneath", () => {
    expect(textLines(de, "ckb", true)).toEqual({ primary: { text: "سڵاو", lang: "ckb" }, source: { text: "Hallo", lang: "de" } });
    expect(textLines(itText, "ckb", true)).toEqual({ primary: { text: "سڵاو", lang: "ckb" }, source: { text: "Ciao", lang: "it" } });
  });
  it("adds no second line when the learner already reads the source language", () => {
    expect(textLines(de, "de", true).source).toBeNull();
  });
  it("adds no second line when it is switched off", () => {
    expect(textLines(itText, "ckb", false).source).toBeNull();
    expect(textLines(de, "ckb", false).source).toBeNull();
  });
});

describe("Italian publication gate", () => {
  it("records provenance and sources for every Italian item", () => {
    for (const q of IT_QUESTIONS) {
      const rec = IT_CONTENT_REGISTRY.get(q.id);
      expect(rec, q.id).toBeDefined();
      expect(rec?.provenance.aiAssisted).toBe(true);
      expect(rec?.provenance.sourceRefs.length ?? 0).toBeGreaterThan(0);
      expect(rec?.licenseClass).toBe("original_regadrive");
    }
    for (const s of IT_SIGNS) expect(IT_CONTENT_REGISTRY.get(s.id), s.id).toBeDefined();
  });
  // Fail closed: the two human reviews are outstanding, so nothing may reach a learner in production.
  it("blocks every Italian item until a human review exists", () => {
    for (const q of IT_QUESTIONS) {
      const gate = itPublicationGate(q.id, q);
      expect(gate.publishable, q.id).toBe(false);
      expect(gate.reasons.join(" ")).toContain("TRANSLATION_REVIEW");
    }
  });
  it("names the Italian exam rules, never the German ones", () => {
    expect(IT_RULES_VERSION).toContain("it");
    expect(itPublicationGate(IT_QUESTIONS[0]!.id).reasons.join(" ")).toContain(IT_RULES_VERSION);
  });
  it("refuses an unknown id", () => {
    expect(itPublicationGate("nope").publishable).toBe(false);
  });
  it("keeps the two registries apart", () => {
    for (const id of IT_CONTENT_REGISTRY.keys()) expect(CONTENT_REGISTRY.has(id), id).toBe(false);
    for (const id of CONTENT_REGISTRY.keys()) expect(IT_CONTENT_REGISTRY.has(id), id).toBe(false);
  });
});

describe("Italian content access", () => {
  it("shows nothing in production and everything in preview", () => {
    expect(itContentFor("production").questions).toEqual([]);
    expect(itContentFor("production").signs).toEqual([]);
    expect(itContentFor("preview").questions.length).toBe(IT_QUESTIONS.length);
    expect(itContentFor("preview").signs.length).toBe(IT_SIGNS.length);
  });
  it("always reports the chapters and what is still in review", () => {
    for (const mode of ["production", "preview"] as const) {
      expect(itContentFor(mode).chapters.length).toBe(16);
      expect(itContentFor(mode).inReview).toBe(IT_QUESTIONS.length);
    }
  });
  it("filters by chapter", () => {
    const preview = itContentFor("preview");
    expect(itQuestionsOf(preview, 1).every((q) => q.chapter === 1)).toBe(true);
    expect(itQuestionsOf(preview, 6).map((q) => q.id)).toEqual(["it-b-013"]);
    expect(itQuestionsOf(itContentFor("production"), 1)).toEqual([]);
  });
});

describe("Italian true/false answers", () => {
  it("has exactly one right answer per question, and both answers occur in the bank", () => {
    for (const q of IT_QUESTIONS) expect(typeof q.answer).toBe("boolean");
    expect(IT_QUESTIONS.some((q) => q.answer)).toBe(true);
    expect(IT_QUESTIONS.some((q) => !q.answer)).toBe(true);
  });
  it("carries no option ids or points, so it can never enter a German exam", () => {
    for (const q of IT_QUESTIONS) {
      expect("options" in q).toBe(false);
      expect("correct" in q).toBe(false);
      expect("points" in q).toBe(false);
      expect("topicId" in q).toBe(false);
    }
  });
});
