import { describe, expect, it } from "vitest";
import { emptyProgress, mergeProgress, recordAnswer, toggleBookmark } from "../../src/lib/progress";

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
