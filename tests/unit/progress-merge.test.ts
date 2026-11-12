import { describe, expect, it } from "vitest";
import { emptyProgress, mergeProgress, normalizeProgress, recordAnswer, toggleBookmark } from "../../src/lib/progress";

describe("mergeProgress (local progress is never lost on sign-in / restore)", () => {
  it("keeps everything from both copies and prefers the newer answer", () => {
    let device = recordAnswer(emptyProgress(), "s1", "q1", true, 2000);
    device = toggleBookmark(device, "q9");
    device = { ...device, completedLessons: ["l1"], examHistory: [{ at: 5, passed: true, errorPoints: 0, totalPoints: 110, rulesVersion: "r" }] };
    let cloud = recordAnswer(emptyProgress(), "s0", "q1", false, 1000);
    cloud = recordAnswer(cloud, "s0", "q2", true, 1500);
    cloud = { ...cloud, completedLessons: ["l2"], examHistory: [{ at: 3, passed: false, errorPoints: 12, totalPoints: 110, rulesVersion: "r" }] };
    const m = mergeProgress(device, cloud);
    expect(m.questions.q1).toEqual(device.questions.q1); // newer device answer wins
    expect(m.questions.q2).toEqual(cloud.questions.q2);
    expect(m.bookmarks).toEqual(["q9"]);
    expect(m.completedLessons.sort()).toEqual(["l1", "l2"]);
    expect(m.examHistory.map((e) => e.at)).toEqual([3, 5]);
    expect(Object.keys(m.scored).sort()).toEqual(["s0:q1", "s0:q2", "s1:q1"]);
    expect(mergeProgress(m, m)).toEqual(m); // idempotent
    expect(mergeProgress(device, emptyProgress())).toEqual({ ...device, examHistory: device.examHistory });
  });
});

describe("progress from untrusted storage or another device", () => {
  it("keeps a well-formed document unchanged", () => {
    let p = emptyProgress();
    p = recordAnswer(p, "s1", "q1", true, 1_700_000_000_000);
    p = { ...p, bookmarks: ["q1"], completedLessons: ["l1"], examHistory: [{ at: 5, passed: true, errorPoints: 4, totalPoints: 110, rulesVersion: "r" }] };
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("rejects what is not a version-1 progress document", () => {
    for (const bad of [null, undefined, "x", 7, [], {}, { version: 2 }, { version: "1" }]) expect(normalizeProgress(bad)).toBeNull();
  });
  it("drops malformed parts instead of crashing or keeping them", () => {
    const p = normalizeProgress({
      version: 1,
      questions: { ok: { attempts: 3, correctCount: 9, streak: -2, lastCorrect: "yes", lastAnsweredAt: "now" }, bad: "nope", "": { attempts: 1 } },
      scored: { "s:q": true, "x:y": "true" },
      bookmarks: ["a", "a", 5, null, ""],
      completedLessons: "l1",
      days: { "2026-11-12": 4, "yesterday": 3, "2026-11-11": -1 },
      examHistory: [{ at: 1, passed: true, errorPoints: "x", totalPoints: 110, rulesVersion: 5 }, { at: "2", passed: true }, "junk"],
      extra: "<script>",
    })!;
    expect(p.questions).toEqual({ ok: { attempts: 3, correctCount: 3, streak: 0, lastCorrect: null, lastAnsweredAt: null } });
    expect(p.scored).toEqual({ "s:q": true });
    expect(p.bookmarks).toEqual(["a"]);
    expect(p.completedLessons).toEqual([]);
    expect(p.days).toEqual({ "2026-11-12": 4 });
    expect(p.examHistory).toEqual([{ at: 1, passed: true, errorPoints: 0, totalPoints: 110, rulesVersion: "" }]);
    expect(Object.keys(p).sort()).toEqual(["bookmarks", "completedLessons", "days", "examHistory", "questions", "scored", "version"]);
  });
  it("a damaged account copy can be merged without losing local progress", () => {
    const local = recordAnswer(emptyProgress(), "s1", "q1", true, 10);
    const merged = mergeProgress(local, normalizeProgress({ version: 1, questions: "broken", bookmarks: 42 })!);
    expect(merged.questions.q1).toEqual(local.questions.q1);
  });
});
