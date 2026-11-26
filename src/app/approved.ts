import { useEffect, useState } from "react";
import { CONTENT_MODE } from "./content";
import { SIGNS } from "../content/signs";
import { SIGN_QUIZ } from "../content/signQuiz";
import { questionHash, signHash } from "../content/hash";
import { IT_QUESTIONS } from "../content/italy/questions";
import { IT_SIGNS } from "../content/italy/signs";
import { itQuestionHash, itSignHash } from "../content/italy/hash";
import { parseItQuestion, parseItSign } from "../content/italy/schema";
import type { ItQuestion, ItSign } from "../content/italy/types";
import type { Question, TrafficSign } from "../content/types";

/**
 * Verkehrszeichen + sign quiz: what a learner may see. Production shows an item only when the server's
 * publication gate (human reviews recorded in /dr) lets it through AND the item in this app version is
 * byte-for-byte the one that was reviewed (fingerprint). Anything else stays hidden. Preview builds (CI) show all.
 */
export interface Approved { signs: TrafficSign[]; signQuiz: Question[]; loading: boolean; failed: boolean }
/** The Italian section's approved content, fetched the same way and gated the same way. */
export interface ItApproved { signs: ItSign[]; questions: ItQuestion[]; loading: boolean; failed: boolean }

const published = SIGN_QUIZ.filter((q) => q.publicationStatus === "published" && q.sourceType !== "licensed_official");
const itPublished = IT_QUESTIONS.filter((q) => q.publicationStatus === "published");
type Api = { ok?: boolean; signs?: Record<string, string>; signQuiz?: Record<string, string>; itSigns?: Record<string, string>; itQuestions?: Record<string, string> };
let inflight: Promise<Api | null> | null = null;
let fetchedAt = 0;

export function filterApproved(api: Api | null): { signs: TrafficSign[]; signQuiz: Question[] } {
  if (!api || api.ok !== true) return { signs: [], signQuiz: [] };
  const s = api.signs ?? {}, q = api.signQuiz ?? {};
  return { signs: SIGNS.filter((x) => s[x.id] === signHash(x)), signQuiz: published.filter((x) => q[x.id] === questionHash(x)) };
}

/** Same rule for Italy: an item appears only when the server approved exactly this version of it. */
export function filterItApproved(api: Api | null): { signs: ItSign[]; questions: ItQuestion[] } {
  if (!api || api.ok !== true) return { signs: [], questions: [] };
  const s = api.itSigns ?? {}, q = api.itQuestions ?? {};
  return { signs: IT_SIGNS.filter((x) => s[x.id] === itSignHash(x)), questions: itPublished.filter((x) => q[x.id] === itQuestionHash(x)) };
}

function load(): Promise<Api | null> {
  if (!inflight || Date.now() - fetchedAt > 30_000) {
    fetchedAt = Date.now();
    inflight = fetch("/api/content/approved", { credentials: "omit", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Api>) : null))
      .catch(() => null);
  }
  return inflight;
}

/**
 * The Italian content a learner may see. Preview builds (development, CI) show everything that exists;
 * production shows only what the server's publication gate lets through, so nothing reaches a learner
 * before the human reviews are recorded in /dr.
 */
/**
 * The published Italian catalogue, with its content, from /api/content/italy. The server holds the
 * catalogue the owner imported and applies the publication gate, so a reviewed import reaches learners
 * without a new build. Needs no account: the Italian section is free and sign-in free.
 */
interface ItalyApi { ok?: boolean; questions?: unknown; signs?: unknown; inventory?: { questions?: number; signs?: number } }

export function parseItalyPublished(api: ItalyApi | null): { signs: ItSign[]; questions: ItQuestion[] } | null {
  if (!api || api.ok !== true || !Array.isArray(api.questions) || !Array.isArray(api.signs)) return null;
  const signs = api.signs.flatMap((raw) => { const p = parseItSign(raw); return p.value ? [p.value] : []; });
  const ids = new Set(signs.map((s) => s.id));
  const questions = api.questions.flatMap((raw) => { const p = parseItQuestion(raw, ids); return p.value ? [p.value] : []; });
  return { signs, questions };
}

export function useItApproved(): ItApproved {
  const [state, setState] = useState<ItApproved>(() =>
    CONTENT_MODE === "preview" ? { signs: IT_SIGNS, questions: itPublished, loading: false, failed: false } : { signs: [], questions: [], loading: true, failed: false });
  useEffect(() => {
    if (CONTENT_MODE === "preview") return;
    let alive = true;
    void (async () => {
      // The server catalogue first; the build's own copy is the fallback when that endpoint is absent.
      const live = await fetch("/api/content/italy", { headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() as Promise<ItalyApi> : null)).catch(() => null);
      const fromServer = parseItalyPublished(live);
      if (fromServer) {
        if (alive) setState({ ...fromServer, loading: false, failed: false });
        return;
      }
      const api = await load();
      if (alive) setState({ ...filterItApproved(api), loading: false, failed: !api || api.ok !== true });
    })();
    return () => { alive = false; };
  }, []);
  return state;
}

export function useApproved(): Approved {
  const [state, setState] = useState<Approved>(() =>
    CONTENT_MODE === "preview" ? { signs: SIGNS, signQuiz: published, loading: false, failed: false } : { signs: [], signQuiz: [], loading: true, failed: false });
  useEffect(() => {
    if (CONTENT_MODE === "preview") return;
    let alive = true;
    void load().then((api) => { if (alive) setState({ ...filterApproved(api), loading: false, failed: !api || api.ok !== true }); });
    return () => { alive = false; };
  }, []);
  return state;
}
