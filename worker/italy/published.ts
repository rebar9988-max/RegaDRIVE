import { itReviewItemsFor } from "../../src/content/italy/reviewItems";
import { evaluateAll, loadRowsWithState } from "../dr/reviews";
import type { ItQuestion, ItSign } from "../../src/content/italy/types";
import type { D1Like } from "../dr/db";
import { loadItalyCatalogue } from "./catalogue";
import { PATENTE_B_RULES_IT } from "../../src/lib/shared/examIt";

/**
 * What the Italian section may serve to a learner right now, with content, not only ids.
 *
 * Public and account-free on purpose: the Italian section is free and needs no sign-in. Fail closed —
 * if the review records cannot be read, nothing is published. An item appears only when its own
 * fingerprint passed the three human review stages, so editing or re-importing it withdraws it until
 * it is reviewed again.
 */
export interface PublishedItaly {
  ok: boolean;
  /** Where the catalogue came from, and how many stored rows were unusable. */
  source: "stored" | "bundled";
  skipped: number;
  /** Items that exist at all, whether or not they are published — so the UI can say "in review". */
  inventory: { questions: number; signs: number };
  questions: ItQuestion[];
  signs: ItSign[];
  rulesVersion: string;
}

export async function approvedItalyContent(db: D1Like | undefined, contentDb?: D1Like): Promise<PublishedItaly> {
  const catalogue = await loadItalyCatalogue(contentDb);
  const out: PublishedItaly = {
    ok: false, source: catalogue.source, skipped: catalogue.skipped,
    inventory: { questions: catalogue.questions.length, signs: catalogue.signs.length },
    questions: [], signs: [], rulesVersion: PATENTE_B_RULES_IT.version,
  };
  if (!db) return out;
  try {
    const { rows, ready } = await loadRowsWithState(db);
    if (!ready.it) return out;
    const items = itReviewItemsFor(catalogue.questions, catalogue.signs);
    const published = new Set(evaluateAll(rows, items).filter((st) => st.publishable).map((st) => st.id));
    out.questions = catalogue.questions.filter((q) => published.has(q.id) && q.publicationStatus === "published");
    out.signs = catalogue.signs.filter((s) => published.has(s.id));
    out.ok = true;
  } catch { return { ...out, questions: [], signs: [], ok: false }; }
  return out;
}
