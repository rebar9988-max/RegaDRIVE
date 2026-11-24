import { describe, expect, it } from "vitest";
import { emptyProgress, recordAnswer, toggleBookmark, MASTERY_THRESHOLD_DEFAULT, type ProgressState } from "../../src/lib/progress";
import { isItPracticeMode, itChapterSources, itChapterStats, itOverall, itPracticeSet } from "../../src/lib/italyStudy";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { IT_CONTENT_REGISTRY } from "../../src/content/italy/registry";

const TH = MASTERY_THRESHOLD_DEFAULT;
const q = (i: number) => IT_QUESTIONS[i]!;
const answer = (p: ProgressState, id: string, correct: boolean, times = 1): ProgressState => {
  let out = p;
  const previousAttempts = p.questions[id]?.attempts ?? 0;
  for (let n = 0; n < times; n += 1) {
    const attempt = previousAttempts + n;
    out = recordAnswer(out, `s${attempt}`, id, correct, 1000 + attempt);
  }
  return out;
};

describe("Italian chapter statistics", () => {
  it("covers all 16 chapters even when a chapter has no approved question", () => {
    const stats = itChapterStats(emptyProgress(), IT_QUESTIONS, TH);
    expect(stats.length).toBe(16);
    expect(stats.map((s) => s.chapter.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(stats.find((s) => s.chapter.id === 6)?.total).toBe(0);
    expect(stats.every((s) => s.answered === 0 && s.mastered === 0 && s.wrong === 0)).toBe(true);
  });
  it("counts an answered question, a wrong one and a mastered one", () => {
    let p = answer(emptyProgress(), q(0).id, false);
    p = answer(p, q(2).id, true, TH);
    const stats = itChapterStats(p, IT_QUESTIONS, TH);
    const ch1 = stats.find((s) => s.chapter.id === q(0).chapter)!;
    expect(ch1.answered).toBeGreaterThanOrEqual(1);
    expect(ch1.wrong).toBe(1);
    expect(stats.find((s) => s.chapter.id === q(2).chapter)?.mastered).toBe(1);
  });
  it("counts nothing for a bank the learner may not see", () => {
    const p = answer(emptyProgress(), q(0).id, false);
    expect(itOverall(p, [], TH)).toEqual({ total: 0, answered: 0, mastered: 0, wrong: 0, bookmarked: 0 });
  });
  it("counts only bookmarks on questions of the approved bank", () => {
    let p = toggleBookmark(emptyProgress(), q(1).id);
    p = toggleBookmark(p, "rd-g-001");
    expect(itOverall(p, IT_QUESTIONS, TH).bookmarked).toBe(1);
  });
});

describe("Italian practice sets", () => {
  it("serves a chapter, the whole bank, the wrong answers or the bookmarks", () => {
    let p = answer(emptyProgress(), q(0).id, false);
    p = toggleBookmark(p, q(3).id);
    expect(itPracticeSet(IT_QUESTIONS, p, "chapter", 1, TH).every((x) => x.chapter === 1)).toBe(true);
    expect(itPracticeSet(IT_QUESTIONS, p, "all", null, TH).length).toBe(IT_QUESTIONS.length);
    expect(itPracticeSet(IT_QUESTIONS, p, "wrong", null, TH).map((x) => x.id)).toEqual([q(0).id]);
    expect(itPracticeSet(IT_QUESTIONS, p, "bookmarks", null, TH).map((x) => x.id)).toEqual([q(3).id]);
  });
  it("drops a question from the review run once it is answered correctly again", () => {
    let p = answer(emptyProgress(), q(0).id, false);
    expect(itPracticeSet(IT_QUESTIONS, p, "wrong", null, TH).length).toBe(1);
    p = answer(p, q(0).id, true);
    expect(itPracticeSet(IT_QUESTIONS, p, "wrong", null, TH).length).toBe(0);
  });
  it("serves the whole bank when a chapter mode has no chapter", () => {
    expect(itPracticeSet(IT_QUESTIONS, emptyProgress(), "chapter", null, TH).length).toBe(IT_QUESTIONS.length);
  });
  it("never serves a question outside the approved bank", () => {
    const one = [q(0)];
    let p = answer(emptyProgress(), q(1).id, false);
    p = toggleBookmark(p, q(1).id);
    for (const mode of ["all", "wrong", "bookmarks"] as const) {
      expect(itPracticeSet(one, p, mode, null, TH).every((x) => x.id === q(0).id)).toBe(true);
    }
  });
  it("accepts only the five modes", () => {
    for (const m of ["chapter", "wrong", "bookmarks", "new", "all"]) expect(isItPracticeMode(m)).toBe(true);
    for (const m of ["", "WRONG", "exam", null, 3]) expect(isItPracticeMode(m)).toBe(false);
  });
});

describe("Italian lesson sources", () => {
  const refs = (id: string) => IT_CONTENT_REGISTRY.get(id)?.provenance.sourceRefs ?? [];
  it("lists the legal references of a chapter, without repeating one", () => {
    const got = itChapterSources(1, IT_QUESTIONS, refs);
    expect(got.length).toBeGreaterThan(0);
    expect(new Set(got).size).toBe(got.length);
    expect(got.join(" ")).toContain("CdS");
  });
  it("is empty for a chapter without questions", () => {
    expect(itChapterSources(6, IT_QUESTIONS, refs)).toEqual([]);
  });
  it("never shows a reference from another chapter", () => {
    const ch16 = itChapterSources(16, IT_QUESTIONS, refs);
    expect(ch16.some((r) => r.includes("art. 189"))).toBe(true);
    expect(ch16.some((r) => r.includes("art. 2 "))).toBe(false);
  });
});
