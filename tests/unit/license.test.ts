import { describe, expect, it } from "vitest";
import template from "../../docs/import/license-register.template.json?raw";
import fixture from "../fixtures/import/valid.json?raw";
import { licenseAllows, licenseChecklist, licenseProblems, parseLicenseRegister, NO_RIGHTS, type LicenseRecord } from "../../src/lib/shared/license";
import { jsonToImport, validateImport, type ImportContext } from "../../src/lib/shared/importer";
import { TOPICS } from "../../src/content/topics";

const ALL = { questionText: true, officialMedia: true, translation: true, ownMedia: true, online: true, offline: true };
const lic = (over: Partial<LicenseRecord> = {}): LicenseRecord => ({
  id: "LIC-FIXTURE", country: "DE", licensor: "Fixture Licensor", scope: "Klasse B test", status: "verified", validFrom: "2026-01-01", validUntil: "2027-01-01",
  evidenceRef: "contract-1", verifiedBy: "Owner", verifiedOn: "2026-01-02", catalogueVersions: ["2026-01-01"], licenseClasses: ["B"], rights: { ...ALL }, ...over,
});
const ctx = { today: "2026-06-01", country: "DE" as const, catalogueVersion: "2026-01-01", licenseClasses: ["B"] };

describe("licence rights gate", () => {
  it("allows a use only under a verified licence in force that grants exactly that right", () => {
    expect(licenseAllows(lic(), "publish_translation", ctx)).toEqual({ allowed: true, reasons: [] });
    expect(licenseAllows(undefined, "import", ctx).allowed).toBe(false);
  });
  it.each(["draft", "suspended", "expired", "revoked"] as const)("a %s licence allows nothing", (status) => {
    for (const use of ["import", "publish_question", "publish_translation", "use_official_media", "use_own_media", "offline_cache"] as const) expect(licenseAllows(lic({ status }), use, ctx).allowed).toBe(false);
  });
  it("respects the term, the country, the catalogue release and the class", () => {
    expect(licenseAllows(lic(), "import", { ...ctx, today: "2025-12-31" }).reasons).toEqual(["licence starts on 2026-01-01"]);
    expect(licenseAllows(lic(), "import", { ...ctx, today: "2027-01-01" }).reasons).toEqual(["licence ended on 2027-01-01"]);
    expect(licenseAllows(lic({ validUntil: null }), "import", { ...ctx, today: "2099-01-01" }).allowed).toBe(true);
    expect(licenseAllows(lic(), "import", { ...ctx, country: "IT" }).allowed).toBe(false);
    expect(licenseAllows(lic(), "import", { ...ctx, catalogueVersion: "2026-10-01" }).reasons).toEqual(["catalogue release 2026-10-01 is not covered"]);
    expect(licenseAllows(lic(), "import", { ...ctx, catalogueVersion: null }).allowed).toBe(false);
    expect(licenseAllows(lic(), "import", { ...ctx, licenseClasses: ["B", "A"] }).reasons).toEqual(["class A is not covered"]);
  });
  it("never assumes a right: translation, own media, official media, online and offline are separate", () => {
    const only = (rights: Partial<typeof ALL>) => lic({ rights: { ...NO_RIGHTS, ...rights } });
    expect(licenseAllows(only({ questionText: true }), "import", ctx).allowed).toBe(true);
    expect(licenseAllows(only({ questionText: true }), "publish_question", ctx).reasons).toEqual(["right not granted: online use"]);
    expect(licenseAllows(only({ questionText: true, online: true }), "publish_question", ctx).allowed).toBe(true);
    expect(licenseAllows(only({ questionText: true, online: true }), "publish_translation", ctx).reasons).toEqual(["right not granted: translation"]);
    expect(licenseAllows(only({ questionText: true, online: true }), "use_own_media", ctx).allowed).toBe(false);
    expect(licenseAllows(only({ ownMedia: true }), "use_official_media", ctx).allowed).toBe(false);
    expect(licenseAllows(only({ online: true }), "offline_cache", ctx).allowed).toBe(false);
  });
  it("an incomplete record is never usable", () => {
    expect(licenseProblems(lic())).toEqual([]);
    expect(licenseAllows(lic({ verifiedBy: null }), "import", ctx).allowed).toBe(false);
    expect(licenseAllows(lic({ evidenceRef: " " }), "import", ctx).allowed).toBe(false);
    expect(licenseAllows(lic({ rights: { ...ALL, translation: undefined as never } }), "import", ctx).allowed).toBe(false);
    expect(licenseProblems(lic({ validUntil: "2025-01-01" }))).toContain("validUntil must be after validFrom");
    expect(licenseProblems(lic({ country: "FR" as never }))).toContain("country: DE or IT");
  });
  it("the template is a draft without any right and passes no check", () => {
    const [t] = parseLicenseRegister(template);
    expect(t!.status).toBe("draft");
    expect(Object.values(t!.rights).every((v) => v === false)).toBe(true);
    expect(licenseAllows(t, "import", ctx).allowed).toBe(false);
    expect(licenseChecklist(t, "2026-06-01").filter((c) => c.done).map((c) => c.item)).toEqual(["Klasse B covered"]);
    expect(() => parseLicenseRegister("[]")).not.toThrow();
    expect(() => parseLicenseRegister('{"x":1}')).toThrow(/expected/);
    expect(() => parseLicenseRegister(JSON.stringify([lic(), lic()]))).toThrow(/duplicate/);
  });
  it("the checklist is complete only for a fully granted, verified licence", () => {
    expect(licenseChecklist(lic(), "2026-06-01").every((c) => c.done)).toBe(true);
    expect(licenseChecklist(undefined, "2026-06-01").some((c) => c.done)).toBe(false);
  });
});

describe("import under a licence register", () => {
  const base = (licenses: LicenseRecord[]): ImportContext => ({
    knownTopics: new Set(TOPICS.map((t) => t.id)), knownLicenses: new Set(), existing: new Map(),
    media: new Map([["fixture.png", { file: "fixture.png", kind: "image" as const, key: `media/${"a".repeat(64)}.png`, bytes: 10, mime: "image/png" }]]),
    licenses: new Map(licenses.map((l) => [l.id, l])), today: "2026-06-01",
  });
  const rows = () => jsonToImport(fixture);
  const errors = async (licenses: LicenseRecord[]) => (await validateImport(rows(), base(licenses))).rows.map((r) => r.errors.map((e) => e.message));

  it("accepts licensed rows under a verified licence with the needed rights", async () => {
    expect((await validateImport(rows(), base([lic()]))).summary).toMatchObject({ new: 2, invalid: 0 });
  });
  it("rejects every licensed row while the licence is only a draft (not bought or not verified yet)", async () => {
    const e = await errors([lic({ status: "draft", verifiedBy: null, verifiedOn: null })]);
    expect(e.every((r) => r.some((m) => m.includes("not verified by the owner")))).toBe(true);
  });
  it("rejects rows of an unknown licence, an uncovered catalogue release or an ended licence", async () => {
    expect((await errors([]))[0]![0]).toMatch(/unknown licence/);
    expect((await errors([lic({ catalogueVersions: ["2025-10-01"] })]))[0]).toContain("catalogue release 2026-01-01 is not covered");
    expect((await errors([lic({ validUntil: "2026-03-01" })]))[0]).toContain("licence ended on 2026-03-01");
  });
  it("refuses Sorani text on licensed rows without the translation right, but accepts the German-only row", async () => {
    const e = await errors([lic({ rights: { ...ALL, translation: false } })]);
    expect(e[0]!.some((m) => m.includes("right not granted: translation"))).toBe(true); // row 1 carries Sorani text
    expect(e[1]).toEqual([]); // row 2 is German only
  });
});
