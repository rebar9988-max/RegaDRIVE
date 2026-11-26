import { describe, expect, it } from "vitest";
import { IT_LESSONS, itLessonFor } from "../../src/content/italy/lessons";
import { IT_CHAPTERS } from "../../src/content/italy/chapters";
import { itSignById } from "../../src/content/italy/signs";
import { emptyProgress } from "../../src/lib/progress";
import { isItLessonDone, itLessonId, itLessonNeighbours, itLessonsDone, toggleItLessonDone } from "../../src/lib/italyStudy";
import type { ItText } from "../../src/content/italy/types";

const texts = (): ItText[] => IT_LESSONS.flatMap((l) => [l.intro, l.example, ...l.points.map((p) => p.text), ...l.checks.flatMap((c) => [c.statement, c.why])]);

describe("Italian lessons", () => {
  // The screen a learner opens must never be an empty page: every chapter has real material.
  it("exist for all 16 chapters, exactly once each", () => {
    expect(IT_LESSONS.map((l) => l.chapter)).toEqual(IT_CHAPTERS.map((c) => c.id));
    for (const c of IT_CHAPTERS) expect(itLessonFor(c.id), `chapter ${c.id}`).toBeDefined();
  });
  it("carry an introduction, several points, an example and self-checks", () => {
    for (const l of IT_LESSONS) {
      expect(l.intro.it.length, `chapter ${l.chapter}`).toBeGreaterThan(80);
      expect(l.points.length, `chapter ${l.chapter}`).toBeGreaterThanOrEqual(3);
      expect(l.example.it.length, `chapter ${l.chapter}`).toBeGreaterThan(50);
      expect(l.checks.length, `chapter ${l.chapter}`).toBeGreaterThanOrEqual(2);
    }
  });
  it("are written in Sorani, Italian and Badini throughout", () => {
    for (const t of texts()) {
      expect(t.it.trim().length).toBeGreaterThan(0);
      expect(t.ckb.trim().length).toBeGreaterThan(0);
      expect(t.kmrArab?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
  it("keeps the Italian text in Latin script and the Kurdish text in Arabic script", () => {
    const arabic = /[؀-ۿ]/;
    for (const t of texts()) {
      expect(arabic.test(t.it)).toBe(false);
      expect(arabic.test(t.ckb)).toBe(true);
      expect(arabic.test(t.kmrArab ?? "")).toBe(true);
    }
  });
  it("cites the Codice della Strada for every lesson and for most points", () => {
    for (const l of IT_LESSONS) {
      expect(l.sources.length, `chapter ${l.chapter}`).toBeGreaterThan(0);
      expect(l.sources.join(" "), `chapter ${l.chapter}`).toMatch(/CdS|Reg\./);
      expect(l.points.filter((p) => p.ref).length, `chapter ${l.chapter}`).toBeGreaterThan(0);
    }
  });
  it("only points at sign illustrations that exist", () => {
    for (const l of IT_LESSONS) for (const id of l.signIds) expect(itSignById(id), id).toBeDefined();
  });
  it("uses unique self-check ids, each with a true/false answer and a reason", () => {
    const ids = IT_LESSONS.flatMap((l) => l.checks.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of IT_LESSONS) for (const c of l.checks) {
      expect(typeof c.answer).toBe("boolean");
      expect(c.why.it.length).toBeGreaterThan(10);
    }
  });
  it("starts its Italian self-check reasons with the verdict that matches the answer", () => {
    for (const l of IT_LESSONS) for (const c of l.checks) {
      expect(c.why.it.startsWith(c.answer ? "VERO" : "FALSO"), `${c.id}: ${c.why.it.slice(0, 12)}`).toBe(true);
    }
  });
  it("never claims to be an official examination question", () => {
    for (const l of IT_LESSONS) for (const c of l.checks) {
      expect("questionCode" in c).toBe(false);
      expect(c.id.startsWith("it-l")).toBe(true);
    }
  });
});

describe("lesson completion and navigation", () => {
  it("marks a lesson done and undoes it, touching nothing else", () => {
    const p0 = emptyProgress();
    const p1 = toggleItLessonDone(p0, 3);
    expect(isItLessonDone(p1, 3)).toBe(true);
    expect(p1.completedLessons).toEqual([itLessonId(3)]);
    expect(p1.questions).toEqual(p0.questions);
    expect(p1.bookmarks).toEqual(p0.bookmarks);
    expect(isItLessonDone(toggleItLessonDone(p1, 3), 3)).toBe(false);
  });
  it("counts the finished lessons", () => {
    let p = emptyProgress();
    expect(itLessonsDone(p)).toBe(0);
    for (const c of [1, 2, 16]) p = toggleItLessonDone(p, c);
    expect(itLessonsDone(p)).toBe(3);
  });
  it("keeps Italy's lesson ids apart from any German lesson id", () => {
    expect(itLessonId(1)).toBe("it-lesson-1");
    const p = { ...emptyProgress(), completedLessons: ["l-grundregeln"] };
    expect(isItLessonDone(p, 1)).toBe(false);
    expect(itLessonsDone(p)).toBe(0);
  });
  it("links the chapters in order, with no neighbour past the ends", () => {
    expect(itLessonNeighbours(1)).toEqual({ prev: null, next: 2 });
    expect(itLessonNeighbours(8)).toEqual({ prev: 7, next: 9 });
    expect(itLessonNeighbours(16)).toEqual({ prev: 15, next: null });
    expect(itLessonNeighbours(99)).toEqual({ prev: null, next: null });
  });
});
