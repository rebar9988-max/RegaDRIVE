import { describe, expect, it } from "vitest";
import { parseItQuestion, parseItSign, textIssues } from "../../src/content/italy/schema";
import { parseItalyImport, runItalyImport, validateItalyImport, IT_IMPORT_MAX_ITEMS } from "../../worker/italy/import";
import { loadItalyCatalogue, bundledItalyCatalogue } from "../../worker/italy/catalogue";
import { itReviewItemsFor } from "../../src/content/italy/reviewItems";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { IT_SIGNS } from "../../src/content/italy/signs";
import { parseItalyPublished, readCachedItaly, writeCachedItaly } from "../../src/app/approved";
import type { D1Like, D1Stmt } from "../../worker/dr/db";

const SIGN_IDS = new Set(IT_SIGNS.map((s) => s.id));
const text = (it: string) => ({ it, ckb: "دەقی سۆرانی", kmrArab: "دەقێ بادینی" });
const question = (over: Record<string, unknown> = {}) => ({
  id: "it-x-001", chapter: 1, answer: true,
  prompt: text("La carreggiata è la parte della strada su cui viaggiano i veicoli."),
  explanation: text("VERO: è la definizione dell'articolo 3."),
  sourceRefs: ["CdS art. 3"],
  ...over,
});
const sign = (over: Record<string, unknown> = {}) => ({
  id: "it-x-sign", file: "x-sign.svg", group: "danger",
  name: text("Pericolo"), sourceRefs: ["RegaDRIVE original illustration"],
  ...over,
});

/** A tiny in-memory stand-in for the content database, enough for the import and catalogue paths. */
function fakeDb(rows: { id: string; kind: string; payload: string }[] = [], opts: { broken?: boolean } = {}): D1Like & { rows: typeof rows } {
  const store = rows;
  const stmt = (sql: string, args: unknown[] = []): D1Stmt => ({
    bind: (...next: unknown[]) => stmt(sql, next),
    first: async <T,>() => {
      if (opts.broken) throw new Error("no such table: italy_content");
      if (sql.includes("SELECT payload FROM italy_content")) {
        const found = store.find((r) => r.id === args[0]);
        return (found ? { payload: found.payload } : null) as T | null;
      }
      return null as T | null;
    },
    all: async <T,>() => {
      if (opts.broken) throw new Error("no such table: italy_content");
      return { results: store.filter((r) => r.kind === "question" || r.kind === "sign") as unknown as T[] };
    },
    run: async () => {
      if (sql.startsWith("INSERT INTO italy_content")) {
        const [id, kind, , payload] = [args[0] as string, args[1] as string, args[2], args[3] as string];
        const at = store.findIndex((r) => r.id === id);
        if (at >= 0) store[at] = { id, kind, payload }; else store.push({ id, kind, payload });
      }
      return undefined;
    },
  });
  return { prepare: (sql: string) => stmt(sql), rows: store } as D1Like & { rows: typeof rows };
}

describe("imported question validation", () => {
  it("accepts a complete question", () => {
    const parsed = parseItQuestion(question(), SIGN_IDS);
    expect(parsed.issues).toEqual([]);
    expect(parsed.value?.questionCode).toBeNull();
    expect(parsed.value?.sourceType).toBe("original");
    expect(parsed.value?.reviewStatus).toBe("pending");
  });
  // Every rule below is one a learner would otherwise be taught wrongly.
  it("refuses an explanation that contradicts the answer key", () => {
    const parsed = parseItQuestion(question({ answer: false }), SIGN_IDS);
    expect(parsed.value).toBeUndefined();
    expect(parsed.issues.map((i) => i.field)).toContain("explanation.it");
  });
  it("refuses a missing or non-boolean answer", () => {
    expect(parseItQuestion(question({ answer: "vero" }), SIGN_IDS).issues.map((i) => i.field)).toContain("answer");
  });
  it("refuses a chapter outside the syllabus", () => {
    for (const chapter of [0, 17, 1.5, "1"]) {
      expect(parseItQuestion(question({ chapter }), SIGN_IDS).issues.map((i) => i.field), String(chapter)).toContain("chapter");
    }
  });
  it("refuses an official question code or pre-approval", () => {
    expect(parseItQuestion(question({ questionCode: "1.1.1" }), SIGN_IDS).issues.map((i) => i.field)).toContain("questionCode");
    expect(parseItQuestion(question({ reviewStatus: "approved" }), SIGN_IDS).issues.map((i) => i.field)).toContain("reviewStatus");
  });
  it("requires a legal reference", () => {
    expect(parseItQuestion(question({ sourceRefs: [] }), SIGN_IDS).issues.map((i) => i.field)).toContain("sourceRefs");
  });
  it("refuses an unknown sign", () => {
    expect(parseItQuestion(question({ signId: "it-nope" }), SIGN_IDS).issues.map((i) => i.field)).toContain("signId");
  });
  it("keeps each language in its own script", () => {
    expect(textIssues("prompt", { it: "نووسینی عەرەبی", ckb: "سۆرانی", kmrArab: "بادینی" }).map((i) => i.problem)).toContain("Italian text must be Latin script");
    expect(textIssues("prompt", { it: "Testo", ckb: "Sorani in Latin", kmrArab: "بادینی" }).map((i) => i.problem)).toContain("Sorani text must be Arabic script");
    expect(textIssues("prompt", { it: "Testo", ckb: "سۆرانی", kmrArab: "" }).map((i) => i.problem)).toContain("Badini text missing");
    expect(textIssues("prompt", { it: "Testo", ckb: "سۆرانی", kmrArab: "بادینی", ar: "ڕەقەم سۆرانی" }).map((i) => i.problem)).toContain("Arabic text contains Sorani-only letters");
  });
  it("accepts a valid sign and refuses a path or a wrong group", () => {
    expect(parseItSign(sign()).issues).toEqual([]);
    expect(parseItSign(sign({ file: "../secret.svg" })).issues.map((i) => i.field)).toContain("file");
    expect(parseItSign(sign({ file: "https://x/y.svg" })).issues.map((i) => i.field)).toContain("file");
    expect(parseItSign(sign({ group: "whatever" })).issues.map((i) => i.field)).toContain("group");
  });
});

describe("the import itself", () => {
  it("rejects a body that is not a batch, an empty batch or one that is too large", () => {
    expect(parseItalyImport(null)).toBe("BAD_REQUEST");
    expect(parseItalyImport({})).toBe("BAD_REQUEST");
    expect(parseItalyImport({ items: [] })).toBe("NO_ITEMS");
    expect(parseItalyImport({ items: new Array(IT_IMPORT_MAX_ITEMS + 1).fill(question()) })).toBe("TOO_MANY_ITEMS");
    expect(parseItalyImport({ items: [question()], dryRun: true })).toEqual({ items: [question()], dryRun: true });
  });
  it("stores what is valid and reports what is not, item by item", async () => {
    const db = fakeDb();
    const result = await runItalyImport(db, [question(), question({ id: "it-x-002", answer: false }), { id: "bad" }], false, "test");
    expect(result.stored).toBe(1);
    expect(result.rejected.length).toBe(2);
    expect(result.rejected.map((r) => r.id)).toEqual(expect.arrayContaining(["it-x-002", "bad"]));
    expect(db.rows.map((r) => r.id)).toEqual(["it-x-001"]);
  });
  it("changes nothing on a dry run", async () => {
    const db = fakeDb();
    const result = await runItalyImport(db, [question()], true, "test");
    expect(result.stored).toBe(1);
    expect(result.dryRun).toBe(true);
    expect(db.rows).toEqual([]);
  });
  it("leaves an unchanged item alone, so its review survives", async () => {
    const db = fakeDb();
    await runItalyImport(db, [question()], false, "test");
    const again = await runItalyImport(db, [question()], false, "test");
    expect(again.unchanged).toBe(1);
    expect(again.stored).toBe(0);
    expect(again.changed).toEqual([]);
  });
  it("reports an item whose wording changed, because its approval no longer counts", async () => {
    const db = fakeDb();
    await runItalyImport(db, [question()], false, "test");
    const edited = await runItalyImport(db, [question({ prompt: text("La banchina non è una corsia di marcia.") })], false, "test");
    expect(edited.changed).toEqual(["it-x-001"]);
    expect(edited.stored).toBe(1);
  });
  it("lets a question in the same batch point at a sign imported beside it", async () => {
    const db = fakeDb();
    const { accepted, rejected } = await validateItalyImport(db, [question({ signId: "it-x-sign" }), sign()]);
    expect(rejected).toEqual([]);
    expect(accepted.map((a) => a.kind)).toEqual(["sign", "question"]);
  });
  it("refuses the same id twice in one batch", async () => {
    const db = fakeDb();
    const { rejected } = await validateItalyImport(db, [question(), question()]);
    expect(rejected.length).toBe(1);
    expect(rejected[0]?.issues[0]?.problem).toBe("repeated in this import");
  });
});

describe("the catalogue the server works with", () => {
  it("is the build's own when nothing is stored, unreadable or no database is bound", async () => {
    expect((await loadItalyCatalogue(undefined)).source).toBe("bundled");
    expect((await loadItalyCatalogue(fakeDb())).questions.length).toBe(IT_QUESTIONS.length);
    expect((await loadItalyCatalogue(fakeDb([], { broken: true }))).source).toBe("bundled");
    expect(bundledItalyCatalogue().signs.length).toBe(IT_SIGNS.length);
  });
  it("is the stored one once the owner has imported", async () => {
    const db = fakeDb();
    await runItalyImport(db, [sign(), question({ signId: "it-x-sign" })], false, "test");
    const catalogue = await loadItalyCatalogue(db);
    expect(catalogue.source).toBe("stored");
    expect(catalogue.questions.map((q) => q.id)).toEqual(["it-x-001"]);
    expect(catalogue.signs.map((s) => s.id)).toEqual(["it-x-sign"]);
  });
  it("leaves out a stored row that is corrupt, and counts it", async () => {
    const db = fakeDb([
      { id: "it-x-001", kind: "question", payload: JSON.stringify(question()) },
      { id: "it-broken", kind: "question", payload: "{not json" },
      { id: "it-wrong", kind: "question", payload: JSON.stringify(question({ id: "it-wrong", answer: false })) },
    ]);
    const catalogue = await loadItalyCatalogue(db);
    expect(catalogue.questions.map((q) => q.id)).toEqual(["it-x-001"]);
    expect(catalogue.skipped).toBe(2);
  });
  it("gives an imported item review items with its own legal references", async () => {
    const db = fakeDb();
    await runItalyImport(db, [sign(), question({ signId: "it-x-sign" })], false, "test");
    const catalogue = await loadItalyCatalogue(db);
    const items = itReviewItemsFor(catalogue.questions, catalogue.signs);
    expect(items.length).toBe(2);
    for (const item of items) {
      expect(item.sourceRefs.length, item.id).toBeGreaterThan(0);
      expect(item.checks.filter((c) => !c.ok).map((c) => c.label), item.id).toEqual([]);
      expect(item.valid, item.id).toBe(true);
      expect(item.hash.length).toBeGreaterThan(0);
    }
  });
});

describe("what the learner's app accepts from the server", () => {
  it("takes a published catalogue", () => {
    const got = parseItalyPublished({ ok: true, signs: [sign()], questions: [question({ signId: "it-x-sign" })] });
    expect(got?.questions.map((q) => q.id)).toEqual(["it-x-001"]);
    expect(got?.signs.map((s) => s.id)).toEqual(["it-x-sign"]);
  });
  it("falls back when the endpoint is absent, failed or malformed", () => {
    expect(parseItalyPublished(null)).toBeNull();
    expect(parseItalyPublished({ ok: false, questions: [], signs: [] })).toBeNull();
    expect(parseItalyPublished({ ok: true })).toBeNull();
  });
  it("drops an item the server sent that does not validate", () => {
    const got = parseItalyPublished({ ok: true, signs: [], questions: [question({ answer: false })] });
    expect(got?.questions).toEqual([]);
  });
});

describe("the catalogue a learner keeps offline", () => {
  const store = () => {
    const map = new Map<string, string>();
    return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
  };
  const payload = { signs: [parseItSign(sign()).value!], questions: [parseItQuestion(question({ signId: "it-x-sign" }), new Set(["it-x-sign"])).value!] };

  it("comes back exactly as it was written", () => {
    const s = store();
    writeCachedItaly(s, payload);
    const back = readCachedItaly(s);
    expect(back?.questions.map((q) => q.id)).toEqual(["it-x-001"]);
    expect(back?.signs.map((x) => x.id)).toEqual(["it-x-sign"]);
  });
  it("is nothing when there is no store, nothing stored, or the copy is unreadable", () => {
    expect(readCachedItaly(undefined)).toBeNull();
    expect(readCachedItaly(store())).toBeNull();
    const broken = store();
    broken.map.set("regadrive:it-published:v1", "{not json");
    expect(readCachedItaly(broken)).toBeNull();
  });
  // The copy in the browser is untrusted on the way back in.
  it("drops a cached item that no longer validates", () => {
    const s = store();
    s.map.set("regadrive:it-published:v1", JSON.stringify({ signs: [], questions: [question({ answer: false })] }));
    expect(readCachedItaly(s)?.questions).toEqual([]);
  });
  it("survives a store that refuses to write", () => {
    expect(() => writeCachedItaly({ setItem: () => { throw new Error("quota"); } }, payload)).not.toThrow();
    expect(() => writeCachedItaly(undefined, payload)).not.toThrow();
  });
});
