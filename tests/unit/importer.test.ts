import { describe, expect, it } from "vitest";
import fixture from "../fixtures/import/valid.json?raw";
import csvTemplate from "../../docs/import/questions.template.csv?raw";
import jsonTemplate from "../../docs/import/questions.template.json?raw";
import { contentHash, csvToImport, jsonToImport, parseCsv, previewImport, validateImport, type ImportContext, type ImportQuestion } from "../../src/lib/shared/importer";
import { TOPICS } from "../../src/content/topics";

const KEY = `media/${"a".repeat(64)}.png`;
const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
  knownTopics: new Set(TOPICS.map((t) => t.id)),
  knownLicenses: new Set(["LIC-FIXTURE"]),
  existing: new Map(),
  media: new Map([["fixture.png", { file: "fixture.png", kind: "image" as const, key: KEY, bytes: 10, mime: "image/png" }]]),
  ...over,
});
const rows = () => jsonToImport(fixture);
const one = (patch: Partial<ImportQuestion>): ImportQuestion[] => [{ ...rows()[0]!, ...patch }];
const errs = async (r: ImportQuestion[], c = ctx()) => (await validateImport(r, c)).rows[0]!.errors.map((e) => `${e.field}: ${e.message}`);

describe("import parsing", () => {
  it("parses RFC 4180 CSV with quotes, commas, newlines, escaped quotes and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","he said ""hi""\nnext"\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"\nnext']]);
    expect(() => parseCsv('a\n"open')).toThrow(/unterminated/);
  });
  it("rejects unknown CSV columns and missing required ones", () => {
    expect(() => csvToImport("prompt_de,evil_column\nx,y")).toThrow(/unknown column/);
    expect(() => csvToImport("prompt_de\nx")).toThrow(/missing column/);
  });
  it("the CSV template parses but its [[placeholders]] are rejected", async () => {
    const p = await previewImport("csv", csvTemplate, ctx());
    expect(p.fatal).toBeNull();
    expect(p.summary.invalid).toBe(1);
    expect(p.rows[0]!.errors.some((e) => e.message.includes("placeholder"))).toBe(true);
  });
  it("the JSON template is rejected until placeholders are replaced", async () => {
    const p = await previewImport("json", jsonTemplate, ctx());
    expect(p.summary.invalid).toBe(2);
  });
  it("turns malformed files into a fatal preview instead of throwing", async () => {
    expect((await previewImport("json", "{not json", ctx())).fatal).toBeTruthy();
    expect((await previewImport("json", '{"x":1}', ctx())).fatal).toMatch(/expected an array/);
  });
});

describe("import validation", () => {
  it("accepts the fixture and never publishes", async () => {
    const p = await validateImport(rows(), ctx());
    expect(p.summary).toMatchObject({ total: 2, new: 2, invalid: 0 });
    for (const r of p.rows) expect(r.question).toMatchObject({ reviewStatus: "draft", publicationStatus: "hidden", sourceType: "licensed_official", licenseId: "LIC-FIXTURE" });
    expect(p.rows[0]!.question!.media![0]!.key).toBe(KEY);
    expect(p.rows[1]!.question).toMatchObject({ answerType: "number", numericAnswer: 40, correct: [] });
    expect(p.rows[1]!.warnings.some((w) => w.field === "prompt.ckb")).toBe(true); // missing Sorani is a warning
  });
  it("requires licence, code and catalogue version for licensed content; forbids codes on original content", async () => {
    expect(await errs(one({ licenseId: null }))).toContain("licenseId: licensed content needs a documented licence id");
    expect(await errs(one({ licenseId: "UNKNOWN" }))).toContain("licenseId: unknown licence 'UNKNOWN' — register the licence first");
    expect(await errs(one({ questionCode: "abc" }))).toContain("questionCode: does not match the official code format");
    expect(await errs(one({ catalogueVersion: null }))).toContain("catalogueVersion: required for licensed official questions");
    expect(await errs(one({ sourceType: "original" }))).toContain("questionCode: original questions must not carry an official code");
  });
  it("validates answer mapping for choice and number questions", async () => {
    expect(await errs(one({ correct: ["z"] }))).toContain("correct: 'z' is not an option");
    expect(await errs(one({ correct: [] }))).toContain("correct: at least one correct option");
    expect(await errs(one({ options: [{ id: "a", de: "A" }] }))).toContain("options: 2–5 options required");
    expect(await errs(one({ answerType: "number", numericAnswer: undefined }))).toContain("numericAnswer: a finite number is required");
    expect(await errs(one({ points: 7 }))).toContain("points: must be 2, 3, 4 or 5");
  });
  it("rejects markup, wrong scripts and missing media", async () => {
    expect(await errs(one({ prompt: { de: "<img src=x onerror=alert(1)>" } }))).toContain("prompt.de: HTML/markup is not allowed");
    expect(await errs(one({ prompt: { de: "Frage", ckb: "Latin only" } }))).toContain("prompt.ckb: Sorani text must use Arabic script");
    expect(await errs(one({ prompt: { de: "پرسیار" } }))).toContain("prompt.de: German text contains Arabic script");
    expect(await errs(one({ media: [{ kind: "image", file: "missing.png", altDe: "x" }] }))).toContain("media[0].file: file 'missing.png' was not uploaded");
    expect(await errs(one({ media: [{ kind: "video", file: "fixture.png", altDe: "x" }] }))).toContain("media[0].file: file is a image, row says video");
  });
  it("detects duplicates in the file and against stored content, and classifies updates", async () => {
    const dup = await validateImport([rows()[0]!, rows()[0]!], ctx());
    expect(dup.rows[1]!.errors[0]!.message).toBe("duplicate of row 1 in this file");
    const sameContent = await validateImport([rows()[0]!, { ...rows()[0]!, questionCode: "0.0.00-009" }], ctx());
    expect(sameContent.rows[1]!.warnings.some((w) => w.message.includes("possible duplicate"))).toBe(true);
    const h = await contentHash(rows()[0]!);
    const existingSame = await validateImport([rows()[0]!], ctx({ existing: new Map([["0.0.00-001", h]]) }));
    expect(existingSame.rows[0]!.status).toBe("duplicate");
    const existingChanged = await validateImport([rows()[0]!], ctx({ existing: new Map([["0.0.00-001", "old-hash"]]) }));
    expect(existingChanged.rows[0]!.status).toBe("update");
  });
  it("translations do not change the content hash; German wording does", async () => {
    const q = rows()[0]!;
    expect(await contentHash({ ...q, prompt: { de: q.prompt.de, ckb: "گۆڕاو" } })).toBe(await contentHash(q));
    expect(await contentHash({ ...q, prompt: { de: q.prompt.de + "!" } })).not.toBe(await contentHash(q));
  });
  it("enforces size limits", async () => {
    expect((await previewImport("json", " ".repeat(5 * 1024 * 1024 + 1), ctx())).fatal).toMatch(/5 MB/);
    expect((await validateImport(new Array(5001).fill(rows()[0]!), ctx())).fatal).toMatch(/too many rows/);
  });
});

describe("optional difficulty rating", () => {
  it("accepts 1–3, keeps it on the question and leaves unrated questions unrated", async () => {
    const p = await validateImport([{ ...rows()[0]!, difficulty: 2 }, rows()[1]!], ctx());
    expect(p.summary.invalid).toBe(0);
    expect(p.rows[0]!.question!.difficulty).toBe(2);
    expect(p.rows[1]!.question!.difficulty).toBeUndefined();
  });
  it("rejects anything else", async () => {
    expect(await errs(one({ difficulty: 4 }))).toContain("difficulty: must be 1, 2 or 3 when given");
    expect(await errs(one({ difficulty: 1.5 }))).toContain("difficulty: must be 1, 2 or 3 when given");
  });
  it("reads the CSV column", () => {
    const [q] = csvToImport("source_type,category,points,topic_id,prompt_de,difficulty\noriginal,Grundstoff,3,priority,Frage,3");
    expect(q!.difficulty).toBe(3);
  });
});
