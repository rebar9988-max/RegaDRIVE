import { useEffect, useState } from "react";
import { CONTENT_MODE } from "./content";
import { SIGNS } from "../content/signs";
import { SIGN_QUIZ } from "../content/signQuiz";
import { questionHash, signHash } from "../content/hash";
import type { Question, TrafficSign } from "../content/types";

/**
 * Verkehrszeichen + sign quiz: what a learner may see. Production shows an item only when the server's
 * publication gate (human reviews recorded in /dr) lets it through AND the item in this app version is
 * byte-for-byte the one that was reviewed (fingerprint). Anything else stays hidden. Preview builds (CI) show all.
 */
export interface Approved { signs: TrafficSign[]; signQuiz: Question[]; loading: boolean; failed: boolean }

const published = SIGN_QUIZ.filter((q) => q.publicationStatus === "published" && q.sourceType !== "licensed_official");
type Api = { ok?: boolean; signs?: Record<string, string>; signQuiz?: Record<string, string> };
let inflight: Promise<Api | null> | null = null;
let fetchedAt = 0;

export function filterApproved(api: Api | null): { signs: TrafficSign[]; signQuiz: Question[] } {
  if (!api || api.ok !== true) return { signs: [], signQuiz: [] };
  const s = api.signs ?? {}, q = api.signQuiz ?? {};
  return { signs: SIGNS.filter((x) => s[x.id] === signHash(x)), signQuiz: published.filter((x) => q[x.id] === questionHash(x)) };
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
