import { describe, expect, it } from "vitest";
import { approvedContent, evaluate, evaluateAll, activeRows, ALL_REVIEW_ITEMS, REVIEW_ITEM_BY_ID, REVIEW_TABLE, checkSubmission, parseSubmission, rulesVersionFor, sourceFor, type ReviewRow } from "../../worker/dr/reviews";
import { IT_REVIEW_ITEMS, IT_REVIEW_ITEM_BY_ID } from "../../src/content/italy/reviewItems";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { IT_SIGNS } from "../../src/content/italy/signs";
import { IT_RULES_VERSION } from "../../src/content/italy/registry";
import { itQuestionHash, itSignHash } from "../../src/content/italy/hash";
import { filterItApproved } from "../../src/app/approved";
import { PATENTE_B_RULES_IT, scoreItExam } from "../../src/lib/shared/examIt";
import { pickItExam, itTimeLeft, formatClock } from "../../src/lib/itExam";
import { readFlags } from "../../src/lib/shared/flags";
import { KLASSE_B_RULES_2026 } from "../../src/lib/shared/exam";
import type { D1Like, D1Stmt } from "../../worker/dr/db";

const TODAY = "2026-11-21";
const row = (over: Partial<ReviewRow> & { content_id: string; stage: ReviewRow["stage"] }): ReviewRow => ({
  id: 1, source: "it", content_kind: "itQuestion", content_hash: "", content_version: "v", outcome: "pass",
  reviewer_name: "Reviewer Name", reviewer_role: "sorani_translator", reviewed_on: TODAY, evidence_ref: "evidence/doc-1",
  note: "", rules_version: null, recorded_by: "owner:x", recorded_at: 1, revoked_at: null, revoked_by: null, revoke_reason: null,
  ...over,
});

describe("Italian items in the review pipeline", () => {
  it("are all reviewable, with their own ids", () => {
    expect(IT_REVIEW_ITEMS.length).toBe(IT_QUESTIONS.length + IT_SIGNS.length);
    for (const i of IT_REVIEW_ITEMS) expect(REVIEW_ITEM_BY_ID.get(i.id)).toBe(i);
    expect(ALL_REVIEW_ITEMS.length).toBeGreaterThan(IT_REVIEW_ITEMS.length);
  });
  it("pass their automatic validation", () => {
    for (const i of IT_REVIEW_ITEMS) expect(i.checks.filter((c) => !c.ok).map((c) => c.label), i.id).toEqual([]);
  });
  it("carry the fingerprint of the content that ships", () => {
    for (const q of IT_QUESTIONS) expect(IT_REVIEW_ITEM_BY_ID.get(q.id)?.hash).toBe(itQuestionHash(q));
    for (const s of IT_SIGNS) expect(IT_REVIEW_ITEM_BY_ID.get(s.id)?.hash).toBe(itSignHash(s));
  });
  it("live in their own review table, apart from the German audit trail", () => {
    expect(REVIEW_TABLE.it).toBe("dr_it_content_reviews");
    expect(REVIEW_TABLE.de).toBe("dr_content_reviews");
    for (const i of IT_REVIEW_ITEMS) expect(sourceFor(i.kind)).toBe("it");
    expect(sourceFor("sign")).toBe("de");
    expect(sourceFor("signQuiz")).toBe("de");
  });
  it("are validated against the Italian exam rules, never the German ones", () => {
    expect(rulesVersionFor("itQuestion")).toBe(IT_RULES_VERSION);
    expect(rulesVersionFor("itSign")).toBe(IT_RULES_VERSION);
    expect(rulesVersionFor("signQuiz")).toBe(KLASSE_B_RULES_2026.version);
    expect(IT_RULES_VERSION).not.toBe(KLASSE_B_RULES_2026.version);
  });
  it("ignore a review row recorded in the other table", () => {
    const item = IT_REVIEW_ITEM_BY_ID.get(IT_QUESTIONS[0]!.id)!;
    expect(activeRows(item, [row({ content_id: item.id, stage: "TRANSLATION_REVIEW", content_hash: item.hash, source: "de" })])).toEqual([]);
    expect(activeRows(item, [row({ content_id: item.id, stage: "TRANSLATION_REVIEW", content_hash: item.hash })]).length).toBe(1);
  });
});

describe("Italian publication gate", () => {
  const item = () => IT_REVIEW_ITEM_BY_ID.get(IT_QUESTIONS[0]!.id)!;
  it("publishes nothing without review rows", () => {
    for (const st of evaluateAll([])) {
      expect(st.publishable, st.id).toBe(false);
      expect(st.status, st.id).toBe("AWAITING_REVIEW");
    }
  });
  it("still refuses after the translation review alone", () => {
    const i = item();
    const st = evaluate(i, [row({ id: 1, content_id: i.id, content_hash: i.hash, stage: "TRANSLATION_REVIEW" })]);
    expect(st.status).toBe("TRANSLATION_REVIEW_DONE");
    expect(st.publishable).toBe(false);
  });
  // The whole point of the gate: a complete, ordered, named human review publishes the item, and nothing else does.
  it("publishes only after translation, educational and owner approval", () => {
    const i = item();
    const rows: ReviewRow[] = [
      row({ id: 1, content_id: i.id, content_hash: i.hash, stage: "TRANSLATION_REVIEW", reviewer_name: "Sorani Reviewer", recorded_at: 1 }),
      row({ id: 2, content_id: i.id, content_hash: i.hash, stage: "EDUCATIONAL_REVIEW", reviewer_name: "Istruttore Rossi", reviewer_role: "driving_instructor", rules_version: IT_RULES_VERSION, recorded_at: 2 }),
      row({ id: 3, content_id: i.id, content_hash: i.hash, stage: "APPROVED", reviewer_name: "Content Owner", reviewer_role: "content_owner", recorded_at: 3 }),
    ];
    const st = evaluate(i, rows);
    expect(st.reasons).toEqual([]);
    expect(st.publishable).toBe(true);
    expect(st.status).toBe("PUBLISHED");
  });
  it("refuses when the educational review validated the German rules instead", () => {
    const i = item();
    const st = evaluate(i, [
      row({ id: 1, content_id: i.id, content_hash: i.hash, stage: "TRANSLATION_REVIEW", recorded_at: 1 }),
      row({ id: 2, content_id: i.id, content_hash: i.hash, stage: "EDUCATIONAL_REVIEW", reviewer_role: "driving_instructor", rules_version: KLASSE_B_RULES_2026.version, recorded_at: 2 }),
      row({ id: 3, content_id: i.id, content_hash: i.hash, stage: "APPROVED", reviewer_role: "content_owner", recorded_at: 3 }),
    ]);
    expect(st.publishable).toBe(false);
    expect(st.reasons.join(" ")).toContain(IT_RULES_VERSION);
  });
  it("drops an approval that was recorded for other wording", () => {
    const i = item();
    const st = evaluate(i, [
      row({ id: 1, content_id: i.id, content_hash: "stale", stage: "TRANSLATION_REVIEW", recorded_at: 1 }),
      row({ id: 2, content_id: i.id, content_hash: "stale", stage: "EDUCATIONAL_REVIEW", reviewer_role: "driving_instructor", rules_version: IT_RULES_VERSION, recorded_at: 2 }),
      row({ id: 3, content_id: i.id, content_hash: "stale", stage: "APPROVED", reviewer_role: "content_owner", recorded_at: 3 }),
    ]);
    expect(st.publishable).toBe(false);
  });
  it("never accepts a machine as the reviewer of an Italian item", () => {
    const i = item();
    const sub = parseSubmission({ stage: "TRANSLATION_REVIEW", outcome: "pass", reviewerName: "Claude", reviewedOn: TODAY, evidenceRef: "evidence/doc-1", ids: [i.id], confirm: true });
    expect(typeof sub).not.toBe("string");
    if (typeof sub === "string") return;
    expect(checkSubmission(sub, i, [], TODAY)).toBe("REVIEWER_NAME_INVALID");
  });
  it("requires the translation review before the educational one", () => {
    const i = item();
    const sub = parseSubmission({ stage: "EDUCATIONAL_REVIEW", outcome: "pass", reviewerName: "Istruttore Rossi", reviewedOn: TODAY, evidenceRef: "evidence/doc-1", ids: [i.id], confirm: true });
    if (typeof sub === "string") throw new Error(sub);
    expect(checkSubmission(sub, i, [], TODAY)).toBe("TRANSLATION_REVIEW_FIRST");
  });
});

describe("what the Italian learner is served", () => {
  it("shows nothing when the server approved nothing, or failed", () => {
    expect(filterItApproved({ ok: true })).toEqual({ signs: [], questions: [] });
    expect(filterItApproved(null)).toEqual({ signs: [], questions: [] });
    expect(filterItApproved({ ok: false, itQuestions: { [IT_QUESTIONS[0]!.id]: itQuestionHash(IT_QUESTIONS[0]!) } })).toEqual({ signs: [], questions: [] });
  });
  it("shows exactly the approved version of an item", () => {
    const q = IT_QUESTIONS[0]!;
    const s = IT_SIGNS[0]!;
    const got = filterItApproved({ ok: true, itQuestions: { [q.id]: itQuestionHash(q) }, itSigns: { [s.id]: itSignHash(s) } });
    expect(got.questions.map((x) => x.id)).toEqual([q.id]);
    expect(got.signs.map((x) => x.id)).toEqual([s.id]);
  });
  it("ignores an approval whose fingerprint no longer matches", () => {
    const q = IT_QUESTIONS[0]!;
    expect(filterItApproved({ ok: true, itQuestions: { [q.id]: "stale" } }).questions).toEqual([]);
  });
});

describe("one bank missing never breaks the other", () => {
  // The Italian review table only exists once the owner applies migration 0007. Until then the Italian
  // bank publishes nothing and the German bank must keep working exactly as before.
  const onlyGerman = (): D1Like => {
    const stmt = (sql: string): D1Stmt => ({
      bind: () => stmt(sql),
      first: async () => null,
      all: async <T,>() => {
        if (sql.includes("dr_it_content_reviews")) throw new Error("no such table: dr_it_content_reviews");
        return { results: [] as T[] };
      },
      run: async () => undefined,
    });
    return { prepare: stmt };
  };
  it("reports the German bank ready and the Italian one not", async () => {
    const out = await approvedContent(onlyGerman());
    expect(out.ready).toEqual({ de: true, it: false });
    expect(out.ok).toBe(true);
    expect(out.itQuestions).toEqual({});
    expect(out.itSigns).toEqual({});
  });
});

describe("Italian exam rules", () => {
  it("are the real ministerial format: 30 statements, 20 minutes, at most 3 errors", () => {
    expect(PATENTE_B_RULES_IT.questionCount).toBe(30);
    expect(PATENTE_B_RULES_IT.minutes).toBe(20);
    expect(PATENTE_B_RULES_IT.maxErrors).toBe(3);
    expect(PATENTE_B_RULES_IT.sources.length).toBeGreaterThanOrEqual(2);
    expect(PATENTE_B_RULES_IT.sources.join(" ")).toContain("mit.gov.it");
    expect(PATENTE_B_RULES_IT.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("pass with three errors and fail with four", () => {
    const paper = (errors: number) => Array.from({ length: 30 }, (_, i) => ({ questionId: `q${i}`, correct: i >= errors }));
    expect(scoreItExam(paper(3)).passed).toBe(true);
    expect(scoreItExam(paper(3)).errors).toBe(3);
    expect(scoreItExam(paper(4)).passed).toBe(false);
    expect(scoreItExam(paper(4)).failReason).toBe("too_many_errors");
  });
  it("score each question once", () => {
    expect(scoreItExam([{ questionId: "a", correct: false }, { questionId: "a", correct: true }]).answered).toBe(1);
  });
  it("carry no German error points", () => {
    expect("maxErrorPoints" in PATENTE_B_RULES_IT).toBe(false);
    expect(scoreItExam([]).rulesVersion).toBe(PATENTE_B_RULES_IT.version);
  });
  // A short paper would not be this exam, so there is none until 30 approved questions exist.
  it("refuse a paper when fewer than 30 approved questions exist", () => {
    expect(pickItExam(IT_QUESTIONS)).toBeNull();
    expect(pickItExam([])).toBeNull();
  });
  it("draw exactly 30 different questions when enough exist", () => {
    const pool = Array.from({ length: 40 }, (_, i) => ({ ...IT_QUESTIONS[0]!, id: `x-${i}` }));
    const paper = pickItExam(pool);
    expect(paper?.length).toBe(30);
    expect(new Set(paper?.map((q) => q.id)).size).toBe(30);
  });
  it("count the 20 minutes down and never below zero", () => {
    expect(itTimeLeft(1000, 1000)).toBe(1200);
    expect(itTimeLeft(1000, 1000 + 60_000)).toBe(1140);
    expect(itTimeLeft(1000, 1000 + 10_000_000)).toBe(0);
    expect(formatClock(1200)).toBe("20:00");
    expect(formatClock(59)).toBe("0:59");
  });
});

describe("free access", () => {
  // Italy is free for a registered learner: a purchase can only ever be required with payments AND a
  // production database AND the flag, and payments stay off until the owner decides otherwise.
  it("never requires a purchase while payments are off", () => {
    expect(readFlags({ PURCHASE_REQUIRED: "true" }).purchaseRequired).toBe(false);
    expect(readFlags({ PURCHASE_REQUIRED: "true", PAYMENTS_ENABLED: "true" }).purchaseRequired).toBe(false);
    expect(readFlags({}).purchaseRequired).toBe(false);
    expect(readFlags({}).checkoutEnabled).toBe(false);
  });
});
