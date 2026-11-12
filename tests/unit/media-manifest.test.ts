import { describe, expect, it } from "vitest";
import template from "../../docs/import/media-manifest.template.json?raw";
import { parseMediaManifest, validateMediaManifest, type ManifestContext, type MediaManifest, type MediaRecord, type ScenarioSheet } from "../../src/lib/shared/mediaManifest";
import { catalogReport } from "../../src/lib/shared/catalog";
import { CATALOG_PLAN, CATALOG_PLAN_STATUS, planCoverage, planTotal } from "../../src/lib/shared/catalogPlan";
import { TOPICS } from "../../src/content/topics";
import { QUESTIONS } from "../../src/content/questions";
import type { Question } from "../../src/content/types";

const SHA = "a".repeat(64);
const scenario = (over: Partial<ScenarioSheet> = {}): ScenarioSheet => ({
  id: "sc-1", questionRefs: ["q-1"], description: "Kreuzung ohne Zeichen, Pkw von rechts", signs: [], legalRefs: ["StVO §8 Abs. 1"],
  expectedBehaviour: "Dem Pkw von rechts Vorfahrt gewähren", approvedBy: "Test Instructor", approvedOn: "2026-11-01", ...over,
});
const record = (over: Partial<MediaRecord> = {}): MediaRecord => ({
  file: "sc-1.webp", kind: "image", sha256: SHA, origin: "original_regadrive", licenseId: null, author: "RegaDRIVE Studio", tool: "Blender 4.2",
  sourceFile: "archive/sc-1.blend", thirdPartyAssets: [], aiGenerated: false, scenarioId: "sc-1", createdOn: "2026-11-02",
  reviews: [{ reviewer: "Test Instructor", role: "driving_instructor", date: "2026-11-03", sha256: SHA, outcome: "pass", evidenceRef: "review-1" }], ...over,
});
const ctx: ManifestContext = { knownLicenses: new Set(["LIC-1"]) };
const run = (m: Partial<MediaManifest>, c: ManifestContext = ctx) => validateMediaManifest({ scenarios: [scenario()], media: [record()], ...m }, c);
const kinds = (m: Partial<MediaManifest>, c: ManifestContext = ctx) => run(m, c).issues.map((i) => i.kind);

describe("media manifest", () => {
  it("approves a file only with complete provenance, an approved scenario and an instructor review of this file", () => {
    const r = run({});
    expect(r.issues).toEqual([]);
    expect(r.approvedFiles).toEqual(["sc-1.webp"]);
    expect(r.summary).toMatchObject({ media: 1, approved: 1, original: 1, licensed: 0, aiGenerated: 0 });
  });
  it("the template parses and nothing in it counts as approved", () => {
    const r = validateMediaManifest(parseMediaManifest(template), ctx);
    expect(r.approvedFiles).toEqual([]);
    expect(r.issues.length).toBeGreaterThan(0);
  });
  it("rejects a malformed manifest file", () => {
    expect(() => parseMediaManifest("[]")).toThrow(/expected/);
    expect(() => parseMediaManifest("{not json")).toThrow();
  });
  it("needs a review by a named driving instructor; automatic or owner sign-off is not enough", () => {
    expect(kinds({ media: [record({ reviews: [] })] })).toEqual(["no_instructor_review"]);
    expect(kinds({ media: [record({ reviews: [{ ...record().reviews[0]!, role: "automated" }] })] })).toEqual(["no_instructor_review"]);
    expect(kinds({ media: [record({ reviews: [{ ...record().reviews[0]!, role: "content_owner" }] })] })).toEqual(["no_instructor_review"]);
    expect(kinds({ media: [record({ reviews: [{ ...record().reviews[0]!, reviewer: " " }] })] })).toEqual(["no_instructor_review"]);
  });
  it("a re-rendered file needs a new review; a failed review blocks until a later pass", () => {
    expect(kinds({ media: [record({ sha256: "b".repeat(64) })] })).toEqual(["review_of_other_version"]);
    const fail = { ...record().reviews[0]!, outcome: "fail" as const, date: "2026-11-04" };
    expect(kinds({ media: [record({ reviews: [record().reviews[0]!, fail] })] })).toEqual(["failed_review"]);
    expect(kinds({ media: [record({ reviews: [fail, { ...record().reviews[0]!, date: "2026-11-05" }] })] })).toEqual([]);
  });
  it("AI-generated media is disclosed and still needs the instructor review", () => {
    expect(run({ media: [record({ aiGenerated: true })] }).summary.aiGenerated).toBe(1);
    expect(kinds({ media: [record({ aiGenerated: true, reviews: [] })] })).toEqual(["no_instructor_review"]);
  });
  it("original media needs author, tool and the editable source; bundled assets name their licence", () => {
    expect(kinds({ media: [record({ author: "", tool: "", sourceFile: "" })] }).sort()).toEqual(["missing_author", "missing_source_file", "missing_tool"]);
    expect(kinds({ media: [record({ thirdPartyAssets: ["car model"] })] })).toEqual(["third_party_asset_without_licence"]);
    expect(kinds({ media: [record({ thirdPartyAssets: ["car model — CC0 — polyhaven.com"] })] })).toEqual([]);
    expect(kinds({ media: [record({ licenseId: "LIC-1" })] })).toEqual(["original_with_licence"]);
  });
  it("licensed media needs a registered licence; an unknown origin is never accepted", () => {
    expect(kinds({ media: [record({ origin: "licensed", licenseId: null })] })).toEqual(["licensed_without_licence"]);
    expect(kinds({ media: [record({ origin: "licensed", licenseId: "LIC-X" })] })).toEqual(["unknown_licence"]);
    expect(kinds({ media: [record({ origin: "licensed", licenseId: "LIC-1" })] })).toEqual([]);
    expect(kinds({ media: [record({ origin: "screenshot" as never })] })).toEqual(["unknown_origin"]);
  });
  it("the scenario sheet must exist, be complete, linked to a question and approved before rendering", () => {
    expect(kinds({ scenarios: [] })).toEqual(["unknown_scenario"]);
    expect(kinds({ scenarios: [scenario({ legalRefs: [] })] })).toEqual(["scenario_incomplete", "scenario_not_approved"]);
    expect(kinds({ scenarios: [scenario({ questionRefs: [] })] })).toEqual(["scenario_without_question", "scenario_not_approved"]);
    expect(kinds({ scenarios: [scenario({ approvedBy: "" })] })).toEqual(["scenario_not_approved", "scenario_not_approved"]);
    expect(kinds({ scenarios: [scenario(), scenario()] })).toEqual(["duplicate_scenario"]);
  });
  it("must describe exactly the attached file", () => {
    const attached = (sha: string, kind: "image" | "video" = "image") => ({ ...ctx, attached: new Map([["sc-1.webp", { sha256: sha, kind }]]) });
    expect(kinds({}, attached(SHA))).toEqual([]);
    expect(kinds({}, attached("c".repeat(64)))).toEqual(["hash_mismatch"]);
    expect(kinds({}, attached(SHA, "video"))).toEqual(["kind_mismatch"]);
    expect(kinds({}, { ...ctx, attached: new Map() })).toEqual(["file_not_attached"]);
    expect(kinds({ media: [record(), record()] })).toEqual(["duplicate_file"]);
    expect(kinds({ media: [record({ sha256: "xyz" })] })).toContain("bad_hash");
  });
});

describe("reusable 3D scenes and delivery variants", () => {
  const scene = (over = {}) => ({ id: "scene-junction-01", name: "Kreuzung innerorts", kind: "junction" as const, tool: "Blender 4.2", sourceFile: "archive/junction-01.blend", author: "RegaDRIVE Studio", thirdPartyAssets: [], version: 1, ...over });
  const SHB = "b".repeat(64);
  const review = (sha: string) => [{ reviewer: "Test Instructor", role: "driving_instructor" as const, date: "2026-11-03", sha256: sha, outcome: "pass" as const, evidenceRef: "r" }];
  const poster = record({ file: "clip-poster.webp", sha256: SHB, reviews: review(SHB) });
  const video = (over: Partial<MediaRecord> = {}) => record({ file: "clip.mp4", kind: "video", variants: { poster: "clip-poster.webp" }, ...over });

  it("a picture built from library scenes is approved when the scenes are complete", () => {
    const r = run({ scenes: [scene()], media: [record({ scenes: ["scene-junction-01"] })] });
    expect(r.issues).toEqual([]);
    expect(r.summary).toMatchObject({ scenes: 1, images: 1, videos: 0 });
  });
  it("rejects unknown, duplicate and incomplete scenes", () => {
    expect(kinds({ scenes: [], media: [record({ scenes: ["scene-x"] })] })).toEqual(["unknown_scene"]);
    expect(kinds({ scenes: [scene(), scene()] })).toEqual(["duplicate_scene"]);
    expect(kinds({ scenes: [scene({ sourceFile: "" })], media: [record({ scenes: ["scene-junction-01"] })] })).toEqual(["scene_incomplete", "unknown_scene"]);
    expect(kinds({ scenes: [scene({ kind: "spaceship" })] })).toEqual(["scene_incomplete"]);
    expect(kinds({ scenes: [scene({ thirdPartyAssets: ["tree model"] })] })).toEqual(["scene_incomplete"]);
  });
  it("a video needs a poster image; variants must exist and have the right kind", () => {
    expect(run({ media: [poster, video()] }).approvedFiles).toEqual(["clip-poster.webp", "clip.mp4"]);
    expect(kinds({ media: [video({ variants: {} })] })).toEqual(["video_without_poster"]);
    expect(kinds({ media: [video({ variants: { poster: "missing.webp" } })] })).toEqual(["unknown_variant"]);
    expect(kinds({ media: [poster, video({ variants: { poster: "clip-poster.webp", webm: "clip-poster.webp" } })] })).toEqual(["variant_kind_mismatch"]);
    expect(kinds({ media: [record({ variants: { thumbnail: "sc-1.webp" } })] })).toEqual(["unknown_variant"]); // a file is not its own variant
    expect(run({ media: [poster, video()] }).summary).toMatchObject({ images: 1, videos: 1 });
  });
});

describe("media approval in the catalogue report", () => {
  const q: Question = {
    id: "q-1", topicId: "priority", categoryType: "Grundstoff", points: 5, questionCode: null, licenseClasses: ["B"], sourceType: "original",
    contentVersion: "t", reviewStatus: "approved", publicationStatus: "published", prompt: { de: "Wer fährt zuerst?", ckb: "کێ یەکەم دەڕوات؟" },
    options: [{ id: "a", text: { de: "Ich", ckb: "من" } }, { id: "b", text: { de: "Der andere", ckb: "ئەوی تر" } }], correct: ["b"],
    explanation: { de: "Rechts vor links", ckb: "ڕاست پێش چەپ" }, vocabularyIds: [],
    media: [{ kind: "image", key: "media/aa.webp", alt: { de: "Kreuzung", ckb: "چوارڕێیان" } }],
  };
  it("a question with unapproved media is valid but never ready for learners", () => {
    expect(catalogReport([q], { target: 1, approvedMediaKeys: new Set() })).toMatchObject({ valid: 1, ready: 0, complete: false, issueCounts: { media_not_approved: 1 } });
    expect(catalogReport([q], { target: 1, approvedMediaKeys: new Set(["media/aa.webp"]) })).toMatchObject({ valid: 1, ready: 1, complete: true });
  });
});

describe("plan for 1,600 questions", () => {
  it("covers every topic once, adds up to 1,600 and is marked as a proposal", () => {
    expect(planTotal()).toBe(1600);
    expect(CATALOG_PLAN.map((t) => t.topicId).sort()).toEqual(TOPICS.map((t) => t.id).sort());
    for (const t of CATALOG_PLAN) {
      expect(TOPICS.find((x) => x.id === t.topicId)!.category).toBe(t.category);
      expect(t.withMedia).toBeLessThanOrEqual(t.quota);
    }
    expect(CATALOG_PLAN_STATUS).toBe("proposed");
  });
  it("measures real coverage per topic and never counts a quota as content", () => {
    const c = planCoverage(QUESTIONS);
    expect(c.planMatchesTarget).toBe(true);
    expect(c.unplanned).toEqual([]);
    expect(c.topics.reduce((n, t) => n + t.total, 0)).toBe(QUESTIONS.length);
    expect(c.topics.reduce((n, t) => n + t.missing, 0)).toBe(1600 - QUESTIONS.length);
    expect(c.topics.every((t) => t.ready === 0 && t.mediaHave === 0)).toBe(true);
    expect(planCoverage([{ ...QUESTIONS[0]!, topicId: "unknown-topic" }]).unplanned).toEqual(["unknown-topic"]);
  });
});
