import { describe, expect, it } from "vitest";
import { filterApproved } from "../../src/app/approved";
import { SIGNS } from "../../src/content/signs";
import { SIGN_QUIZ } from "../../src/content/signQuiz";
import { questionHash, signHash } from "../../src/content/hash";

describe("learner side of the review gate (/signs, /sign-quiz)", () => {
  it("shows nothing when the server says nothing is approved or the call failed", () => {
    expect(filterApproved(null)).toEqual({ signs: [], signQuiz: [] });
    expect(filterApproved({ ok: false, signs: { [SIGNS[0]!.id]: signHash(SIGNS[0]!) } })).toEqual({ signs: [], signQuiz: [] });
    expect(filterApproved({ ok: true, signs: {}, signQuiz: {} })).toEqual({ signs: [], signQuiz: [] });
  });
  it("shows exactly the approved items whose fingerprint equals the bundled content", () => {
    const s = SIGNS[0]!, q = SIGN_QUIZ[0]!;
    const out = filterApproved({ ok: true, signs: { [s.id]: signHash(s), [SIGNS[1]!.id]: "stale" }, signQuiz: { [q.id]: questionHash(q), unknown: "x" } });
    expect(out.signs.map((x) => x.id)).toEqual([s.id]);
    expect(out.signQuiz.map((x) => x.id)).toEqual([q.id]);
  });
});
