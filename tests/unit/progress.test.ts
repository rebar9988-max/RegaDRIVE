/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { emptyProgress, questionStatus, readiness, recordAnswer, streakDays, toggleBookmark, weakTopics } from "../../src/lib/progress";
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
  it("counts local calendar days across both German daylight-saving changes (from PR #22)", () => {
    // A separate process fixes the timezone even when Vitest runs in worker threads.
    const source = new URL("../../src/lib/progress.ts", import.meta.url).href;
    const result = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
      import { emptyProgress, streakDays } from ${JSON.stringify(source)};
      const spring = { ...emptyProgress(), days: { '2026-03-28': 1, '2026-03-29': 1 } };
      const autumn = { ...emptyProgress(), days: { '2026-10-24': 1, '2026-10-25': 1 } };
      console.log(JSON.stringify([
        streakDays(spring, new Date('2026-03-30T00:30:00').getTime()),
        streakDays(autumn, new Date('2026-10-25T23:30:00').getTime()),
      ]));
    `], { env: { ...process.env, TZ: "Europe/Berlin" }, encoding: "utf8" });
    expect(JSON.parse(result)).toEqual([2, 2]);
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

describe("exam readiness", () => {
  const qs = QUESTIONS.slice(0, 10);
  const master = (s: ReturnType<typeof emptyProgress>, ids: string[]) => {
    for (const id of ids) for (const sid of ["a", "b", "c"]) s = recordAnswer(s, sid, id, true, T0);
    return s;
  };
  const exam = (passed: boolean, at: number) => ({ at, passed, errorPoints: passed ? 0 : 20, totalPoints: 110, rulesVersion: "r" });

  it("starts as not_started and becomes learning with the first answer", () => {
    expect(readiness(emptyProgress(), qs)).toMatchObject({ level: "not_started", answeredPct: 0, masteredPct: 0 });
    expect(readiness(recordAnswer(emptyProgress(), "s", qs[0]!.id, false, T0), qs)).toMatchObject({ level: "learning", answeredPct: 10 });
  });
  it("is ready only with 90 % mastered and the last three simulations passed", () => {
    const s = master(emptyProgress(), qs.slice(0, 9).map((q) => q.id));
    expect(readiness({ ...s, examHistory: [exam(true, 1), exam(true, 2), exam(true, 3)] }, qs)).toMatchObject({ level: "ready", masteredPct: 90, recentPassed: 3 });
    expect(readiness({ ...s, examHistory: [exam(true, 1), exam(true, 2)] }, qs).level).toBe("almost");
    expect(readiness({ ...s, examHistory: [exam(true, 1), exam(true, 2), exam(false, 3)] }, qs).level).toBe("learning");
    expect(readiness({ ...s, examHistory: [exam(false, 0), exam(true, 1), exam(true, 2), exam(true, 3)] }, qs).level).toBe("ready");
  });
  it("mastery without a passed simulation is never called ready", () => {
    expect(readiness(master(emptyProgress(), qs.map((q) => q.id)), qs).level).toBe("learning");
  });
});
