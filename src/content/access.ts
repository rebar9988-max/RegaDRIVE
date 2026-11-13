import { QUESTIONS } from "./questions.ts";
import { LESSONS } from "./lessons.ts";
import { SIGNS } from "./signs.ts";
import { VOCABULARY } from "./vocabulary.ts";
import { CONTENT_REGISTRY } from "./registry.ts";
import { publicationGate } from "./pipeline.ts";

/**
 * "production": only items that pass the publication gate are visible (fail closed).
 * "preview": items still in review are visible for development/CI, clearly bannered in the UI. Never deployed
 * to the production domain (scripts/preflight.mjs rejects preview builds).
 */
export type ContentMode = "production" | "preview";

const gateOk = (id: string) => {
  const q = QUESTIONS.find((x) => x.id === id);
  return publicationGate(CONTENT_REGISTRY.get(id), q).publishable;
};

export function contentFor(mode: ContentMode) {
  const visible = <T extends { id: string }>(items: T[]) => (mode === "preview" ? items : items.filter((i) => gateOk(i.id)));
  return {
    mode,
    // Licensed official content is never bundled into the static app; it may only come from the
    // owner-activated, authorised server path (OFFICIAL_QUESTION_BANK_ENABLED, currently off).
    questions: visible(QUESTIONS.filter((q) => q.publicationStatus === "published" && q.sourceType !== "licensed_official")),
    lessons: visible(LESSONS),
    signs: visible(SIGNS),
    vocabulary: visible(VOCABULARY),
  };
}

export function isQuestionVisible(id: string, mode: ContentMode): boolean {
  return contentFor(mode).questions.some((q) => q.id === id);
}
