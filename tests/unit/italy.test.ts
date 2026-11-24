import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IT_CHAPTERS, IT_PLANNED_TOTAL, itChapterById } from "../../src/content/italy/chapters";
import { IT_QUESTIONS, itQuestionsByChapter } from "../../src/content/italy/questions";
import { IT_SIGNS, itSignById, itSignSrc } from "../../src/content/italy/signs";
import type { ItText } from "../../src/content/italy/types";

const texts = (): ItText[] => IT_QUESTIONS.flatMap((q) => [q.prompt, q.explanation]);

describe("Italian syllabus", () => {
  it("has the 16 chapters, numbered 1 to 16", () => {
    expect(IT_CHAPTERS.map((c) => c.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
  it("plans 7020 questions in total", () => {
    expect(IT_PLANNED_TOTAL).toBe(7020);
  });
  it("names every chapter in Sorani, Italian, Badini, German and Arabic", () => {
    for (const c of IT_CHAPTERS) {
      expect(c.title.ckb.length).toBeGreaterThan(0);
      expect(c.title.it.length).toBeGreaterThan(0);
      expect(c.title.kmrArab?.length ?? 0).toBeGreaterThan(0);
      expect(c.title.de?.length ?? 0).toBeGreaterThan(0);
      expect(c.title.ar?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("Italian questions", () => {
  it("carries every question that exists, with unique ids", () => {
    expect(IT_QUESTIONS.length).toBe(0);
    expect(new Set(IT_QUESTIONS.map((q) => q.id)).size).toBe(IT_QUESTIONS.length);
  });
  it("belongs to a known chapter", () => {
    for (const q of IT_QUESTIONS) expect(itChapterById(q.chapter)).toBeDefined();
  });
  it("groups by chapter", () => {
    expect(itQuestionsByChapter(1).length).toBe(0);
    expect(itQuestionsByChapter(6).length).toBe(0);
  });
  // Repository rule: original content never claims an official question code and is never pre-approved.
  it("stays original and unapproved", () => {
    for (const q of IT_QUESTIONS) {
      expect(q.questionCode).toBeNull();
      expect(q.sourceType).toBe("original");
      expect(q.reviewStatus).not.toBe("approved");
    }
  });
  it("has Sorani, Italian and Badini wording plus German and Arabic drafts", () => {
    for (const t of texts()) {
      expect(t.ckb.trim().length).toBeGreaterThan(0);
      expect(t.it.trim().length).toBeGreaterThan(0);
      expect(t.kmrArab?.trim().length ?? 0).toBeGreaterThan(0);
      expect(t.de?.trim().length ?? 0).toBeGreaterThan(0);
      expect(t.ar?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
  it("carries a Kurmanji draft in every text as well", () => {
    for (const t of texts()) expect(t.kmr?.trim().length ?? 0).toBeGreaterThan(0);
  });
});

describe("Italian sign illustrations", () => {
  it("resolves every signId used by a question", () => {
    for (const q of IT_QUESTIONS) {
      if (!q.signId) continue;
      expect(itSignById(q.signId), q.signId).toBeDefined();
    }
  });
  it("has a file on disk for every sign", () => {
    for (const s of IT_SIGNS) expect(existsSync(new URL(`../../public/signs/it/${s.file}`, import.meta.url)), s.file).toBe(true);
  });
  it("serves signs from /signs/it", () => {
    for (const s of IT_SIGNS) expect(itSignSrc(s)).toBe(`/signs/it/${s.file}`);
  });
  it("uses unique ids and files", () => {
    expect(new Set(IT_SIGNS.map((s) => s.id)).size).toBe(IT_SIGNS.length);
    expect(new Set(IT_SIGNS.map((s) => s.file)).size).toBe(IT_SIGNS.length);
  });
});
