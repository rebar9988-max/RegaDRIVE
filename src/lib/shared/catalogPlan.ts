/**
 * Planning quota for the 1,600-question bank, per topic. PROPOSED distribution for the owner to confirm
 * (docs/QUESTION_BANK_ROADMAP.md, phase 0): it is a production plan, not a statement about the official
 * catalogue. Coverage is always measured from real records; a quota is never counted as content.
 */
import type { Question } from "../../content/types";
import { CATALOG_TARGET, catalogReport, type CatalogOptions } from "./catalog";

export interface TopicQuota { topicId: string; category: "Grundstoff" | "Zusatzstoff"; quota: number; /** Planned questions with an image or video. */ withMedia: number }

export const CATALOG_PLAN_STATUS: "proposed" | "owner_confirmed" = "proposed";

export const CATALOG_PLAN: readonly TopicQuota[] = [
  { topicId: "priority", category: "Grundstoff", quota: 180, withMedia: 120 },
  { topicId: "speed", category: "Grundstoff", quota: 110, withMedia: 40 },
  { topicId: "distance", category: "Grundstoff", quota: 110, withMedia: 40 },
  { topicId: "signs", category: "Grundstoff", quota: 200, withMedia: 60 },
  { topicId: "people", category: "Grundstoff", quota: 130, withMedia: 80 },
  { topicId: "behaviour", category: "Grundstoff", quota: 150, withMedia: 30 },
  { topicId: "emergency", category: "Grundstoff", quota: 120, withMedia: 40 },
  { topicId: "vehicle", category: "Zusatzstoff", quota: 240, withMedia: 60 },
  { topicId: "motorway", category: "Zusatzstoff", quota: 200, withMedia: 90 },
  { topicId: "environment", category: "Zusatzstoff", quota: 160, withMedia: 20 },
];

export const planTotal = (plan: readonly TopicQuota[] = CATALOG_PLAN) => plan.reduce((n, t) => n + t.quota, 0);

export interface TopicCoverage extends TopicQuota { total: number; valid: number; ready: number; missing: number; mediaHave: number; mediaMissing: number }

/** Real coverage per planned topic. `missing` is counted against valid records only. */
export function planCoverage(questions: readonly Question[], opts: CatalogOptions = {}, plan: readonly TopicQuota[] = CATALOG_PLAN): { topics: TopicCoverage[]; unplanned: string[]; target: number; planMatchesTarget: boolean } {
  const topics = plan.map((t) => {
    const own = questions.filter((q) => q.topicId === t.topicId);
    const r = catalogReport(own, { ...opts, target: t.quota });
    const blocked = new Set(r.issues.filter((i) => i.kind !== "missing_sorani" && i.kind !== "missing_explanation" && i.kind !== "missing_media_alt" && i.kind !== "video_without_poster" && i.kind !== "media_not_approved").map((i) => i.questionId));
    const mediaHave = own.filter((q) => !blocked.has(q.id) && (q.media?.length ?? 0) > 0).length;
    return { ...t, total: own.length, valid: r.valid, ready: r.ready, missing: r.missing, mediaHave, mediaMissing: Math.max(0, t.withMedia - mediaHave) };
  });
  const planned = new Set(plan.map((t) => t.topicId));
  return { topics, unplanned: [...new Set(questions.map((q) => q.topicId).filter((id) => !planned.has(id)))], target: CATALOG_TARGET, planMatchesTarget: planTotal(plan) === CATALOG_TARGET };
}
