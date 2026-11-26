import { describe, expect, it } from "vitest";
import {
  IT_INCROCI, IT_INCROCI_GROUPS, itIncrocioById, itIncrocioLessonId, itIncrocioNeighbours, itIncrociOf,
} from "../../src/content/italy/incroci";
import { emptyProgress } from "../../src/lib/progress";
import { isItIncrocioSolved, itIncrociSolved, itNextIncrocio, markItIncrocioSolved } from "../../src/lib/italyStudy";

/**
 * The intersection scenes are original RegaDRIVE teaching material. These checks keep them honest:
 * every scene must be drawable, its order of precedence must be a real permutation of its own
 * vehicles, and every scene must say which rule and which article it rests on.
 */
describe("Italian intersection scenes", () => {
  it("has scenes, all with unique ids", () => {
    expect(IT_INCROCI.length).toBeGreaterThanOrEqual(10);
    expect(new Set(IT_INCROCI.map((s) => s.id)).size).toBe(IT_INCROCI.length);
  });

  it("carries no official figure number: these are our own schematics", () => {
    for (const s of IT_INCROCI) {
      expect(s.id.startsWith("it-inc-"), s.id).toBe(true);
      expect(/figura\s*\d/i.test(JSON.stringify(s)), s.id).toBe(false);
    }
  });

  it("gives every scene at least two vehicles, each on an arm the junction has", () => {
    for (const s of IT_INCROCI) {
      expect(s.vehicles.length, s.id).toBeGreaterThanOrEqual(2);
      expect(new Set(s.vehicles.map((v) => v.id)).size, s.id).toBe(s.vehicles.length);
      for (const v of s.vehicles) expect(s.arms, `${s.id}/${v.id}`).toContain(v.from);
      // Two vehicles never wait on the same arm, so the drawing can place each of them.
      expect(new Set(s.vehicles.map((v) => v.from)).size, s.id).toBe(s.vehicles.length);
      if (s.narrowArm) expect(s.arms, s.id).toContain(s.narrowArm);
    }
  });

  it("states an order of precedence that is exactly a permutation of its vehicles", () => {
    for (const s of IT_INCROCI) {
      expect([...s.order].sort(), s.id).toEqual(s.vehicles.map((v) => v.id).sort());
    }
  });

  it("states the rule, the reason and the article behind every scene", () => {
    for (const s of IT_INCROCI) {
      for (const [what, t] of [["title", s.title], ["rule", s.rule], ["why", s.why]] as const) {
        expect(t.it.trim().length, `${s.id}.${what}`).toBeGreaterThan(0);
        expect(t.ckb.trim().length, `${s.id}.${what}`).toBeGreaterThan(0);
        expect(t.kmrArab?.trim().length ?? 0, `${s.id}.${what}`).toBeGreaterThan(0);
      }
      expect(s.ref, s.id).toMatch(/^CdS art\. \d+$/);
    }
  });

  it("sorts every scene into exactly one of the listed groups", () => {
    const grouped = IT_INCROCI_GROUPS.flatMap((g) => itIncrociOf(g.id));
    expect(grouped.length).toBe(IT_INCROCI.length);
    expect(new Set(grouped.map((s) => s.id)).size).toBe(IT_INCROCI.length);
    for (const g of IT_INCROCI_GROUPS) expect(itIncrociOf(g.id).length, g.id).toBeGreaterThan(0);
  });

  it("finds a scene by id and refuses an unknown one", () => {
    expect(itIncrocioById(IT_INCROCI[0]!.id)?.id).toBe(IT_INCROCI[0]!.id);
    expect(itIncrocioById("nope")).toBeUndefined();
  });

  it("links the scenes into one chain, open at both ends", () => {
    const first = IT_INCROCI[0]!.id, last = IT_INCROCI[IT_INCROCI.length - 1]!.id;
    expect(itIncrocioNeighbours(first).prev).toBeNull();
    expect(itIncrocioNeighbours(first).next).toBe(IT_INCROCI[1]!.id);
    expect(itIncrocioNeighbours(last).next).toBeNull();
    expect(itIncrocioNeighbours("nope")).toEqual({ prev: null, next: null });
  });
});

describe("solving a scene", () => {
  it("is recorded once, under Italy's own progress record, and changes nothing else", () => {
    const id = IT_INCROCI[0]!.id;
    const start = emptyProgress();
    expect(isItIncrocioSolved(start, id)).toBe(false);
    expect(itIncrociSolved(start)).toBe(0);

    const solved = markItIncrocioSolved(start, id);
    expect(isItIncrocioSolved(solved, id)).toBe(true);
    expect(solved.completedLessons).toEqual([itIncrocioLessonId(id)]);
    expect(itIncrociSolved(solved)).toBe(1);
    expect(solved.questions).toEqual(start.questions);
    expect(solved.bookmarks).toEqual(start.bookmarks);

    expect(markItIncrocioSolved(solved, id)).toBe(solved);
  });

  it("offers the first unsolved scene as the next one, and none when all are solved", () => {
    let p = emptyProgress();
    expect(itNextIncrocio(p)?.id).toBe(IT_INCROCI[0]!.id);
    p = markItIncrocioSolved(p, IT_INCROCI[0]!.id);
    expect(itNextIncrocio(p)?.id).toBe(IT_INCROCI[1]!.id);
    for (const s of IT_INCROCI) p = markItIncrocioSolved(p, s.id);
    expect(itNextIncrocio(p)).toBeNull();
    expect(itIncrociSolved(p)).toBe(IT_INCROCI.length);
  });

  it("keeps the lesson ids of chapters and of scenes apart", () => {
    expect(itIncrocioLessonId("x")).toBe("it-incrocio-x");
    expect(itIncrocioLessonId("x").startsWith("it-lesson-")).toBe(false);
  });
});
