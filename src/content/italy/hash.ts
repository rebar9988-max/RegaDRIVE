import { cyrb53 } from "../hash.ts";
import type { ItQuestion, ItSign } from "./types.ts";

/**
 * Fingerprints of the Italian items. A human approval is bound to the fingerprint of exactly the text,
 * answer and references that were reviewed; any later edit changes it and the approval stops counting.
 */
export const itQuestionHash = (q: ItQuestion): string => cyrb53(JSON.stringify(q));
export const itSignHash = (s: ItSign): string => cyrb53(JSON.stringify(s));
