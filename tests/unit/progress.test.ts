import { describe, expect, it } from "vitest";
import { emptyProgress, questionStatus, recordAnswer, streakDays, toggleBookmark, weakTopics } from "../../src/lib/progress";
import { QUESTIONS } from "../../src/content/questions";

const T0 = new Date(2026, 10, 6, 12).getTime();

describe("progress", () => {
  it("prevents duplicate scoring within one session", () => {
    let s = emptyProgress();
    s = recordAnswer(s, "s1", "q", true, T0);
    const again = recordAnswer(s, "s1", "q", false, T0);
    expect(again).toBe(s);
    expect(s.questions.q).toMatchObject({ attempts: 1, correctCount: 1 });
    s = recordAnswer(s, "s2", "q", false, T0);
    expect(s.questions.q).toMatchObject({ attempts: 2, correctCount: 1, streak: 0, lastCorrect: false });
  });
  it("uses a configurable mastery threshold", () => {
    let s = emptyProgress();
    for (const sid of ["a", "b", "c"]) s = recordAnswer(s, sid, "q", true, T0);
    expect(questionStatus(s.questions.q, 3)).toBe("mastered");
    expect(questionStatus(s.questions.q, 4)).toBe("learning");
    expect(questionStatus(undefined)).toBe("unanswered");
  });
  it("counts day streaks", () => {
    let s = emptyProgress();
    s = recordAnswer(s, "a", "q1", true, T0 - 2 * 86_400_000);
    s = recordAnswer(s, "b", "q1", true, T0 - 86_400_000);
    s = recordAnswer(s, "c", "q1", true, T0);
    expect(streakDays(s, T0)).toBe(3);
    expect(streakDays(s, T0 + 3 * 86_400_000)).toBe(0);
  });
  it("toggles bookmarks and finds weak topics", () => {
    let s = toggleBookmark(emptyProgress(), "x");
    expect(s.bookmarks).toEqual(["x"]);
    s = toggleBookmark(s, "x");
    expect(s.bookmarks).toEqual([]);
    const q = QUESTIONS[0]!;
    s = recordAnswer(s, "a", q.id, false, T0);
    expect(weakTopics(s, QUESTIONS)).toEqual([q.topicId]);
  });
});
