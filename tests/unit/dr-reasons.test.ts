import { describe, expect, it } from "vitest";
import { reasonCkb } from "../../src/pages/drReasons";
import { evaluateAll } from "../../worker/dr/reviews";

describe("/dr: why an item is not published, in Sorani", () => {
  it("has Sorani wording for every reason the gate gives today, and keeps unknown codes visible", () => {
    const reasons = new Set(evaluateAll([]).flatMap((s) => s.reasons));
    expect(reasons.size).toBeGreaterThan(0);
    const untranslated = [...reasons].filter((r) => reasonCkb(r) === r || !/\p{Script=Arabic}/u.test(reasonCkb(r)));
    expect(untranslated).toEqual([]);
    expect(reasonCkb("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });

  it("names the stage and the exam rules in the reason", () => {
    expect(reasonCkb("missing passed EDUCATIONAL_REVIEW")).toContain("مامۆستای شۆفێری");
    expect(reasonCkb("not revalidated against exam rules patente-b-it-2026-11")).toContain("patente-b-it-2026-11");
    expect(reasonCkb("APPROVED has no evidence reference")).toContain("بەڵگە");
  });
});
