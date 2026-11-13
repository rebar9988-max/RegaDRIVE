import type { Question, TrafficSign } from "./types.ts";

/**
 * Content fingerprints. A review approval is bound to the fingerprint of exactly the text, options, answer and
 * references that were reviewed; any later edit changes it and the approval stops counting (fail closed).
 * Kept free of imports from the content bank so the learner pages can use it without pulling the registry.
 */
/** 53-bit string hash (cyrb53): deterministic, synchronous, available in Workers and browsers. */
export function cyrb53(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export const signHash = (s: TrafficSign): string => cyrb53(JSON.stringify(s));
export const questionHash = (q: Question): string => cyrb53(JSON.stringify(q));
