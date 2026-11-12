/**
 * Licence register and rights gate for licensed official content. Fail closed: a licence is usable only when
 * the owner verified it from the signed contract, it is in force today, and it grants the specific right asked
 * for. No right is ever assumed — in particular not translation and not replacing official media with our own.
 * Pure and runtime-agnostic; the database enforces the same rules again (migrations/0005).
 */
export type LicenseStatus = "draft" | "verified" | "suspended" | "expired" | "revoked";
export type Country = "DE" | "IT";

export interface LicenseRights {
  /** Use the official German question and answer texts. */
  questionText: boolean;
  /** Use the official images and videos. */
  officialMedia: boolean;
  /** Add our own translation (Sorani) to the licensed texts. */
  translation: boolean;
  /** Show our own original images or videos with licensed questions (instead of or next to the official ones). */
  ownMedia: boolean;
  /** Offer the content in an online app or website. */
  online: boolean;
  /** Keep the content in the device cache for offline use. */
  offline: boolean;
}
export const NO_RIGHTS: LicenseRights = { questionText: false, officialMedia: false, translation: false, ownMedia: false, online: false, offline: false };

export interface LicenseRecord {
  id: string;
  country: Country;
  licensor: string;
  /** What the contract covers, in the owner's words. */
  scope: string;
  status: LicenseStatus;
  /** YYYY-MM-DD */
  validFrom: string;
  validUntil: string | null;
  /** Reference to the signed contract (document number, archive path). Never the document itself. */
  evidenceRef: string;
  /** The owner who checked the contract, and when. Required for "verified". */
  verifiedBy: string | null;
  verifiedOn: string | null;
  /** Catalogue releases the contract covers (YYYY-MM-DD each). */
  catalogueVersions: string[];
  licenseClasses: string[];
  rights: LicenseRights;
  /** Copyright notice the contract requires next to the content, if any. */
  attributionText?: string | null;
}

export type LicenseUse = "import" | "publish_question" | "publish_translation" | "use_official_media" | "use_own_media" | "offline_cache";
export interface LicenseContext { today: string; country?: Country; catalogueVersion?: string | null; licenseClasses?: readonly string[] }
export interface LicenseDecision { allowed: boolean; reasons: string[] }

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const filled = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const RIGHT_KEYS = ["questionText", "officialMedia", "translation", "ownMedia", "online", "offline"] as const;

/** Structural problems of a register entry. An entry with problems is never usable. */
export function licenseProblems(l: LicenseRecord): string[] {
  const p: string[] = [];
  if (!filled(l?.id) || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(l.id)) p.push("id: 2–64 letters, digits, dot, dash or underscore");
  if (l.country !== "DE" && l.country !== "IT") p.push("country: DE or IT");
  if (!filled(l.licensor)) p.push("licensor required");
  if (!filled(l.scope)) p.push("scope required");
  if (!["draft", "verified", "suspended", "expired", "revoked"].includes(l.status)) p.push("status invalid");
  if (!DATE.test(l.validFrom ?? "")) p.push("validFrom: YYYY-MM-DD");
  if (l.validUntil !== null && !DATE.test(l.validUntil ?? "")) p.push("validUntil: YYYY-MM-DD or null");
  if (DATE.test(l.validFrom ?? "") && filled(l.validUntil) && l.validUntil <= l.validFrom) p.push("validUntil must be after validFrom");
  if (!Array.isArray(l.catalogueVersions) || l.catalogueVersions.some((v) => !DATE.test(v))) p.push("catalogueVersions: list of YYYY-MM-DD");
  if (!Array.isArray(l.licenseClasses) || l.licenseClasses.some((c) => !filled(c))) p.push("licenseClasses: list of classes");
  if (!l.rights || RIGHT_KEYS.some((k) => typeof l.rights[k] !== "boolean")) p.push("rights: every right must be stated as true or false");
  if (l.status === "verified") {
    if (!filled(l.evidenceRef)) p.push("verified licence needs the contract reference");
    if (!filled(l.verifiedBy)) p.push("verified licence needs the name of the owner who checked the contract");
    if (!DATE.test(l.verifiedOn ?? "")) p.push("verified licence needs the verification date");
  }
  return p;
}

/** Is the licence in force today, and does it grant this use for this catalogue release, class and country? */
export function licenseAllows(l: LicenseRecord | undefined, use: LicenseUse, ctx: LicenseContext): LicenseDecision {
  const reasons: string[] = [];
  if (!l) return { allowed: false, reasons: ["no licence on record"] };
  const problems = licenseProblems(l);
  if (problems.length) return { allowed: false, reasons: problems.map((x) => `licence record incomplete: ${x}`) };
  if (l.status !== "verified") reasons.push(`licence is ${l.status}, not verified by the owner`);
  if (ctx.today < l.validFrom) reasons.push(`licence starts on ${l.validFrom}`);
  if (l.validUntil !== null && ctx.today >= l.validUntil) reasons.push(`licence ended on ${l.validUntil}`);
  if (ctx.country && ctx.country !== l.country) reasons.push(`licence is for ${l.country}, content is for ${ctx.country}`);
  if (ctx.catalogueVersion !== undefined && (!ctx.catalogueVersion || !l.catalogueVersions.includes(ctx.catalogueVersion))) reasons.push(`catalogue release ${ctx.catalogueVersion ?? "(none)"} is not covered`);
  for (const c of ctx.licenseClasses ?? []) if (!l.licenseClasses.includes(c)) reasons.push(`class ${c} is not covered`);
  const need: Record<LicenseUse, (keyof LicenseRights)[]> = {
    import: ["questionText"],
    publish_question: ["questionText", "online"],
    publish_translation: ["questionText", "online", "translation"],
    use_official_media: ["officialMedia"],
    use_own_media: ["ownMedia"],
    offline_cache: ["offline"],
  };
  const words: Record<keyof LicenseRights, string> = { questionText: "question texts", officialMedia: "official images and videos", translation: "translation", ownMedia: "own images and videos with licensed questions", online: "online use", offline: "offline cache" };
  for (const r of need[use]) if (!l.rights[r]) reasons.push(`right not granted: ${words[r]}`);
  return { allowed: reasons.length === 0, reasons };
}

export interface LicenseRegister { licenses: LicenseRecord[] }
export function parseLicenseRegister(text: string): LicenseRecord[] {
  const data = JSON.parse(text) as Partial<LicenseRegister> | LicenseRecord[];
  const list = Array.isArray(data) ? data : data?.licenses;
  if (!Array.isArray(list)) throw new Error('licence register: expected { "licenses": [...] }');
  const ids = new Set<string>();
  for (const l of list) { if (ids.has(l?.id)) throw new Error(`licence register: duplicate id ${l.id}`); ids.add(l?.id); }
  return list;
}

/** What still has to be confirmed before licensed content can go live, in plain words (owner checklist). */
export function licenseChecklist(l: LicenseRecord | undefined, today: string): { item: string; done: boolean }[] {
  const r = l?.rights ?? NO_RIGHTS;
  return [
    { item: "Licence contract on record", done: !!l && licenseProblems(l).length === 0 },
    { item: "Contract verified by the owner", done: l?.status === "verified" },
    { item: "Licence in force today", done: !!l && today >= l.validFrom && (l.validUntil === null || today < l.validUntil) },
    { item: "Catalogue release(s) named", done: (l?.catalogueVersions.length ?? 0) > 0 },
    { item: "Klasse B covered", done: !!l?.licenseClasses.includes("B") },
    { item: "Right: official question texts", done: r.questionText },
    { item: "Right: online use", done: r.online },
    { item: "Right: Sorani translation", done: r.translation },
    { item: "Right: own images and videos with licensed questions", done: r.ownMedia },
    { item: "Right: official images and videos", done: r.officialMedia },
    { item: "Right: offline cache", done: r.offline },
  ];
}
