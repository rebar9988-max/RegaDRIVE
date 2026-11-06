import { QUESTIONS } from "./questions";
import { LESSONS } from "./lessons";
import { SIGNS } from "./signs";
import { VOCABULARY } from "./vocabulary";
import { CONTENT_REGISTRY } from "./registry";
import { publicationGate } from "./pipeline";

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
    questions: visible(QUESTIONS.filter((q) => q.publicationStatus === "published")),
    lessons: visible(LESSONS),
    signs: visible(SIGNS),
    vocabulary: visible(VOCABULARY),
  };
}

export function isQuestionVisible(id: string, mode: ContentMode): boolean {
  return contentFor(mode).questions.some((q) => q.id === id);
}
