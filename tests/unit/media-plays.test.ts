import { describe, expect, it } from "vitest";
import { MAX_VIDEO_PLAYS, nextZoom, playsLeft, readPlayCounts, recordPlay } from "../../src/lib/mediaPlays";
import { newExamSession, restoreExamSession } from "../../src/lib/examSession";
import { KLASSE_B_RULES_2026 } from "../../src/lib/shared/exam";

describe("video play limit", () => {
  it("allows five plays per clip, then nothing more", () => {
    expect(MAX_VIDEO_PLAYS).toBe(5);
    let c = {};
    for (let i = 0; i < 5; i++) c = recordPlay(c, "media/a.mp4");
    expect(playsLeft(c, "media/a.mp4")).toBe(0);
    const same = recordPlay(c, "media/a.mp4");
    expect(same).toBe(c);
    expect(playsLeft(c, "media/b.mp4")).toBe(5); // counted per clip
  });
  it("reads stored counts defensively", () => {
    expect(readPlayCounts({ a: 2, b: -1, c: 1.5, d: "3", e: 99 })).toEqual({ a: 2, e: 5 });
    for (const bad of [null, "x", [], 7]) expect(readPlayCounts(bad)).toEqual({});
  });
  it("survives a reload as part of the exam session; old sessions without counts still resume", () => {
    const ids = () => ["q1"];
    const s = { ...newExamSession(1, KLASSE_B_RULES_2026.version, null, 0), plays: { "media/a.mp4": 3 } };
    expect(restoreExamSession(JSON.parse(JSON.stringify(s)), KLASSE_B_RULES_2026.version, ids)!.plays).toEqual({ "media/a.mp4": 3 });
    const old = newExamSession(1, KLASSE_B_RULES_2026.version, null, 0);
    delete (old as { plays?: unknown }).plays;
    expect(restoreExamSession(old, KLASSE_B_RULES_2026.version, ids)!.plays).toEqual({});
  });
});

describe("image zoom steps", () => {
  it("steps 1 → 1.5 → 2 → 3 and back, never beyond", () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(2, 1)).toBe(3);
    expect(nextZoom(3, 1)).toBe(3);
    expect(nextZoom(1.5, -1)).toBe(1);
    expect(nextZoom(1, -1)).toBe(1);
  });
});
